import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { ApiError, errorResponse, jsonResponse, readJsonObject } from "../_shared/api.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { consumeRateLimit, rateLimitHeaders } from "../_shared/rate-limit.ts";

const APP_ORIGIN = "https://app.aprendify.cloud";
const LOCAL_ORIGINS = new Set(["http://localhost:8080", "http://127.0.0.1:8080"]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin && (origin === APP_ORIGIN || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) ? origin : APP_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
    Vary: "Origin",
  };
}

const VALID_YEARS = /^(20(?:0[9]|1[0-9]|2[0-6]))$/;

function getDisciplineFromNumber(questionNumber: number): string {
  if (questionNumber <= 45) return "linguagens";
  if (questionNumber <= 90) return "humanas";
  if (questionNumber <= 135) return "natureza";
  if (questionNumber <= 180) return "matematica";
  return "outros";
}

function getLanguageFromQuestion(questionNumber: number, content: string): string | null {
  if (questionNumber < 1 || questionNumber > 5) return null;
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes("inglês") || lowerContent.includes("english")) return "ingles";
  if (lowerContent.includes("espanhol") || lowerContent.includes("español")) return "espanhol";
  return "ingles";
}

function extractText(contentArray: unknown[]): string {
  if (!Array.isArray(contentArray)) return "";
  return contentArray
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter((item) => item.type === "text" && typeof item.content === "string")
    .map((item) => item.content as string)
    .join(" ")
    .trim();
}

function extractImages(contentArray: unknown[], questionNumber: number, baseUrl: string): string[] {
  if (!Array.isArray(contentArray)) return [];
  const hasImage = contentArray.some((item) => Boolean(item) && typeof item === "object" && (item as Record<string, unknown>).type === "image");
  return hasImage ? [`${baseUrl}/storage/v1/object/public/enem-images/question-${questionNumber}.png`] : [];
}

function transformQuestion(raw: Record<string, unknown>, year: string, supabaseUrl: string): Record<string, unknown> {
  const questionNumber = raw.number;
  if (!Number.isInteger(questionNumber) || (questionNumber as number) < 1 || (questionNumber as number) > 180) {
    throw new ApiError(400, "INVALID_QUESTION", "Número de questão inválido");
  }

  const content = Array.isArray(raw.content) ? raw.content : [];
  const context = extractText(content);
  const alternativesSource = raw.alternatives;
  if (!alternativesSource || typeof alternativesSource !== "object" || Array.isArray(alternativesSource)) {
    throw new ApiError(400, "INVALID_QUESTION", "Alternativas inválidas");
  }

  const alternatives: Array<Record<string, unknown>> = [];
  let correctAlternative = "";
  for (const key of Object.keys(alternativesSource as Record<string, unknown>).sort((a, b) => Number(a) - Number(b))) {
    const alternative = (alternativesSource as Record<string, unknown>)[key];
    if (!alternative || typeof alternative !== "object") throw new ApiError(400, "INVALID_QUESTION", "Alternativa inválida");
    const item = alternative as Record<string, unknown>;
    const letter = typeof item.alternative === "string" ? item.alternative : String.fromCharCode(65 + Number(key));
    const alternativeContent = Array.isArray(item.content) ? item.content : [];
    alternatives.push({ letter, text: extractText(alternativeContent), files: extractImages(alternativeContent, questionNumber as number, supabaseUrl) });
    if (item.correct === true) correctAlternative = letter;
  }
  if (alternatives.length !== 5 || !/^[A-E]$/.test(correctAlternative)) {
    throw new ApiError(400, "INVALID_QUESTION", "A questão deve possuir cinco alternativas e um gabarito válido");
  }

  return {
    year,
    index: questionNumber,
    title: `Questão ${questionNumber}`,
    discipline: getDisciplineFromNumber(questionNumber as number),
    language: getLanguageFromQuestion(questionNumber as number, context),
    context: context.slice(0, 50000),
    files: extractImages(content, questionNumber as number, supabaseUrl),
    alternatives_introduction: null,
    alternatives,
    correct_alternative: correctAlternative,
    origin: "enem_api",
    classification_status: "pending_classification",
  };
}

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    const { user, serviceClient } = await authenticateRequest(req, headers);
    const { data: role, error: roleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new ApiError(503, "AUTHZ_UNAVAILABLE", "Não foi possível verificar permissões");
    if (!role) throw new ApiError(403, "FORBIDDEN", "Acesso restrito a administradores");

    const limit = await consumeRateLimit(serviceClient, req, user.id, "import-enem-questions", 5, 60);
    if (!limit.allowed) return jsonResponse({ error: "Limite de importações atingido", code: "RATE_LIMITED" }, 429, headers, rateLimitHeaders(limit));

    const body = await readJsonObject(req, 8 * 1024 * 1024);
    const year = typeof body.year === "string" ? body.year.trim() : "";
    const questions = body.questions;
    if (!VALID_YEARS.test(year) || !Array.isArray(questions) || questions.length === 0 || questions.length > 200) {
      throw new ApiError(400, "INVALID_IMPORT_PAYLOAD", "Informe um ano válido e entre 1 e 200 questões");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new ApiError(503, "IMPORT_UNAVAILABLE", "Importação temporariamente indisponível");
    const transformed = questions.map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ApiError(400, "INVALID_QUESTION", "Questão inválida");
      return transformQuestion(raw as Record<string, unknown>, year, supabaseUrl);
    });

    let inserted = 0;
    const errors: Array<{ batch: number; error: string }> = [];
    for (let i = 0; i < transformed.length; i += 50) {
      const batch = transformed.slice(i, i + 50);
      const { data, error } = await serviceClient.from("enem_questions").upsert(batch, { onConflict: "year,index", ignoreDuplicates: false }).select("id");
      if (error) errors.push({ batch: i, error: "Falha ao persistir lote" });
      else inserted += data?.length ?? 0;
    }

    return jsonResponse({ success: errors.length === 0, year, total: questions.length, inserted, errors: errors.length ? errors : undefined }, 200, headers, rateLimitHeaders(limit));
  } catch (error) {
    return errorResponse(error, headers, "IMPORT_UNAVAILABLE", "Não foi possível importar as questões");
  }
});
