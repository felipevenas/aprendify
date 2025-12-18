import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { discipline, context, title, alternatives } = await req.json();

    if (!discipline) {
      return new Response(
        JSON.stringify({ error: "Disciplina é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Monta o texto da questão para análise
    const questionText = [
      context || "",
      title || "",
      alternatives ? alternatives.map((a: any) => a.text).join(" ") : ""
    ].filter(Boolean).join("\n").substring(0, 1500); // Limita para economizar tokens

    console.log(`[extract-question-topic] Extraindo tópico para disciplina: ${discipline}`);

    const prompt = `Analise esta questão do ENEM da disciplina "${discipline}" e identifique o ASSUNTO ESPECÍFICO abordado.

QUESTÃO:
${questionText}

REGRAS:
- Retorne APENAS o nome do assunto específico (ex: "Termodinâmica", "Revolução Industrial", "Funções Exponenciais", "Genética Mendeliana", "Interpretação de Texto")
- Seja específico mas conciso (máximo 4 palavras)
- Use termos comuns do ensino médio brasileiro
- NÃO inclua explicações, apenas o nome do assunto

ASSUNTO:`;

    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
            content: "Você é um especialista em educação do ENEM. Responda APENAS com o nome do assunto específico, sem explicações."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 50,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[extract-question-topic] Groq API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao extrair tópico" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    let topic = aiData.choices?.[0]?.message?.content?.trim() || "";
    
    // Limpa o tópico de possíveis caracteres extras
    topic = topic.replace(/^["']|["']$/g, "").replace(/\.$/, "").trim();
    
    // Limita o tamanho
    if (topic.length > 100) {
      topic = topic.substring(0, 100);
    }

    console.log(`[extract-question-topic] Tópico extraído: ${topic}`);

    return new Response(
      JSON.stringify({ topic }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[extract-question-topic] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
