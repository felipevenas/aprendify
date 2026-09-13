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
    alternativesIntroduction?: string;
    context?: string;
    alternatives: Array<{ letter: string; text: string }>;
    correctAlternative: string;
    selectedAlternative?: string;
    discipline: string;
    year: string;
    files?: string[];
    images?: string[];
  };
}

serve(async (req) => {
  // Handle CORS preflight
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
  if (contentLength > 128 * 1024) {
    return new Response(JSON.stringify({ error: "Requisição muito grande" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Verificar autenticação do usuário
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) {
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
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Obter usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User authenticated successfully

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
      return new Response(
        JSON.stringify({ error: "Controle de uso temporariamente indisponível" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
    const payload = await req.json();
    const question = payload?.question as QuestionExplanationRequest["question"] | undefined;

    if (
      !question ||
      typeof question !== "object" ||
      typeof question.title !== "string" ||
      !Array.isArray(question.alternatives) ||
      typeof question.correctAlternative !== "string"
    ) {
      return new Response(
        JSON.stringify({ error: "Dados da questão são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeQuestion = {
      ...question,
      discipline: typeof question.discipline === "string" ? question.discipline : "ENEM",
      year: typeof question.year === "string" ? question.year : "",
      context: typeof question.context === "string" ? question.context.slice(0, 10000) : "",
      alternativesIntroduction: typeof question.alternativesIntroduction === "string"
        ? question.alternativesIntroduction.slice(0, 4000)
        : "",
      alternatives: question.alternatives
        .filter((alt) => alt && typeof alt.letter === "string" && typeof alt.text === "string")
        .slice(0, 5),
    };

    // Obter chave da Groq
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      console.error("[question-explanation] GROQ_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Serviço de IA não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Identificar imagem na questão (se houver)
    const imageCandidates: string[] = [];
    if (Array.isArray(question.files)) {
      question.files.forEach((f) => {
        if (typeof f === "string" && f.match(/^https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i)) {
          imageCandidates.push(f);
        }
      });
    }
    if (Array.isArray(question.images)) {
      question.images.forEach((img) => {
        if (typeof img === "string" && img.startsWith("http")) imageCandidates.push(img);
      });
    }
    if (question.context) {
      const matchUrls = question.context.match(/https?:\/\/[^\s\)\"']+\.(?:png|jpg|jpeg|webp|gif)/gi);
      if (matchUrls) {
        imageCandidates.push(...matchUrls);
      }
    }
    const targetImageUrl = imageCandidates.length > 0 ? imageCandidates[0] : null;

    const alternativesText = safeQuestion.alternatives
      .map((alt) => `${alt.letter.toUpperCase()}) ${alt.text}`)
      .join("\n");

    const prompt = `Questão de ${safeQuestion.discipline} - ENEM ${safeQuestion.year}

${safeQuestion.context ? `Contexto / texto-base: ${safeQuestion.context}\n` : ""}Enunciado: ${safeQuestion.title || ""}
${safeQuestion.alternativesIntroduction ? `Comando: ${safeQuestion.alternativesIntroduction}\n` : ""}

Alternativas:
${alternativesText}

Gabarito: ${safeQuestion.correctAlternative.toUpperCase()}

Explique como um professor ou aluno experiente escreveria um comentário de resolução para outra pessoa aprender.
O objetivo principal é ensinar POR QUE a alternativa ${safeQuestion.correctAlternative.toUpperCase()} é correta, usando o conhecimento necessário para resolver a questão.
Primeiro identifique o conceito, regra, definição, fórmula, cálculo, evidência histórica, mecanismo biológico, fenômeno físico ou relação causal que determina a resposta. Depois aplique esse conhecimento passo a passo à questão e conclua mostrando por que ele leva à alternativa ${safeQuestion.correctAlternative.toUpperCase()}.
Não apenas diga que a alternativa "se relaciona com o enunciado", "atende ao comando", "é coerente" ou "responde à pergunta". Isso é insuficiente. Explique o conteúdo que torna a alternativa verdadeira.
Por exemplo, em "Quanto é 2 + 2?", explique que o sinal + representa adição e que adicionar duas unidades a outras duas unidades resulta em 4; não diga apenas que a alternativa 4 corresponde ao enunciado.
Se houver um texto-base, use-o como evidência complementar, mas não substitua a explicação do conteúdo pelo texto-base. Se a questão exigir cálculo, faça o cálculo; se exigir uma definição, dê a definição; se exigir causa e consequência, explique o mecanismo; se exigir interpretação, explique o sentido da passagem que sustenta a resposta.
Seja conciso, claro e didático, em no máximo 4 ou 5 frases. Não analise as alternativas erradas, não dê macetes e não inclua estratégias genéricas de prova.${targetImageUrl ? " Considere também a imagem ou gráfico anexado, se necessário para explicar o conceito." : ""}`;

    const systemInstruction = `Você é um professor experiente de ENEM e concursos, conhecido por escrever comentários de resolução que realmente ensinam o conteúdo.

REGRAS:
- Ensine o conceito, regra, definição, fórmula ou mecanismo que torna a alternativa correta verdadeira.
- Resolva mentalmente a questão e explique o raciocínio essencial passo a passo.
- Diga explicitamente o significado dos símbolos, termos e relações usados quando isso for necessário para entender a resposta.
- Uma justificativa circular é proibida: nunca diga apenas que a alternativa é coerente, se relaciona com o texto ou atende ao comando.
- O texto-base é evidência, não a explicação em si. Não substitua o conteúdo cobrado por um resumo do texto-base.
- Use no máximo 4 ou 5 frases curtas, em linguagem simples e didática.
- Não analise distratores, não dê macetes e não inclua dicas genéricas de prova.
- Responda somente com o texto da explicação, sem JSON, títulos ou preâmbulos.`;

    let groqResponse: Response | null = null;
    if (targetImageUrl) {
      try {
        groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.2-11b-vision-preview",
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: targetImageUrl } }] }
            ],
            max_tokens: 500,
            temperature: 0.3,
          }),
        });
        if (!groqResponse.ok) groqResponse = null;
      } catch (visionErr) {
        console.warn("[question-explanation] Modelo de visão indisponível:", visionErr);
        groqResponse = null;
      }
    }

    if (!groqResponse) {
      groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: systemInstruction }, { role: "user", content: prompt }],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });
    }

    // Mantém a resiliência da implementação original quando o modelo principal
    // estiver indisponível ou atingir limite de cota.
    if (!groqResponse.ok) {
      console.warn("[question-explanation] Modelo principal indisponível; usando fallback 8B.");
      groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: systemInstruction }, { role: "user", content: prompt }],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });
    }

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("[question-explanation] Erro na API Groq:", groqResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar explicação" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const groqData = await groqResponse.json();
    const explanation = groqData.choices?.[0]?.message?.content?.trim() || "Não foi possível gerar a explicação.";

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
