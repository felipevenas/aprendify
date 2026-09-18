import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ApiError, errorResponse, jsonResponse, readJsonObject } from "../_shared/api.ts";
import { consumeAnonymousRateLimit, rateLimitHeaders } from "../_shared/rate-limit.ts";

const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://app.aprendify.cloud",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
};

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const isLocalOrigin = Boolean(origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  const allowedOrigin = origin === "https://app.aprendify.cloud" || isLocalOrigin
    ? origin
    : BASE_CORS_HEADERS["Access-Control-Allow-Origin"];
  return { ...BASE_CORS_HEADERS, "Access-Control-Allow-Origin": allowedOrigin, Vary: "Origin" };
}

const authenticationError = () => new ApiError(401, "AUTHENTICATION_FAILED", "Credenciais inválidas");

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  try {
    if (req.method !== "POST") throw new ApiError(405, "METHOD_NOT_ALLOWED", "Método não permitido");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      throw new ApiError(503, "AUTH_UNAVAILABLE", "Autenticação temporariamente indisponível");
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const limit = await consumeAnonymousRateLimit(serviceClient, req, "auth-login", 10, 15);
    if (!limit.allowed) {
      return jsonResponse({ error: "Muitas tentativas. Aguarde antes de tentar novamente.", code: "RATE_LIMITED" }, 429, headers, rateLimitHeaders(limit));
    }

    const body = await readJsonObject(req, 8 * 1024);
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!identifier || identifier.length > 255 || !password || password.length > 1024) {
      throw authenticationError();
    }

    let email = identifier;
    if (!identifier.includes("@")) {
      const { data: profile, error } = await serviceClient
        .from("profiles")
        .select("email")
        .ilike("username", identifier)
        .maybeSingle();
      if (error || !profile?.email) throw authenticationError();
      email = profile.email;
    }

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw authenticationError();

    return jsonResponse({ session: data.session }, 200, headers, rateLimitHeaders(limit));
  } catch (error) {
    return errorResponse(error, headers, "AUTH_LOGIN_UNAVAILABLE", "Não foi possível concluir o login");
  }
});
