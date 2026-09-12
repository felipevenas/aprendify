import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge function para gerar cronograma de estudos personalizado com IA
 * 
 * Usa dados de desempenho do usuário (questões respondidas, tópicos com erros)
 * para criar um cronograma focado nas áreas que precisam de mais atenção.
 * 
 * Fluxo:
 * 1. Busca tentativas de questões do usuário
 * 2. Analisa desempenho por disciplina e tópico específico
 * 3. Identifica pontos fracos (< 60% acerto) e tópicos críticos (< 50%)
 * 4. Gera cronograma priorizando essas áreas
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration - generous limit as it's resource-intensive
const RATE_LIMIT_MAX_CALLS = 3; // 3 schedule generations per hour
const RATE_LIMIT_WINDOW_MINUTES = 60;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 32 * 1024) {
    return new Response(JSON.stringify({ error: "Requisição muito grande" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check rate limit using service role client
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: rateLimitAllowed, error: rateLimitError } = await supabaseService
      .rpc("check_rate_limit", {
        _user_id: user.id,
        _function_name: "generate-study-schedule",
        _max_calls: RATE_LIMIT_MAX_CALLS,
        _window_minutes: RATE_LIMIT_WINDOW_MINUTES,
      });

    if (rateLimitError) {
      console.error("[generate-study-schedule] Rate limit check error:", rateLimitError);
      return new Response(
        JSON.stringify({ error: "Controle de uso temporariamente indisponível" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else if (!rateLimitAllowed) {
      console.log("[generate-study-schedule] Rate limit exceeded for user:", user.id);
      return new Response(
        JSON.stringify({ 
          error: "Limite de gerações de cronograma atingido. Tente novamente em 1 hora.",
          rateLimited: true 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[generate-study-schedule] Generating schedule for authenticated user");

    // Buscar desempenho do usuário em questões (últimos 30 dias têm mais peso)
    const { data: questionAttempts } = await supabase
      .from("question_attempts")
      .select("discipline, is_correct, topic, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);

    // Buscar resultados de simulados
    const { data: simuladoResults } = await supabase
      .from("simulado_results")
      .select(`
        total_correct,
        total_incorrect,
        strengths,
        weaknesses,
        simulados!inner(user_id)
      `)
      .eq("simulados.user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Matérias fixas do sistema (não mais buscadas do banco)
    const subjects = [
      { id: "linguagens", name: "Linguagens", color: "#3B82F6" },
      { id: "ciencias-humanas", name: "Ciências Humanas", color: "#8B5CF6" },
      { id: "ciencias-natureza", name: "Ciências da Natureza", color: "#22C55E" },
      { id: "matematica", name: "Matemática", color: "#F97316" },
      { id: "redacao", name: "Redação", color: "#EF4444" },
    ];

    // Análise de desempenho por disciplina e tópico específico
    const disciplineStats: Record<string, { 
      correct: number; 
      total: number; 
      topics: Record<string, { correct: number; total: number }> 
    }> = {};
    
    // Tópicos específicos que precisam de atenção (extraídos por IA)
    const topicPriorities: { topic: string; discipline: string; accuracy: number; total: number }[] = [];
    
    if (questionAttempts) {
      for (const attempt of questionAttempts) {
        // Estatísticas por disciplina
        if (!disciplineStats[attempt.discipline]) {
          disciplineStats[attempt.discipline] = { correct: 0, total: 0, topics: {} };
        }
        disciplineStats[attempt.discipline].total++;
        if (attempt.is_correct) {
          disciplineStats[attempt.discipline].correct++;
        }

        // Rastrear tópicos específicos (apenas tópicos válidos - não textos longos)
        if (attempt.topic && attempt.topic.length > 2 && attempt.topic.length < 60) {
          if (!disciplineStats[attempt.discipline].topics[attempt.topic]) {
            disciplineStats[attempt.discipline].topics[attempt.topic] = { correct: 0, total: 0 };
          }
          disciplineStats[attempt.discipline].topics[attempt.topic].total++;
          if (attempt.is_correct) {
            disciplineStats[attempt.discipline].topics[attempt.topic].correct++;
          }
        }
      }
    }

    // Identificar pontos fracos por disciplina (abaixo de 60% de acerto)
    const weakDisciplines: { discipline: string; percentage: number }[] = [];
    const strongDisciplines: { discipline: string; percentage: number }[] = [];

    for (const [discipline, stats] of Object.entries(disciplineStats)) {
      const percentage = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      
      if (percentage < 60) {
        weakDisciplines.push({ discipline, percentage: Math.round(percentage) });
      } else if (percentage >= 70) {
        strongDisciplines.push({ discipline, percentage: Math.round(percentage) });
      }

      // Identificar tópicos específicos com baixo desempenho (extraídos por IA)
      for (const [topic, topicStats] of Object.entries(stats.topics)) {
        if (topicStats.total >= 2) { // Mínimo 2 questões para considerar
          const topicPercentage = (topicStats.correct / topicStats.total) * 100;
          topicPriorities.push({
            topic,
            discipline,
            accuracy: Math.round(topicPercentage),
            total: topicStats.total,
          });
        }
      }
    }

    // Ordenar tópicos por prioridade (pior desempenho primeiro)
    topicPriorities.sort((a, b) => a.accuracy - b.accuracy);
    weakDisciplines.sort((a, b) => a.percentage - b.percentage);

    // Tópicos críticos: menos de 50% de acerto com pelo menos 2 questões
    const criticalTopics = topicPriorities
      .filter(t => t.accuracy < 50)
      .slice(0, 10);

    // Tópicos que precisam de atenção: entre 50-70% de acerto
    const attentionTopics = topicPriorities
      .filter(t => t.accuracy >= 50 && t.accuracy < 70)
      .slice(0, 5);

    console.log(`[generate-study-schedule] Tópicos críticos: ${criticalTopics.length}, Tópicos atenção: ${attentionTopics.length}`);

    // Gerar datas para os próximos 7 dias (excluindo domingos)
    const today = new Date();
    const scheduleDates: string[] = [];
    for (let i = 0; i < 10 && scheduleDates.length < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      // Pular domingos (0)
      if (date.getDay() !== 0) {
        scheduleDates.push(date.toISOString().split("T")[0]);
      }
    }

    // Montar dados de performance para a IA
    const performanceData = {
      totalQuestionsAnswered: questionAttempts?.length || 0,
      disciplineStats: Object.entries(disciplineStats).map(([discipline, stats]) => ({
        discipline,
        correct: stats.correct,
        total: stats.total,
        percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      })),
      weakDisciplines: weakDisciplines.slice(0, 5),
      strongDisciplines: strongDisciplines.slice(0, 3),
      criticalTopics: criticalTopics.map(t => `${t.topic} (${t.discipline}: ${t.accuracy}%)`),
      attentionTopics: attentionTopics.map(t => `${t.topic} (${t.discipline}: ${t.accuracy}%)`),
      userSubjects: subjects?.map(s => s.name) || [],
    };

    console.log("[generate-study-schedule] Performance analysis:", JSON.stringify({
      criticalTopics: criticalTopics.length,
      attentionTopics: attentionTopics.length,
      weakDisciplines: weakDisciplines.length
    }));
    const prompt = `Gere um cronograma PERSONALIZADO de estudos para ENEM baseado no desempenho do aluno.

DESEMPENHO POR DISCIPLINA:
${performanceData.disciplineStats.map(d => `${d.discipline}: ${d.percentage}%`).join(", ")}

DISCIPLINAS PRIORITÁRIAS (< 60% acerto):
${weakDisciplines.length > 0 ? weakDisciplines.map(d => `${d.discipline} (${d.percentage}%)`).join(", ") : "Nenhuma disciplina crítica"}

TÓPICOS ESPECÍFICOS CRÍTICOS (< 50% acerto) - PRIORIDADE MÁXIMA:
${criticalTopics.length > 0 ? criticalTopics.map(t => `${t.topic} em ${t.discipline}`).join(", ") : "Nenhum tópico crítico identificado"}

TÓPICOS QUE PRECISAM DE ATENÇÃO (50-70% acerto):
${attentionTopics.length > 0 ? attentionTopics.map(t => `${t.topic} em ${t.discipline}`).join(", ") : "Nenhum tópico identificado"}

DATAS DISPONÍVEIS: ${scheduleDates.join(", ")}

REGRAS:
- 2 a 3 sessões por dia
- Sessões de 45-60 minutos
- PRIORIZAR tópicos críticos identificados pela IA
- Incluir atividades práticas específicas para cada tópico
- Sugerir exercícios e técnicas de estudo
- Variar disciplinas ao longo da semana

Responda APENAS com JSON válido (sem markdown):
{"schedule":[{"date":"YYYY-MM-DD","items":[{"discipline":"Nome da Disciplina","topic":"Tópico Específico","duration_minutes":60,"start_time":"08:00","activities":"Atividades práticas detalhadas","tips":"Dica de estudo","priority":"alta|media|normal"}]}]}`;

    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
            content: "Responda APENAS com JSON válido e compacto. Sem markdown. Sem explicações. Máximo 7 dias, 2-3 sessões por dia."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2500,
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[generate-study-schedule] Groq API error:", errorText);
      return new Response(JSON.stringify({ error: "Erro ao gerar cronograma com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    
    console.log("[generate-study-schedule] AI Response length:", aiContent.length);

    // Parse do JSON da IA
    let scheduleData;
    try {
      // Remove possíveis marcadores de código markdown
      let cleanedContent = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      // Tentar encontrar JSON válido mesmo se truncado
      if (!cleanedContent.endsWith("}")) {
        // Tenta fechar o JSON truncado
        const lastBracket = cleanedContent.lastIndexOf("}");
        if (lastBracket > 0) {
          cleanedContent = cleanedContent.substring(0, lastBracket + 1);
          // Conta brackets para fechar corretamente
          const openBrackets = (cleanedContent.match(/\[/g) || []).length;
          const closeBrackets = (cleanedContent.match(/\]/g) || []).length;
          cleanedContent += "]".repeat(openBrackets - closeBrackets);
          if (!cleanedContent.endsWith("}}")) {
            cleanedContent += "}";
          }
        }
      }
      
      scheduleData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("[generate-study-schedule] Error parsing AI response:", parseError);
      console.error("[generate-study-schedule] Raw content:", aiContent.substring(0, 500));
      return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limpar cronograma existente gerado por IA
    const { error: deleteError } = await supabase
      .from("schedule_items")
      .delete()
      .eq("user_id", user.id)
      .eq("is_ai_generated", true);

    if (deleteError) {
      console.error("[generate-study-schedule] Error deleting old schedule:", deleteError);
    }

    // Inserir novos itens do cronograma
    const newItems: any[] = [];
    
    for (const day of scheduleData.schedule) {
      for (const item of day.items) {
        const endTime = calculateEndTime(item.start_time, item.duration_minutes);
        
        newItems.push({
          user_id: user.id,
          scheduled_date: day.date,
          title: `${item.discipline} - ${item.topic}`,
          topic: item.topic,
          start_time: item.start_time,
          end_time: endTime,
          estimated_duration: item.duration_minutes,
          activities: item.activities,
          study_tips: item.tips,
          priority: item.priority || "normal",
          is_ai_generated: true,
          notes: null,
          subject_id: null, // Poderia mapear para subjects do usuário
          day_of_week: new Date(day.date).getDay(),
        });
      }
    }

    const { error: insertError } = await supabase
      .from("schedule_items")
      .insert(newItems);

    if (insertError) {
      console.error("[generate-study-schedule] Error inserting schedule items:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao salvar cronograma" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Registrar geração do cronograma (delete old + insert new)
    await supabase
      .from("schedule_generations")
      .delete()
      .eq("user_id", user.id);

    await supabase
      .from("schedule_generations")
      .insert({
        user_id: user.id,
        generated_at: new Date().toISOString(),
        next_regeneration_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        performance_snapshot: performanceData,
      });

    console.log(`[generate-study-schedule] Cronograma gerado com ${newItems.length} itens`);

    return new Response(
      JSON.stringify({
        success: true,
        itemsCreated: newItems.length,
        message: "Cronograma gerado com sucesso!",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("[generate-study-schedule] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;
}
