import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function para analisar dificuldade de questões ENEM via IA (Groq)
 * Classifica questões como: easy, medium, hard
 * Salva resultado no banco para cache permanente
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questionId, discipline, context, title, alternatives } = await req.json();

    // Valida dados obrigatórios
    if (!questionId) {
      return new Response(
        JSON.stringify({ error: "questionId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "API key não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Monta o texto da questão para análise
    const questionText = [
      context && `Contexto: ${context}`,
      title && `Enunciado: ${title}`,
      alternatives && `Alternativas: ${JSON.stringify(alternatives)}`,
    ].filter(Boolean).join("\n\n");

    // Prompt para classificação de dificuldade
    const prompt = `Você é um especialista em questões do ENEM. Analise a questão abaixo e classifique sua dificuldade.

CRITÉRIOS DE CLASSIFICAÇÃO:
- EASY (Fácil): Questões diretas, interpretação simples, conceitos básicos, poucos passos de raciocínio
- MEDIUM (Médio): Exigem interpretação moderada, aplicação de conceitos, raciocínio em 2-3 etapas
- HARD (Difícil): Interpretação complexa, múltiplos conceitos integrados, raciocínio abstrato, várias etapas

DISCIPLINA: ${discipline || "Geral"}

QUESTÃO:
${questionText}

Responda APENAS com uma das palavras: easy, medium ou hard
Nada mais, apenas a classificação.`;

    // Chama a API da Groq
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1, // Baixa temperatura para respostas consistentes
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro Groq API:", errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao analisar dificuldade" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawDifficulty = data.choices?.[0]?.message?.content?.trim().toLowerCase() || "";
    
    // Normaliza a resposta para garantir valor válido
    let difficulty: "easy" | "medium" | "hard" = "medium"; // Default
    if (rawDifficulty.includes("easy") || rawDifficulty.includes("fácil")) {
      difficulty = "easy";
    } else if (rawDifficulty.includes("hard") || rawDifficulty.includes("difícil")) {
      difficulty = "hard";
    } else if (rawDifficulty.includes("medium") || rawDifficulty.includes("médio")) {
      difficulty = "medium";
    }

    // Salva a dificuldade no banco de dados
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabase
      .from("enem_questions")
      .update({ difficulty })
      .eq("id", questionId);

    if (updateError) {
      console.error("Erro ao salvar dificuldade:", updateError);
      // Retorna a dificuldade mesmo se falhar o save (cache local pode usar)
    } else {
      console.log(`Dificuldade ${difficulty} salva para questão ${questionId}`);
    }

    return new Response(
      JSON.stringify({ difficulty, saved: !updateError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});