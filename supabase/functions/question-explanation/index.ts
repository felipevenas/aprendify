import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge function para gerar explicações de questões do ENEM usando Groq API
 * Apenas usuários premium têm acesso a esta funcionalidade
 * Rate limited to prevent API quota exhaustion
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration - more generous for premium users
const RATE_LIMIT_MAX_CALLS = 30; // 30 explanations per hour
const RATE_LIMIT_WINDOW_MINUTES = 60;

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    console.log("[question-explanation] Authenticated user:", user.id);

    // Verificar se é premium usando a função do banco
    const { data: isPremium, error: premiumError } = await supabase
      .rpc("is_user_premium", { _user_id: user.id });

    if (premiumError) {
      console.error("[question-explanation] Erro ao verificar premium:", premiumError);
    }

    if (!isPremium) {
      return new Response(
        JSON.stringify({ error: "Apenas usuários Premium podem acessar as explicações das questões" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit using service role client
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: rateLimitAllowed, error: rateLimitError } = await supabaseService
      .rpc("check_rate_limit", {
        _user_id: user.id,
        _function_name: "question-explanation",
        _max_calls: RATE_LIMIT_MAX_CALLS,
        _window_minutes: RATE_LIMIT_WINDOW_MINUTES,
      });

    if (rateLimitError) {
      console.error("[question-explanation] Rate limit check error:", rateLimitError);
      // Continue anyway if rate limit check fails
    } else if (!rateLimitAllowed) {
      console.log("[question-explanation] Rate limit exceeded for user:", user.id);
      return new Response(
        JSON.stringify({ 
          error: "Limite de explicações atingido. Tente novamente em 1 hora.",
          rateLimited: true 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      console.error("[question-explanation] GROQ_API_KEY não configurada");
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

REGRAS DE FORMATAÇÃO OBRIGATÓRIAS:
- A explicação deve ter EXATAMENTE 2 parágrafos curtos (3-5 frases por parágrafo)
- Use **texto em negrito** para destacar conceitos importantes, palavras-chave e termos técnicos
- Separe os 2 parágrafos com uma linha em branco
- Use linguagem simples e direta
- Pode dar um macete ou dica prática para memorização (destaque em negrito)
- Foque na explicação da resposta correta

ESTRUTURA OBRIGATÓRIA (2 PARÁGRAFOS):
1. Primeiro parágrafo: Explique o conceito central e por que a alternativa correta está certa
2. Segundo parágrafo: Macete ou dica prática para memorização OU erros comuns a evitar`
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 400,
        temperature: 0.3,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("[question-explanation] Erro na API Groq:", groqResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar explicação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqResponse.json();
    const explanation = groqData.choices?.[0]?.message?.content || "Não foi possível gerar a explicação.";

    console.log("[question-explanation] Explicação gerada com sucesso para questão:", `${question.year}-${question.discipline}`);

    return new Response(
      JSON.stringify({ explanation }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[question-explanation] Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
