import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration
const RATE_LIMIT_MAX_CALLS = 10; // 10 calls per hour
const RATE_LIMIT_WINDOW_MINUTES = 60;

interface DisciplineStat {
  name: string;
  accuracy: string;
  total: number;
}

interface TopicStat {
  name: string;
  count: number;
}

interface EssayCompetencyStat {
  competencia: string;
  media: number;
}

interface StudyStats {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  successRate: number;
  disciplineStats?: DisciplineStat[];
  topicStats?: TopicStat[];
  totalEssays: number;
  averageEssayScore: number;
  essayCompetencyData?: EssayCompetencyStat[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[ai-study-suggestion] No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[ai-study-suggestion] Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User authenticated successfully

    // Check rate limit using service role client
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: rateLimitAllowed, error: rateLimitError } = await supabaseService
      .rpc("check_rate_limit", {
        _user_id: user.id,
        _function_name: "ai-study-suggestion",
        _max_calls: RATE_LIMIT_MAX_CALLS,
        _window_minutes: RATE_LIMIT_WINDOW_MINUTES,
      });

    if (rateLimitError) {
      console.error("[ai-study-suggestion] Rate limit check error:", rateLimitError);
      return new Response(
        JSON.stringify({ error: "Controle de uso temporariamente indisponível" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else if (!rateLimitAllowed) {
      console.log("[ai-study-suggestion] Rate limit exceeded for user:", user.id);
      return new Response(
        JSON.stringify({ 
          error: "Limite de requisições atingido. Tente novamente em 1 hora.",
          rateLimited: true 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { stats } = await req.json() as { stats: StudyStats };

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construir prompt com os dados do usuário
    const prompt = `Você é um tutor especialista em preparação para o ENEM. Analise os dados de estudo do aluno e forneça sugestões personalizadas e práticas.

DADOS DO ALUNO:

Questões:
- Total de questões respondidas: ${stats.totalQuestions}
- Acertos: ${stats.correctAnswers}
- Erros: ${stats.wrongAnswers}
- Taxa de acerto geral: ${stats.successRate}%

Desempenho por disciplina:
${stats.disciplineStats?.map((d) => `- ${d.name}: ${d.accuracy}% de acerto (${d.total} questões)`).join('\n') || 'Sem dados'}

Disciplinas com mais erros:
${stats.topicStats?.map((t) => `- ${t.name}: ${t.count} erros`).join('\n') || 'Sem dados'}

Redações:
- Total de redações enviadas: ${stats.totalEssays}
- Média de nota: ${stats.averageEssayScore}/1000

Média por competência das redações:
${stats.essayCompetencyData?.map((c) => `- ${c.competencia}: ${c.media}/200`).join('\n') || 'Sem dados'}

INSTRUÇÕES:
1. Faça uma análise breve do desempenho geral
2. Identifique os pontos fortes e fracos
3. Dê 3-5 sugestões práticas e específicas de estudo
4. Se houver dados de redação, inclua dicas específicas para melhorar nas competências mais fracas
5. Seja motivador mas realista
6. Use linguagem clara e direta

REGRAS DE FORMATAÇÃO OBRIGATÓRIAS:
- NÃO use caracteres markdown como #, *, **, ---, etc.
- Use apenas texto corrido com quebras de linha
- Separe seções com linhas em branco
- Use números ou hífens simples para listas
- Mantenha a estrutura organizada mas sem formatação especial

Responda em português brasileiro de forma organizada e concisa.`;

    let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.warn("[ai-study-suggestion] Falha no 70b, tentando fallback com llama-3.1-8b-instant...");
      try {
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "user", content: prompt }
            ],
            max_tokens: 1000,
            temperature: 0.7,
          }),
        });
      } catch (fbErr) {
        console.warn("[ai-study-suggestion] Erro no fallback:", fbErr);
      }
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "Sem conexão";
      console.error("[ai-study-suggestion] Erro na API Groq:", response?.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar sugestões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const suggestion = data.choices?.[0]?.message?.content || "Não foi possível gerar sugestões.";

    console.log("[ai-study-suggestion] Suggestion generated successfully");

    return new Response(
      JSON.stringify({ suggestion }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ai-study-suggestion] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
