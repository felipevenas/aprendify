import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[generate-study-schedule] Gerando cronograma para usuário ${user.id}`);

    // Buscar desempenho do usuário em questões
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

    // Buscar matérias do usuário
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, name, color")
      .eq("user_id", user.id);

    // Analisar desempenho por disciplina
    const disciplineStats: Record<string, { correct: number; total: number; topics: Record<string, { correct: number; total: number }> }> = {};
    
    if (questionAttempts) {
      for (const attempt of questionAttempts) {
        if (!disciplineStats[attempt.discipline]) {
          disciplineStats[attempt.discipline] = { correct: 0, total: 0, topics: {} };
        }
        disciplineStats[attempt.discipline].total++;
        if (attempt.is_correct) {
          disciplineStats[attempt.discipline].correct++;
        }

        // Rastrear tópicos
        if (attempt.topic) {
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

    // Identificar pontos fracos (abaixo de 60% de acerto)
    const weaknesses: { discipline: string; topic?: string; percentage: number }[] = [];
    const strengths: { discipline: string; topic?: string; percentage: number }[] = [];

    for (const [discipline, stats] of Object.entries(disciplineStats)) {
      const percentage = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      
      if (percentage < 60) {
        weaknesses.push({ discipline, percentage });
      } else if (percentage >= 70) {
        strengths.push({ discipline, percentage });
      }

      // Analisar tópicos específicos
      for (const [topic, topicStats] of Object.entries(stats.topics)) {
        const topicPercentage = topicStats.total > 0 ? (topicStats.correct / topicStats.total) * 100 : 0;
        if (topicPercentage < 50 && topicStats.total >= 3) {
          weaknesses.push({ discipline, topic, percentage: topicPercentage });
        }
      }
    }

    // Ordenar por prioridade (pior desempenho primeiro)
    weaknesses.sort((a, b) => a.percentage - b.percentage);

    // Gerar datas para os próximos 7 dias (excluindo domingos) - reduzido para evitar truncamento
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

    const performanceData = {
      totalQuestionsAnswered: questionAttempts?.length || 0,
      disciplineStats: Object.entries(disciplineStats).map(([discipline, stats]) => ({
        discipline,
        correct: stats.correct,
        total: stats.total,
        percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      })),
      weaknesses: weaknesses.slice(0, 5),
      strengths: strengths.slice(0, 3),
      userSubjects: subjects?.map(s => s.name) || [],
    };

    console.log("[generate-study-schedule] Performance data:", JSON.stringify(performanceData, null, 2));

    const prompt = `Gere um cronograma COMPACTO de estudos para ENEM.

DESEMPENHO:
${performanceData.disciplineStats.map(d => `${d.discipline}: ${d.percentage}%`).join(", ")}

PRIORIZAR: ${performanceData.weaknesses.slice(0, 3).map(w => w.discipline).join(", ") || "Todas as disciplinas"}

DATAS: ${scheduleDates.join(", ")}

REGRAS:
- 2 a 3 sessões por dia
- Sessões de 45-60 min
- Foco nos pontos fracos
- Tópicos específicos

Responda APENAS JSON (sem markdown):
{"schedule":[{"date":"YYYY-MM-DD","items":[{"discipline":"Nome","topic":"Tópico","duration_minutes":60,"start_time":"08:00","activities":"Atividades curtas","tips":"Dica curta","priority":"alta"}]}]}`;

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
        next_regeneration_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
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
