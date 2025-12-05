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

    // Montar prompt para explicação detalhada
    const alternativesText = question.alternatives
      .map((alt) => `${alt.letter.toUpperCase()}) ${alt.text}`)
      .join("\n");

    const prompt = `Você é um professor experiente e didático especializado em preparação para o ENEM. Explique DETALHADAMENTE por que a alternativa "${question.correctAlternative.toUpperCase()}" é a resposta correta.

## QUESTÃO (${question.discipline} - ENEM ${question.year}):

${question.context ? `**Contexto/Texto de apoio:**\n${question.context}\n` : ""}
**Enunciado:** ${question.title || ""}

**Alternativas:**
${alternativesText}

**Gabarito:** ${question.correctAlternative.toUpperCase()}

## INSTRUÇÕES PARA SUA EXPLICAÇÃO:

1. **ANÁLISE DA QUESTÃO**: Comece identificando o que a questão está pedindo e qual conhecimento está sendo avaliado.

2. **EXPLICAÇÃO DA RESPOSTA CORRETA**: Explique de forma clara e didática POR QUE a alternativa ${question.correctAlternative.toUpperCase()} está correta. Use exemplos, contextualize historicamente/cientificamente se necessário.

3. **ANÁLISE DAS ALTERNATIVAS INCORRETAS**: Explique brevemente por que CADA uma das outras alternativas está errada (1-2 frases por alternativa).

4. **DICA DE ESTUDO**: Finalize com uma dica prática sobre o tema ou conceito abordado para ajudar o estudante a fixar o conteúdo.

Seja didático, use linguagem acessível, e ajude o estudante a realmente ENTENDER o conteúdo, não apenas memorizar a resposta.`;

    // Chamar API da Groq com modelo mais capaz
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
            content: "Você é um professor experiente do ENEM, conhecido por explicações claras e didáticas. Você ajuda estudantes a entenderem profundamente os conceitos, não apenas decorar respostas. Suas explicações são completas, organizadas e fáceis de seguir."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.4,
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
