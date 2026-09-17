import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ApiError, errorResponse, jsonResponse, readJsonObject } from "../_shared/api.ts";
import { consumeAnonymousRateLimit, rateLimitHeaders } from "../_shared/rate-limit.ts";

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

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    if (req.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "Método não permitido");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new ApiError(503, "RECAPTCHA_UNAVAILABLE", "Verificação temporariamente indisponível");

    const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const limit = await consumeAnonymousRateLimit(serviceClient, req, "verify-recaptcha", 10, 15);
    if (!limit.allowed) return jsonResponse({ success: false, error: "Muitas tentativas. Aguarde antes de tentar novamente.", code: "RATE_LIMITED" }, 429, headers, rateLimitHeaders(limit));

    const body = await readJsonObject(req, 8 * 1024);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token || token.length > 4096) throw new ApiError(400, "INVALID_RECAPTCHA", "Verificação inválida");

    const secretKey = Deno.env.get("RECAPTCHA_SECRET_KEY");
    if (!secretKey) throw new ApiError(503, "RECAPTCHA_UNAVAILABLE", "Verificação temporariamente indisponível");

    const payload = new URLSearchParams({ secret: secretKey, response: token });
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
    });
    if (!response.ok) throw new ApiError(502, "RECAPTCHA_PROVIDER_UNAVAILABLE", "Verificação temporariamente indisponível");
    const result = await response.json() as { success?: boolean; hostname?: string };
    const allowedHostnames = new Set(["app.aprendify.cloud", "aprendify.cloud", "www.aprendify.cloud", "localhost"]);
    const hostname = typeof result.hostname === "string" ? result.hostname.toLowerCase() : "";
    if (result.success !== true || !allowedHostnames.has(hostname)) {
      return jsonResponse({ success: false, error: "Verificação de segurança falhou", code: "RECAPTCHA_FAILED" }, 400, headers, rateLimitHeaders(limit));
    }

    return jsonResponse({ success: true }, 200, headers, rateLimitHeaders(limit));
  } catch (error) {
    return errorResponse(error, headers, "RECAPTCHA_UNAVAILABLE", "Não foi possível validar a verificação");
  }
});
