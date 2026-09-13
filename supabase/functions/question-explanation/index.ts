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

    // Montar prompt para uma explicação literal, curta e diretamente ligada à questão
    const alternativesText = safeQuestion.alternatives
      .map((alt) => `${alt.letter.toUpperCase()}) ${alt.text}`)
      .join("\n");

    const prompt = `Questão de ${safeQuestion.discipline} - ENEM ${safeQuestion.year}

${safeQuestion.context ? `Contexto / Texto-base: ${safeQuestion.context}\n` : ""}Enunciado: ${safeQuestion.title || ""}
${safeQuestion.alternativesIntroduction ? `Comando da questão: ${safeQuestion.alternativesIntroduction}\n` : ""}
${safeQuestion.selectedAlternative ? `Resposta escolhida pelo estudante: ${safeQuestion.selectedAlternative.toUpperCase()}\n` : ""}

Alternativas:
${alternativesText}

Gabarito Oficial: ${safeQuestion.correctAlternative.toUpperCase()}
${targetImageUrl ? "\n[Esta questão contém imagem/gráfico em anexo: considere a leitura visual na sua explicação didática]" : ""}

Explique exatamente esta questão, como um professor que acabou de corrigir a resposta do estudante.
Responda como se o estudante tivesse perguntado: "Professor, por que a alternativa correta é essa?".
Organize a aula curta nesta ordem: (1) dê a resposta direta; (2) defina o conceito específico cobrado; (3) mostre a evidência do texto-base ou do comando; (4) conecte essa evidência ao gabarito.
${safeQuestion.selectedAlternative && safeQuestion.selectedAlternative.toUpperCase() !== safeQuestion.correctAlternative.toUpperCase() ? `O estudante marcou ${safeQuestion.selectedAlternative.toUpperCase()}; explique também, sem constrangê-lo, onde essa alternativa se distancia do que o enunciado pede.` : "Se a resposta escolhida estiver correta, confirme o acerto e aprofunde o motivo."}
Seja direto, literal e específico ao texto-base, ao comando e à alternativa correta.
Mencione pelo menos uma evidência concreta do texto-base ou do comando e explique o mecanismo que liga essa evidência ao gabarito. Não apenas repita o texto da alternativa: explique o porquê conceitual da relação.
Nunca responda apenas que a alternativa é "coerente" ou "responde ao comando": diga qual conceito, qual relação e por que ela é correta.
Não dê dicas genéricas de prova, macetes, estratégias de eliminação ou conselhos que poderiam servir para qualquer questão.
Não invente informações que não estejam no enunciado ou no conteúdo necessário para justificar o gabarito.

Responda APENAS com JSON no seguinte formato (sem blocos markdown, apenas o JSON puro):
{
  "concept_summary": "Em 2 ou 3 frases, defina o conceito específico cobrado e explique o mecanismo ou relação causal envolvida nesta questão.",
  "resolution_steps": "Em 2 ou 3 frases, mostre a cadeia lógica entre uma evidência concreta do texto-base, o comando, o conceito e a alternativa correta.",
  "correct_explanation": "Em 3 ou 4 frases, responda como um professor: cite a evidência relevante, nomeie e explique o conceito, e mostre por que a alternativa ${safeQuestion.correctAlternative.toUpperCase()} é correta. Não use justificativas genéricas.",
  "distractors": [
    {
      "letter": "A",
      "trap_explanation": "Explique objetivamente o erro desta alternativa em relação ao enunciado e ao conteúdo da questão."
    }
  ],
  "golden_tip": "Se houver uma observação final, limite-a a uma frase específica sobre esta questão; não escreva um macete genérico."
}`;

    const systemInstruction = "Você é um professor experiente e muito didático de preparação para o ENEM. Sua missão é explicar conceitos com clareza, sanar dúvidas instantaneamente e ensinar a matéria de forma leve, direta e memorável. Responda estritamente com JSON válido.";

    // Estratégia de chamada à Groq com resiliência:
    // 1. Se tem imagem: tenta llama-3.2-11b-vision-preview
    // 2. Fallback / texto puro: llama-3.3-70b-versatile (128k contexto, alta didática)
    // 3. Fallback de cota: llama-3.1-8b-instant (128k contexto, ultra-rápido)
    let groqResponse: Response | null = null;

    // Tentativa 1: Visão se houver imagem
    if (targetImageUrl) {
      try {
        console.log("[question-explanation] Tentando modelo de visão Groq (llama-3.2-11b-vision-preview)...");
        groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.2-11b-vision-preview",
            messages: [
              { role: "system", content: systemInstruction },
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: targetImageUrl } }
                ]
              }
            ],
            max_tokens: 1400,
            temperature: 0.3,
          }),
        });

        if (!groqResponse.ok) {
          console.warn("[question-explanation] Modelo de visão falhou, tentando modelo de texto.");
          groqResponse = null;
        }
      } catch (visionErr) {
        console.warn("[question-explanation] Erro na requisição de visão:", visionErr);
        groqResponse = null;
      }
    }

    // Tentativa 2: llama-3.3-70b-versatile
    if (!groqResponse || !groqResponse.ok) {
      try {
        console.log("[question-explanation] Chamando llama-3.3-70b-versatile...");
        groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: prompt }
            ],
            max_tokens: 1400,
            temperature: 0.3,
          }),
        });
      } catch (e) {
        console.warn("[question-explanation] Erro ao chamar llama-3.3-70b-versatile:", e);
      }
    }

    // Tentativa 3: Se 70b der erro ou rate limit (429), tenta llama-3.1-8b-instant
    if (!groqResponse || !groqResponse.ok) {
      try {
        console.log("[question-explanation] Acionando fallback para llama-3.1-8b-instant...");
        groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: prompt }
            ],
            max_tokens: 1200,
            temperature: 0.3,
          }),
        });
      } catch (e) {
        console.warn("[question-explanation] Erro no fallback llama-3.1-8b-instant:", e);
      }
    }

    let structuredExplanation = null;
    let fallbackText = "";

    if (!groqResponse || !groqResponse.ok) {
      const errorText = groqResponse ? await groqResponse.text() : "Falha geral de rede";
      console.warn("[question-explanation] Groq retornou status não-ok:", groqResponse?.status, errorText, "- ativando fallback pedagógico do ENEM.");
      
      const correctLetter = (question.correctAlternative || "A").toUpperCase();
      const alternatives = question.alternatives || [];
      const correctObj = alternatives.find((a: any) => (a.letter || "").toUpperCase() === correctLetter);
      const correctText = correctObj?.text || "Alternativa correta conforme gabarito oficial.";

      const distractors = alternatives
        .filter((a: any) => (a.letter || "").toUpperCase() !== correctLetter)
        .map((alt: any) => ({
          letter: (alt.letter || "").toUpperCase(),
          trap_explanation: `Esta alternativa afirma "${alt.text?.slice(0, 100)}${alt.text?.length > 100 ? "..." : ""}", mas não explica corretamente o que o comando pergunta.`
        }));

      const contextExcerpt = safeQuestion.context.replace(/\s+/g, " ").trim().slice(0, 220);
      const command = safeQuestion.alternativesIntroduction.replace(/\s+/g, " ").trim();
      structuredExplanation = {
        concept_summary: contextExcerpt
          ? `O texto-base apresenta: "${contextExcerpt}${contextExcerpt.length >= 220 ? "..." : ""}". A questão cobra a relação entre essa situação e o conceito específico indicado nas alternativas.`
          : `A questão cobra ${question.discipline || "o conteúdo"} a partir do comando: "${command}".`,
        resolution_steps: command
          ? `O comando pede: "${command}". Relacionando esse pedido ao texto-base, a alternativa ${correctLetter} é a que apresenta o mecanismo necessário para explicar a situação descrita.`
          : `A alternativa ${correctLetter} é a que apresenta o mecanismo necessário para explicar a situação descrita no texto-base.`,
        correct_explanation: `A alternativa (${correctLetter}) é a correta porque "${correctText}". Essa formulação atende diretamente ao comando${command ? ` "${command}"` : ""} e se relaciona com a situação apresentada no texto-base${contextExcerpt ? `, que descreve "${contextExcerpt.slice(0, 140)}${contextExcerpt.length > 140 ? "..." : ""}"` : ""}.`,
        distractors,
        golden_tip: ""
      };
      fallbackText = structuredExplanation.correct_explanation;
    } else {
      try {
        const groqData = await groqResponse.json();
        const rawContent = typeof groqData.choices?.[0]?.message?.content === "string"
          ? groqData.choices[0].message.content
          : "";

        fallbackText = rawContent;

        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          structuredExplanation = JSON.parse(jsonMatch[0]);
          fallbackText = `${structuredExplanation.correct_explanation || ""}`;
        }
      } catch (parseErr) {
        console.warn("[question-explanation] Resposta inválida do provedor; usando fallback literal:", parseErr);
        const correctLetter = safeQuestion.correctAlternative.toUpperCase();
        const correctObj = safeQuestion.alternatives.find((alt) => alt.letter.toUpperCase() === correctLetter);
        const correctText = correctObj?.text || "a alternativa indicada no gabarito oficial";
        structuredExplanation = {
          concept_summary: `A questão avalia ${safeQuestion.discipline} a partir do texto apresentado.`,
          resolution_steps: `O enunciado deve ser relacionado diretamente ao conceito cobrado. A alternativa ${correctLetter} é a que responde ao comando.`,
          correct_explanation: `A alternativa (${correctLetter}) é a correta porque "${correctText}" responde diretamente ao que a questão pergunta.`,
          distractors: [],
          golden_tip: "",
        };
        fallbackText = structuredExplanation.correct_explanation;
      }
    }

    console.log("[question-explanation] Explicação gerada com sucesso para questão:", `${question.year}-${question.discipline}`);

    return new Response(
      JSON.stringify({ 
        explanation: fallbackText,
        structuredExplanation 
      }),
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
