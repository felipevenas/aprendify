import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Edge function para extrair o tópico específico de uma questão do ENEM usando IA
 * 
 * Recebe: discipline, context, title, alternatives
 * Retorna: topic (string concisa com max 50 caracteres)
 * 
 * Usado para:
 * - Identificar assuntos que precisam de atenção
 * - Popular o cronograma de estudos gerado por IA
 * - Exibir estatísticas detalhadas por tópico
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lista de tópicos válidos por disciplina para padronização
const TOPIC_EXAMPLES: Record<string, string[]> = {
  "linguagens": ["Interpretação de Texto", "Gêneros Textuais", "Variação Linguística", "Modernismo", "Arcadismo", "Romantismo", "Realismo", "Trovadorismo", "Barroco", "Figuras de Linguagem", "Morfologia", "Sintaxe", "Semântica", "Intertextualidade", "Literatura Contemporânea"],
  "matematica": ["Porcentagem", "Funções", "Geometria Plana", "Geometria Espacial", "Estatística", "Probabilidade", "Análise Combinatória", "Progressões", "Logaritmos", "Trigonometria", "Equações", "Sistemas Lineares", "Matrizes", "Razão e Proporção"],
  "ciencias-humanas": ["Brasil Colônia", "Brasil Império", "Era Vargas", "Ditadura Militar", "Revolução Francesa", "Revolução Industrial", "Guerra Fria", "Primeira Guerra", "Segunda Guerra", "Urbanização", "Meio Ambiente", "Globalização", "Movimentos Sociais", "Cidadania", "Filosofia Política", "Ética", "Cultura Afro-Brasileira", "Povos Indígenas"],
  "ciencias-natureza": ["Termodinâmica", "Mecânica", "Eletricidade", "Óptica", "Ondas", "Cinemática", "Genética", "Ecologia", "Citologia", "Fisiologia Humana", "Evolução", "Biomas", "Química Orgânica", "Estequiometria", "Equilíbrio Químico", "Eletroquímica", "Soluções", "Reações Químicas"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { discipline, context, title, alternatives } = await req.json();

    if (!discipline) {
      console.error("[extract-question-topic] Disciplina não fornecida");
      return new Response(
        JSON.stringify({ error: "Disciplina é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      console.error("[extract-question-topic] GROQ_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Monta o texto da questão para análise (limita para economizar tokens)
    const questionText = [
      context || "",
      title || "",
      alternatives ? alternatives.map((a: any) => a.text).join(" ").substring(0, 300) : ""
    ].filter(Boolean).join("\n").substring(0, 1200);

    // Obtém exemplos de tópicos para a disciplina
    const topicExamples = TOPIC_EXAMPLES[discipline] || TOPIC_EXAMPLES["ciencias-humanas"];

    console.log(`[extract-question-topic] Extraindo tópico para disciplina: ${discipline}`);

    const prompt = `Analise esta questão do ENEM e identifique o ASSUNTO ESPECÍFICO.

QUESTÃO:
${questionText}

DISCIPLINA: ${discipline}

EXEMPLOS DE TÓPICOS VÁLIDOS: ${topicExamples.slice(0, 10).join(", ")}

REGRAS CRÍTICAS:
1. Retorne APENAS o nome do assunto (2-4 palavras no máximo)
2. Use termos PADRONIZADOS do ensino médio brasileiro
3. NÃO copie trechos da questão
4. NÃO inclua explicações ou pontuação extra
5. Seja ESPECÍFICO (ex: "Genética Mendeliana" e não apenas "Biologia")

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
            content: "Você é um classificador de questões do ENEM. Responda SEMPRE com 2-4 palavras identificando o assunto específico. NUNCA copie trechos da questão. Use termos padronizados como: Termodinâmica, Genética, Era Vargas, Interpretação de Texto, etc."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 30,
        temperature: 0.2,
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
    topic = topic
      .replace(/^["']|["']$/g, "")  // Remove aspas
      .replace(/\.$/, "")           // Remove ponto final
      .replace(/^(Assunto:|Tópico:)\s*/i, "") // Remove prefixos
      .replace(/\n.*/g, "")         // Remove linhas extras
      .trim();
    
    // Limita o tamanho para evitar contextos longos serem salvos
    if (topic.length > 50) {
      // Tenta pegar apenas as primeiras palavras significativas
      const words = topic.split(" ").slice(0, 4);
      topic = words.join(" ");
      if (topic.length > 50) {
        topic = topic.substring(0, 47) + "...";
      }
    }

    // Valida se o tópico parece válido (não é um texto longo)
    if (topic.length < 3 || topic.split(" ").length > 6) {
      console.warn(`[extract-question-topic] Tópico inválido detectado: "${topic.substring(0, 50)}..."`);
      topic = "Tópico não identificado";
    }

    console.log(`[extract-question-topic] Tópico extraído com sucesso: "${topic}"`);

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
