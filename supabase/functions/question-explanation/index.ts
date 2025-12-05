import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge function para gerar explicações de questões do ENEM usando Groq API
 * Apenas usuários premium têm acesso a esta funcionalidade
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuestionExplanationRequest {
  question: {
    title: string;
    context?: string;
    alternatives: Array<{ letter: string; text: string }>;
    correctAlternative: string;
    discipline: string;
    year: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar cliente Supabase para verificar premium status
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Obter usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se é premium usando a função do banco
    const { data: isPremium, error: premiumError } = await supabase
      .rpc("is_user_premium", { _user_id: user.id });

    if (premiumError) {
      console.error("Erro ao verificar premium:", premiumError);
    }

    if (!isPremium) {
      return new Response(
        JSON.stringify({ error: "Apenas usuários Premium podem acessar as explicações das questões" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse do body da requisição
    const { question }: QuestionExplanationRequest = await req.json();

    if (!question) {
      return new Response(
        JSON.stringify({ error: "Dados da questão são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter chave da Groq
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      console.error("GROQ_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Serviço de IA não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Montar prompt para explicação concisa
    const alternativesText = question.alternatives
      .map((alt) => `${alt.letter.toUpperCase()}) ${alt.text}`)
      .join("\n");

    const prompt = `Questão de ${question.discipline} - ENEM ${question.year}

${question.context ? `Contexto: ${question.context}\n` : ""}Enunciado: ${question.title || ""}

Alternativas:
${alternativesText}

Gabarito: ${question.correctAlternative.toUpperCase()}

Explique de forma CONCISA e CLARA por que a alternativa ${question.correctAlternative.toUpperCase()} está correta. Seja direto ao ponto, fácil de entender. Se possível, dê um macete ou dica prática para lembrar do conceito.`;

    // Chamar API da Groq
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `Você é um professor experiente do ENEM. Suas explicações são CONCISAS, CLARAS e PRÁTICAS.

REGRAS DE FORMATAÇÃO:
- NÃO use markdown (sem #, *, **, etc.)
- NÃO use títulos ou cabeçalhos
- Escreva em texto corrido com parágrafos curtos
- Use linguagem simples e direta
- Máximo 3-4 parágrafos curtos
- Pode dar macetes ou dicas práticas para memorização
- Foque apenas na explicação da resposta correta`
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Erro na API Groq:", groqResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar explicação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqResponse.json();
    const explanation = groqData.choices?.[0]?.message?.content || "Não foi possível gerar a explicação.";

    console.log("Explicação gerada com sucesso para questão:", `${question.year}-${question.discipline}`);

    return new Response(
      JSON.stringify({ explanation }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na função question-explanation:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
