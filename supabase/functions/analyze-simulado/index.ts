import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration
const RATE_LIMIT_MAX_CALLS = 10; // 10 simulado analyses per hour
const RATE_LIMIT_WINDOW_MINUTES = 60;

interface SimuladoAnswer {
  discipline: string;
  is_correct: boolean | null;
  selected_answer: string | null;
}

/**
 * Edge function to analyze simulado results and generate AI-powered insights
 * Identifies strengths, weaknesses, and provides study tips
 * Rate limited to prevent API quota exhaustion
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[analyze-simulado] Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user token to verify authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.error("[analyze-simulado] Invalid token:", userError);
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check rate limit using service role client
    const supabaseRateLimit = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: rateLimitAllowed, error: rateLimitError } = await supabaseRateLimit
      .rpc("check_rate_limit", {
        _user_id: user.id,
        _function_name: "analyze-simulado",
        _max_calls: RATE_LIMIT_MAX_CALLS,
        _window_minutes: RATE_LIMIT_WINDOW_MINUTES,
      });

    if (rateLimitError) {
      console.error("[analyze-simulado] Rate limit check error:", rateLimitError);
    } else if (!rateLimitAllowed) {
      console.log("[analyze-simulado] Rate limit exceeded for user:", user.id);
      return new Response(
        JSON.stringify({ 
          error: "Limite de análises atingido. Tente novamente em 1 hora.",
          rateLimited: true 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[analyze-simulado] Authenticated user:", user.id);

    const { simuladoId } = await req.json();

    if (!simuladoId) {
      throw new Error("simuladoId é obrigatório");
    }

    console.log("Analyzing simulado:", simuladoId, "for user:", user.id);

    // Verify ownership of the simulado (using anon key respects RLS)
    const { data: simulado, error: simError } = await supabaseAuth
      .from("simulados")
      .select("user_id")
      .eq("id", simuladoId)
      .single();

    if (simError || !simulado) {
      console.error("Simulado not found or access denied:", simError);
      return new Response(
        JSON.stringify({ error: "Simulado não encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (simulado.user_id !== user.id) {
      console.error("User", user.id, "attempted to access simulado owned by", simulado.user_id);
      return new Response(
        JSON.stringify({ error: "Acesso negado" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role for data operations (after ownership is verified)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch simulado answers
    const { data: answers, error: answersError } = await supabase
      .from("simulado_answers")
      .select("discipline, is_correct, selected_answer")
      .eq("simulado_id", simuladoId);

    if (answersError) {
      console.error("Error fetching answers:", answersError);
      throw new Error("Erro ao buscar respostas do simulado");
    }

    // If no answers found, return empty results instead of error
    if (!answers || answers.length === 0) {
      console.log("No answers found, returning empty results");
      
      // Save empty results to database
      await supabase
        .from("simulado_results")
        .upsert({
          simulado_id: simuladoId,
          total_correct: 0,
          total_incorrect: 0,
          total_unanswered: 0,
          strengths: [],
          weaknesses: [],
          tips: "Nenhuma questão foi respondida neste simulado."
        }, { onConflict: "simulado_id" });

      return new Response(JSON.stringify({
        totalCorrect: 0,
        totalIncorrect: 0,
        totalUnanswered: 0,
        disciplinePerformance: [],
        strengths: [],
        weaknesses: [],
        tips: "Nenhuma questão foi respondida neste simulado."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${answers.length} answers to analyze`);

    // Calculate statistics by discipline
    const disciplineStats: Record<string, { correct: number; incorrect: number; unanswered: number }> = {};
    
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalUnanswered = 0;

    answers.forEach((answer: SimuladoAnswer) => {
      const discipline = answer.discipline;
      
      if (!disciplineStats[discipline]) {
        disciplineStats[discipline] = { correct: 0, incorrect: 0, unanswered: 0 };
      }

      if (answer.selected_answer === null) {
        disciplineStats[discipline].unanswered++;
        totalUnanswered++;
      } else if (answer.is_correct) {
        disciplineStats[discipline].correct++;
        totalCorrect++;
      } else {
        disciplineStats[discipline].incorrect++;
        totalIncorrect++;
      }
    });

    // Calculate performance percentage per discipline
    const disciplinePerformance = Object.entries(disciplineStats).map(([discipline, stats]) => {
      const total = stats.correct + stats.incorrect + stats.unanswered;
      const percentage = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
      return { discipline, ...stats, percentage };
    });

    // Identify strengths (>= 70%) and weaknesses (< 50%)
    const strengths = disciplinePerformance
      .filter(d => d.percentage >= 70)
      .map(d => ({ discipline: d.discipline, percentage: d.percentage }));

    const weaknesses = disciplinePerformance
      .filter(d => d.percentage < 50)
      .map(d => ({ discipline: d.discipline, percentage: d.percentage }));

    // Generate AI tips using Groq API
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    let tips = "";

    if (groqApiKey) {
      try {
        const promptData = {
          totalQuestions: answers.length,
          totalCorrect,
          totalIncorrect,
          totalUnanswered,
          disciplinePerformance,
          strengths,
          weaknesses
        };

        let aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `Você é um especialista em preparação para o ENEM. Analise o desempenho do estudante e forneça dicas de estudo personalizadas e motivacionais.

Regras:
- Seja direto e objetivo
- Use linguagem acessível e motivacional
- Foque nas áreas que precisam de mais atenção
- Sugira estratégias práticas de estudo
- Não use formatação markdown (sem # ou *)
- Limite a resposta a 3-4 parágrafos curtos`
              },
              {
                role: "user",
                content: `Analise este resultado de simulado e forneça dicas de estudo:

Total de questões: ${promptData.totalQuestions}
Acertos: ${promptData.totalCorrect}
Erros: ${promptData.totalIncorrect}
Não respondidas: ${promptData.totalUnanswered}

Desempenho por disciplina:
${promptData.disciplinePerformance.map(d => `- ${d.discipline}: ${d.percentage}% de acerto (${d.correct}/${d.correct + d.incorrect + d.unanswered})`).join('\n')}

Pontos fortes: ${promptData.strengths.length > 0 ? promptData.strengths.map(s => s.discipline).join(', ') : 'Nenhum identificado'}
Pontos fracos: ${promptData.weaknesses.length > 0 ? promptData.weaknesses.map(w => w.discipline).join(', ') : 'Nenhum identificado'}`
              }
            ],
            max_tokens: 800,
            temperature: 0.7,
          }),
        });

        if (!aiResponse.ok) {
          console.warn("[analyze-simulado] Falha no 70b, tentando fallback com llama-3.1-8b-instant...");
          try {
            aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${groqApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                  {
                    role: "system",
                    content: "Você é um orientador pedagógico especialista no ENEM. Seja claro, empático e prático."
                  },
                  {
                    role: "user",
                    content: `Analise este resultado de simulado e dê dicas objetivas:\nAcertos: ${promptData.totalCorrect}/${promptData.totalQuestions}`
                  }
                ],
                max_tokens: 600,
                temperature: 0.6,
              }),
            });
          } catch (fbErr) {
            console.warn("[analyze-simulado] Erro no fallback:", fbErr);
          }
        }

        if (aiResponse && aiResponse.ok) {
          const aiData = await aiResponse.json();
          tips = aiData.choices?.[0]?.message?.content || "";
        } else {
          console.error("Groq API error:", aiResponse ? await aiResponse.text() : "Sem resposta");
        }
      } catch (aiError) {
        console.error("AI tips generation error:", aiError);
        tips = "Continue praticando! Foque nas disciplinas com menor desempenho e revise os conceitos fundamentais.";
      }
    } else {
      console.warn("GROQ_API_KEY não configurada");
      tips = "Continue praticando! Foque nas disciplinas com menor desempenho e revise os conceitos fundamentais.";
    }

    // Save results to database
    const { error: resultError } = await supabase
      .from("simulado_results")
      .upsert({
        simulado_id: simuladoId,
        total_correct: totalCorrect,
        total_incorrect: totalIncorrect,
        total_unanswered: totalUnanswered,
        strengths: strengths,
        weaknesses: weaknesses,
        tips: tips
      }, { onConflict: "simulado_id" });

    if (resultError) {
      console.error("Error saving results:", resultError);
    }

    console.log("Simulado analysis completed successfully");

    return new Response(JSON.stringify({
      totalCorrect,
      totalIncorrect,
      totalUnanswered,
      disciplinePerformance,
      strengths,
      weaknesses,
      tips
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error analyzing simulado:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao analisar simulado" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
