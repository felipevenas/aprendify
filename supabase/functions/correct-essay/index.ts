import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { ApiError, errorResponse, jsonResponse, readJsonObject } from "../_shared/api.ts";
import { consumeRateLimit, rateLimitHeaders } from "../_shared/rate-limit.ts";

/**
 * Edge function para corrigir redações no padrão ENEM usando Groq API
 * Free: 1 redação/mês | Premium: 12 redações/mês
 * Rate limited to prevent API quota exhaustion
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Limites de redações por tipo de usuário
// Rate limit configuration (in addition to monthly limits)
const RATE_LIMIT_MAX_CALLS = 3; // 3 corrections per hour max
const RATE_LIMIT_WINDOW_MINUTES = 60;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 12_000;

// Prompt detalhado com rubrica oficial do ENEM e múltiplos exemplos de calibração
const ENEM_RUBRIC_PROMPT = `Você é um corretor OFICIAL de redações do ENEM com 15+ anos de experiência na banca. Sua missão é avaliar redações com PRECISÃO e JUSTIÇA, reconhecendo textos de alta qualidade quando apresentados.

## IMPORTANTE - CALIBRAÇÃO DA AVALIAÇÃO
- NÃO seja excessivamente rigoroso. O ENEM premia boas redações.
- Redações bem escritas, com repertório diversificado e proposta completa MERECEM notas altas (160-200 por competência).
- Reserve notas baixas (0-80) apenas para textos com problemas GRAVES e EVIDENTES.
- Na DÚVIDA entre duas notas, escolha a MAIOR se o texto demonstra esforço e qualidade.

## CRITÉRIOS DE AVALIAÇÃO (RUBRICA OFICIAL)

### COMPETÊNCIA 1: Domínio da norma culta
- 200 pts: Excelente domínio. Até 2 desvios gramaticais LEVES (acentuação, crase). MAIORIA dos textos bem escritos merece 160-200.
- 160 pts: Bom domínio. 3-5 desvios leves que NÃO comprometem a leitura.
- 120 pts: Domínio mediano. 6-8 desvios, alguns que afetam a clareza.
- 80 pts: Domínio insuficiente. Muitos desvios que DIFICULTAM a leitura.
- 40 pts: Domínio precário. Texto quase incompreensível.
- 0 pts: Desconhecimento total.

### COMPETÊNCIA 2: Compreensão do tema e repertório sociocultural
- 200 pts: Tema desenvolvido com repertório PRODUTIVO (citações, dados, referências culturais/históricas/filosóficas BEM ARTICULADAS com a argumentação). Não precisa ser enciclopédico - 2-3 referências BEM USADAS bastam.
- 160 pts: Bom desenvolvimento com repertório adequado.
- 120 pts: Repertório limitado ou previsível (senso comum predominante).
- 80 pts: Tangencia o tema ou copia textos motivadores.
- 40 pts: Fuga parcial do tema.
- 0 pts: Fuga total ou não dissertativo.

### COMPETÊNCIA 3: Organização e argumentação
- 200 pts: Argumentos CONSISTENTES e BEM ARTICULADOS. Estrutura clara (intro-desenvolvimento-conclusão). Progressão lógica.
- 160 pts: Boa argumentação com pequenas inconsistências.
- 120 pts: Argumentos previsíveis ou pouco desenvolvidos.
- 80 pts: Argumentação fraca ou repetitiva.
- 40 pts: Informações desconexas.
- 0 pts: Sem ponto de vista.

### COMPETÊNCIA 4: Coesão textual
- 200 pts: Repertório DIVERSIFICADO de conectivos SEM inadequações. Não precisa usar 20 conectivos diferentes - uso CORRETO e VARIADO de 8-10 conectivos é suficiente.
- 160 pts: Bom repertório com poucas inadequações.
- 120 pts: Repertório pouco diversificado (repete os mesmos conectivos).
- 80 pts: Repertório limitado, inadequações frequentes.
- 40 pts: Articulação precária.
- 0 pts: Ausência de articulação.

### COMPETÊNCIA 5: Proposta de intervenção
OS 5 ELEMENTOS:
1. AÇÃO: O que será feito?
2. AGENTE: Quem fará? (Governo, escolas, mídia, sociedade, etc.)
3. MODO/MEIO: Como será feito?
4. EFEITO: Qual o resultado esperado?
5. DETALHAMENTO: Especificação de qualquer elemento acima.

- 200 pts: Proposta COMPLETA com 5 elementos CLARAMENTE identificáveis. O detalhamento pode estar implícito se um elemento é bem desenvolvido.
- 160 pts: 4 elementos claros.
- 120 pts: 3 elementos.
- 80 pts: 2 elementos.
- 40 pts: 1 elemento.
- 0 pts: Sem proposta ou viola direitos humanos.

## EXEMPLOS DE CALIBRAÇÃO

### EXEMPLO 1 - NOTA 1000 (REFERÊNCIA MÁXIMA)
TEMA: Desafios para a valorização da herança africana no Brasil

"O álbum musical "Duas Cidades", da banda brasileira Baiana System, aborda, em algumas de suas canções, o apagamento da influência histórica africana no Brasil. Inegavelmente, em dias atuais, é possível constatar uma relação direta entre a composição artística citada e a desvalorização da herança africana no país. Isso é explicado devido à falta de política pública de ensino e à ausência de lei específica. Logo, é essencial analisar e intervir sobre essa problemática.

A princípio, deve-se observar que o pouco fomento governamental em ações de gestão educacional é um problema a ser combatido. Sob a perspectiva de Macaé Evaristo, ministra dos Direitos Humanos, é urgente a necessidade de iniciativas para a inclusão da história e da cultura afro-brasileira nas escolas. Para entender melhor tal posicionamento, é importante compreender que o atual ensino sobre os povos africanos é apenas relatado em aulas específicas de algumas disciplinas, como história e literatura, sem se aprofundar na grande influência cultural que a África possui no Brasil. Dessa forma, de acordo com Chico César, cantor e compositor de músicas afro-brasileiras, as crianças e os adolescentes necessitam ter uma formação ampla sobre a temática, com aulas multidisciplinares, por exemplo, de música e de capoeira, bem como as tradicionais aulas já existentes, porém integradas à herança africana presente na sociedade. Nesse sentido, é substancial modificar esse contexto e desenvolver uma forte política pública de ensino.

Ademais, é imperativo pontuar que atitude insuficiente do Poder Legislativo Federal em atuar no tema é um problema a ser combatido. Sob a ótica de Duda Salabert, deputada federal e professora de literatura, é imprescindível a alteração da lei que orienta a educação básica brasileira. Isso pode ser explicado pelo entendimento de que apenas com empenho legislativo é possível transformar o mecanismo legal que define as matrizes de referência do ensino nacional. Dessa maneira, com a união de parlamentares para o reconhecimento da importância da herança africana na formação educacional, poderá ocorrer a consolidação de políticas públicas, como o investimento da capacitação de professores e de profissionais especializados em cultura afro-brasileira. Assim, o crescimento do fomento estatal no setor, garantido por aparato legal, contribuirá para a efetivação de uma forte identidade nacional. Em suma, se o Congresso Nacional se omite de enfrentar tal cenário danoso, entende-se o porquê de sua perpetuação.

Portanto, com o intuito de solucionar esses desafios, o Poder Executivo Federal, por meio do aumento de ações governamentais, deve estimular iniciativas educacionais relacionadas à herança africana, a fim de valorizar a temática. Além disso, o Poder Legislativo Federal, por intermédio da criação de um projeto de lei, necessita elaborar uma nova política nacional de ensino, com a obrigatoriedade de investimento público na área, com a definição de medidas de gestão pública capazes de instituir aulas multidisciplinares, como de música e de cultura afro-brasileira nas escolas, com o objetivo de reconhecer a importância do tema na formação da sociedade."

AVALIAÇÃO: C1=200, C2=200, C3=200, C4=200, C5=200 (TOTAL: 1000)
- C1: Excelente domínio, sem erros significativos
- C2: Repertório diversificado e produtivo (Baiana System, Macaé Evaristo, Chico César, Duda Salabert)
- C3: Argumentação sólida com progressão clara
- C4: Conectivos variados e bem empregados
- C5: Proposta completa (Agente: Executivo+Legislativo, Ação: estimular iniciativas+criar lei, Modo: aulas multidisciplinares, Efeito: valorizar temática, Detalhamento: música e cultura)

### EXEMPLO 2 - NOTA 920-960 (EXCELENTE)
Redação com:
- Excelente escrita (C1: 200)
- Bom repertório, talvez um pouco menos diversificado (C2: 160-200)
- Ótima argumentação (C3: 200)
- Boa coesão (C4: 160-200)
- Proposta com 4-5 elementos (C5: 160-200)

### EXEMPLO 3 - NOTA 800-880 (BOM)
Redação com:
- Boa escrita com alguns desvios (C1: 160)
- Repertório adequado mas previsível (C2: 160)
- Argumentação sólida (C3: 160-200)
- Coesão adequada (C4: 160)
- Proposta razoável com 3-4 elementos (C5: 120-160)

### EXEMPLO 4 - NOTA 600-760 (MEDIANO)
Redação com:
- Vários desvios gramaticais (C1: 120)
- Repertório baseado em senso comum (C2: 120)
- Argumentos superficiais (C3: 120)
- Conectivos repetitivos (C4: 120)
- Proposta incompleta (C5: 80-120)

## FORMATO DA RESPOSTA
Responda APENAS com JSON válido (sem markdown), seguindo EXATAMENTE esta estrutura:
{
  "score_competency_1": <0|40|80|120|160|200>,
  "score_competency_2": <0|40|80|120|160|200>,
  "score_competency_3": <0|40|80|120|160|200>,
  "score_competency_4": <0|40|80|120|160|200>,
  "score_competency_5": <0|40|80|120|160|200>,
  "feedback_competency_1": "<análise específica de C1>",
  "feedback_competency_2": "<análise de C2>",
  "feedback_competency_3": "<análise de C3>",
  "feedback_competency_4": "<análise de C4>",
  "feedback_competency_5": "<análise de C5>",
  "intervention_checklist": {
    "agent": { "present": true, "snippet": "<trecho do agente citado>", "feedback": "<avaliação do agente>" },
    "action": { "present": true, "snippet": "<trecho da ação proposta>", "feedback": "<avaliação da ação>" },
    "mode": { "present": true, "snippet": "<trecho do meio/modo>", "feedback": "<avaliação do meio>" },
    "effect": { "present": true, "snippet": "<trecho do efeito/finalidade>", "feedback": "<avaliação do efeito>" },
    "detail": { "present": true, "snippet": "<trecho do detalhamento>", "feedback": "<avaliação do detalhamento>" }
  },
  "annotated_snippets": [
    {
      "competency": 1,
      "type": "grammar_error",
      "snippet": "<trecho exato presente na redação com desvio ou destaque>",
      "suggestion": "<sugestão de correção se aplicável>",
      "explanation": "<explicação pedagógica pontual do corretor>"
    },
    {
      "competency": 2,
      "type": "repertoire",
      "snippet": "<trecho exato com citação ou repertório sociocultural>",
      "explanation": "<comentário sobre a legitimidade e produtividade do repertório>"
    },
    {
      "competency": 4,
      "type": "connective",
      "snippet": "<trecho exato com conectivo inter ou intraparágrafo>",
      "explanation": "<avaliação da coesão e variedade conectiva>"
    },
    {
      "competency": 5,
      "type": "intervention",
      "snippet": "<trecho exato da proposta de intervenção social>",
      "explanation": "<destaque do elemento de intervenção identificado>"
    }
  ],
  "strengths": "<2-3 pontos fortes da redação>",
  "weaknesses": "<2-3 pontos a melhorar, SE houver>",
  "tips": "<3 dicas práticas para melhorar>"
}`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let addonCreditConsumed = false;
  let addonIdempotencyKey: string | null = null;
  let authenticated: Awaited<ReturnType<typeof authenticateRequest>> | null = null;

  try {
    const auth = await authenticateRequest(req, corsHeaders);
    authenticated = auth;
    const body = await readJsonObject(req, MAX_BODY_BYTES);
    const title = body.title;
    const content = body.content;
    if (typeof title !== "string" || typeof content !== "string" || !title.trim() || !content.trim()) {
      throw new ApiError(400, "INVALID_ESSAY", "Título e conteúdo são obrigatórios");
    }
    if (title.length > MAX_TITLE_LENGTH || content.length > MAX_CONTENT_LENGTH) {
      throw new ApiError(413, "ESSAY_TOO_LARGE", "Redação excede o limite permitido");
    }
    if (content.length < 200) throw new ApiError(400, "ESSAY_TOO_SHORT", "A redação deve ter pelo menos 200 caracteres");

    const rateLimit = await consumeRateLimit(auth.serviceClient, req, auth.user.id, "correct-essay", RATE_LIMIT_MAX_CALLS, RATE_LIMIT_WINDOW_MINUTES);
    if (!rateLimit.allowed) return jsonResponse({ error: "Limite de correções por hora atingido. Tente novamente em breve.", code: "RATE_LIMITED", rateLimited: true }, 429, corsHeaders, rateLimitHeaders(rateLimit));
    const responseHeaders = { ...corsHeaders, ...rateLimitHeaders(rateLimit) };

    // Obter chave da Groq
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) throw new ApiError(503, "AI_UNAVAILABLE", "Serviço de IA temporariamente indisponível");

    const suppliedIdempotencyKey = req.headers.get("idempotency-key")?.trim() || null;
    if (suppliedIdempotencyKey && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(suppliedIdempotencyKey)) {
      throw new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "Chave de idempotência inválida");
    }
    addonIdempotencyKey = suppliedIdempotencyKey ?? crypto.randomUUID();

    // Prefer the purchased Combo credit. An infrastructure error fails closed
    // instead of falling through and leaving the credit available for later.
    const { data: addonCredit, error: addonCreditError } = await auth.serviceClient.rpc("consume_essay_addon_credit", {
      _user_id: auth.user.id,
      _idempotency_key: addonIdempotencyKey,
    });
    if (addonCreditError || !addonCredit) {
      throw new ApiError(503, "ADD_ON_CREDIT_UNAVAILABLE", "Crédito do Combo temporariamente indisponível");
    }
    const addonCreditResult = Array.isArray(addonCredit) ? addonCredit[0] : addonCredit;
    if (!addonCreditResult || typeof addonCreditResult.consumed !== "boolean") {
      throw new ApiError(503, "ADD_ON_CREDIT_UNAVAILABLE", "Crédito do Combo temporariamente indisponível");
    }
    addonCreditConsumed = addonCreditResult.consumed;

    let remainingEssays: number | null = null;
    if (!addonCreditConsumed) {
      const { data: quota, error: quotaError } = await auth.serviceClient.rpc("consume_essay_quota", { _user_id: auth.user.id });
      if (quotaError || !quota) throw new ApiError(503, "QUOTA_UNAVAILABLE", "Controle de quota temporariamente indisponível");
      const quotaResult = Array.isArray(quota) ? quota[0] : quota;
      if (!quotaResult || typeof quotaResult.allowed !== "boolean") throw new ApiError(503, "QUOTA_UNAVAILABLE", "Controle de quota temporariamente indisponível");
      if (!quotaResult.allowed) return jsonResponse({
        error: `Você atingiu o limite de ${quotaResult.quota_limit ?? 1} redação(ões) por mês.`,
        code: "ESSAY_QUOTA_EXCEEDED",
        limitReached: true,
        quotaLimit: quotaResult.quota_limit ?? 1,
        currentCount: quotaResult.used_count ?? quotaResult.quota_limit ?? 1,
      }, 403, responseHeaders);
      remainingEssays = Number(quotaResult.remaining ?? 0);
    }

    // Prompt do usuário com a redação
    const userPrompt = `TEMA DA REDAÇÃO: ${title}

REDAÇÃO DO ALUNO:
${content}

Corrija esta redação seguindo a rubrica ENEM. Seja JUSTO: reconheça qualidade quando presente. Analise cada competência cuidadosamente antes de atribuir a nota.`;

    // Chamar API da Groq
    console.log("[correct-essay] requesting AI correction");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    let groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: ENEM_RUBRIC_PROMPT
          },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 2500,
        temperature: 0.15,
        response_format: { type: "json_object" },
        reasoning_effort: "low",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!groqResponse.ok) {
      console.warn("[correct-essay] Primary model failed; trying GPT-OSS 20B fallback", groqResponse.status);
      groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: [
            { role: "system", content: ENEM_RUBRIC_PROMPT },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 2500,
          temperature: 0.15,
          response_format: { type: "json_object" },
          reasoning_effort: "low",
        }),
      });
    }

    if (!groqResponse.ok) {
      console.error("[correct-essay] Groq request failed", groqResponse?.status);
      throw new ApiError(502, "AI_REQUEST_FAILED", "Erro ao corrigir redação com IA. Tente novamente em instantes.");
    }

    const groqData = await groqResponse.json();
    const rawContent = groqData.choices?.[0]?.message?.content;
    const responseContent = typeof rawContent === "string"
      ? rawContent.trim()
      : rawContent && typeof rawContent === "object"
        ? JSON.stringify(rawContent)
        : "";
    console.log("[correct-essay] AI response received");

    // Parse do JSON da resposta
    let correction;
    try {
      // Primeiro tenta o conteúdo inteiro; depois tolera markdown/preâmbulos.
      try {
        correction = JSON.parse(responseContent);
      } catch {
        const start = responseContent.indexOf("{");
        const end = responseContent.lastIndexOf("}");
        if (start < 0 || end <= start) throw new Error("JSON não encontrado na resposta");
        correction = JSON.parse(responseContent.slice(start, end + 1));
      }
    } catch (parseError) {
      console.error(
        "[correct-essay] Erro ao parsear resposta da IA",
        parseError instanceof Error ? parseError.message : "parse_failed",
        "content_length:", responseContent.length,
      );
      throw new ApiError(502, "AI_INVALID_RESPONSE", "Erro ao processar correção");
    }

    // Validar e normalizar notas
    const normalizeScore = (score: number) => {
      const validScores = [0, 40, 80, 120, 160, 200];
      return validScores.reduce((prev, curr) => 
        Math.abs(curr - score) < Math.abs(prev - score) ? curr : prev
      );
    };

    const scores = {
      score_competency_1: normalizeScore(Number(correction.score_competency_1) || 0),
      score_competency_2: normalizeScore(Number(correction.score_competency_2) || 0),
      score_competency_3: normalizeScore(Number(correction.score_competency_3) || 0),
      score_competency_4: normalizeScore(Number(correction.score_competency_4) || 0),
      score_competency_5: normalizeScore(Number(correction.score_competency_5) || 0),
    };

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

    // Montar feedback estruturado em JSON
    const structuredFeedback = JSON.stringify({
      competencies: {
        c1: correction.feedback_competency_1 || "Análise não disponível",
        c2: correction.feedback_competency_2 || "Análise não disponível",
        c3: correction.feedback_competency_3 || "Análise não disponível",
        c4: correction.feedback_competency_4 || "Análise não disponível",
        c5: correction.feedback_competency_5 || "Análise não disponível",
      },
      strengths: correction.strengths || "Pontos fortes não identificados",
      weaknesses: correction.weaknesses || "Pontos a melhorar não identificados",
      intervention_checklist: correction.intervention_checklist || null,
      annotated_snippets: correction.annotated_snippets || [],
    });

    // Salvar redação no banco de dados
    const { data: essay, error: insertError } = await auth.serviceClient
      .from("essays")
      .insert({
        user_id: auth.user.id,
        title,
        content,
        ...scores,
        score_total: totalScore,
        feedback: structuredFeedback,
        tips: correction.tips || "Continue praticando a escrita dissertativo-argumentativa.",
        status: "corrected"
      })
      .select()
      .single();

    if (insertError) {
      console.error("[correct-essay] Erro ao salvar redação:", insertError);
      throw new ApiError(500, "ESSAY_SAVE_FAILED", "Erro ao salvar redação");
    }

    console.log("[correct-essay] Redação corrigida e salva:", essay.id, "Nota:", totalScore);

    return new Response(
      JSON.stringify({ 
        success: true,
        essay,
        remainingEssays
      }),
      { status: 200, headers: responseHeaders }
    );

  } catch (error) {
    let responseError = error;
    if (addonCreditConsumed && addonIdempotencyKey && authenticated) {
      try {
        const { error: refundError } = await authenticated.serviceClient.rpc("refund_essay_addon_credit", {
          _user_id: authenticated.user.id,
          _idempotency_key: addonIdempotencyKey,
        });
        if (refundError) throw refundError;
      } catch {
        // Failing closed preserves accounting integrity; operations can
        // reconcile the immutable debit if the compensating RPC is unavailable.
        responseError = new ApiError(503, "ADD_ON_CREDIT_REFUND_FAILED", "Não foi possível restaurar o crédito do Combo");
      }
    }
    console.error("[correct-essay] Request failed", responseError instanceof ApiError ? responseError.code : "INTERNAL_ERROR");
    return errorResponse(responseError, corsHeaders, "ESSAY_CORRECTION_FAILED", "Erro interno do servidor");
  }
});
