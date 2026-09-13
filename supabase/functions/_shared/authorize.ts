import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ApiError, jsonResponse } from "./api.ts";
import { consumeRateLimit, rateLimitHeaders } from "./rate-limit.ts";

// These endpoints run with gateway verification disabled. Verify the user
// before touching the service-role client, paid AI, or the shared question bank.
export async function authorizeAI(req: Request, headers: Record<string, string>, functionName: string, adminOnly: boolean) {
  const reject = (error: unknown, extraHeaders: Record<string, string> = {}) => {
    if (error instanceof ApiError) return { response: jsonResponse({ error: error.message, code: error.code }, error.status, headers, extraHeaders) };
    return { response: jsonResponse({ error: "Serviço temporariamente indisponível", code: "AUTH_UNAVAILABLE" }, 503, headers, extraHeaders) };
  };
  if (req.method !== "POST") return reject(new ApiError(405, "METHOD_NOT_ALLOWED", "Método não permitido"));
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return reject(new ApiError(401, "UNAUTHENTICATED", "Não autorizado"));
  try {
    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await serviceClient.auth.getUser(token);
    if (error || !user) return reject(new ApiError(401, "UNAUTHENTICATED", "Não autorizado"));
    const { data: role, error: roleError } = await serviceClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (roleError) return reject(new ApiError(503, "AUTHZ_UNAVAILABLE", "Não foi possível verificar permissões"));
    const isAdmin = role?.role === "admin";
    if (adminOnly && !isAdmin) return reject(new ApiError(403, "FORBIDDEN", "Acesso restrito a administradores"));
    const limit = await consumeRateLimit(serviceClient, req, user.id, functionName, adminOnly ? 100 : 30, 60);
    if (!limit.allowed) return reject(new ApiError(429, "RATE_LIMITED", "Limite de solicitações atingido"), rateLimitHeaders(limit));
    return { user, isAdmin };
  } catch (error) {
    return reject(error instanceof ApiError ? error : new ApiError(503, "AUTH_UNAVAILABLE", "Autenticação temporariamente indisponível"));
  }
}
