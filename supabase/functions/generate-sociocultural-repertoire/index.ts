import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authorizeAI } from "../_shared/authorize.ts";
import { ApiError, errorResponse, jsonResponse, readJsonObject } from "../_shared/api.ts";
import { parseGeneratedRepertoire, validateRepertoireInput } from "./domain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BODY_BYTES = 4 * 1024;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authorization = await authorizeAI(req, corsHeaders, "generate-sociocultural-repertoire", false);
    if ("response" in authorization) return authorization.response;
    const body = await readJsonObject(req, MAX_BODY_BYTES);
    const input = validateRepertoireInput(body);
    if (!input.ok) throw new ApiError(400, input.code, input.message);

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) throw new ApiError(503, "AI_UNAVAILABLE", "Serviço de IA temporariamente indisponível");

    const responseHeaders = corsHeaders;

    const prompt = [
      `Tema de redação: ${input.value.topic}`,
      input.value.focus ? `Recorte desejado: ${input.value.focus}` : "",
      input.value.context ? `Contexto informado pelo estudante: ${input.value.context}` : "",
      "",
      "Crie um repertório sociocultural utilizável em uma redação dissertativo-argumentativa brasileira.",
      "Responda apenas com um objeto JSON nos campos: title, category, summary, purpose, application_example, themes, niches, source_title, source_author, source_year, source_url.",
      "Use strings em português; themes e niches devem conter de 2 a 5 strings curtas.",
      "application_example deve ser um parágrafo argumentativo concreto que conecte o repertório ao tema, sem prometer nota ou adequação universal.",
      "Não invente citações, autores, obras, datas, estatísticas ou URLs. Só preencha os campos source_* se tiver segurança sobre a referência; caso contrário use null e diga em summary ou purpose que a referência/detalhes precisam ser conferidos antes de citar.",
      "Se usar uma referência conhecida, descreva-a sem aspas literais e sem atribuir frases não verificadas.",
      "Não inclua markdown, texto fora do JSON, nem campos adicionais.",
    ].filter(Boolean).join("\n");

    let upstream: Response;
    try {
      upstream = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            {
              role: "system",
              content: "Você é um orientador de redação cuidadoso. Produza repertórios socioculturais úteis, específicos e factualmente prudentes. Obedeça ao esquema JSON solicitado.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          // GPT-OSS completion tokens include its internal reasoning tokens.
          reasoning_effort: "low",
          max_completion_tokens: 1800,
          temperature: 0.35,
        }),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new ApiError(504, "AI_TIMEOUT", "A geração demorou mais que o esperado. Tente novamente.");
      }
      throw new ApiError(502, "AI_UPSTREAM_ERROR", "Não foi possível gerar o repertório agora.");
    }

    if (!upstream.ok) {
      console.warn("[generate-sociocultural-repertoire] Groq request failed", upstream.status);
      throw new ApiError(502, "AI_UPSTREAM_ERROR", "Não foi possível gerar o repertório agora.");
    }

    let groqPayload: unknown;
    try {
      const raw = await upstream.text();
      if (raw.length > 64_000) throw new Error("upstream response too large");
      groqPayload = JSON.parse(raw);
    } catch {
      throw new ApiError(502, "AI_INVALID_RESPONSE", "A resposta da IA veio em formato inválido.");
    }
    const choice = (groqPayload as {
      choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown } }>;
      usage?: { completion_tokens?: unknown };
    })?.choices?.[0];
    const content = choice?.message?.content;
    const repertoire = parseGeneratedRepertoire(content);
    if (!repertoire.ok) {
      const completionTokens = (groqPayload as { usage?: { completion_tokens?: unknown } })?.usage?.completion_tokens;
      console.warn("[generate-sociocultural-repertoire] Groq returned invalid structured content", {
        reason: repertoire.reason ?? "unknown",
        finishReason: choice?.finish_reason ?? null,
        contentType: typeof content,
        contentLength: typeof content === "string" ? content.length : null,
        completionTokens: typeof completionTokens === "number" ? completionTokens : null,
      });
      throw new ApiError(502, "AI_INVALID_RESPONSE", "A IA não conseguiu montar um repertório válido. Tente novamente.");
    }

    return jsonResponse({ repertoire: repertoire.value }, 200, responseHeaders);
  } catch (error) {
    return errorResponse(error, corsHeaders, "INTERNAL_ERROR", "Erro interno do servidor");
  }
});
