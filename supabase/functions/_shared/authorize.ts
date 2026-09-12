import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// These endpoints run with gateway verification disabled. Verify the user
// before touching the service-role client, paid AI, or the shared question bank.
export async function authorizeAI(req: Request, headers: Record<string, string>, functionName: string, adminOnly: boolean) {
  const reject = (status: number, error: string) => new Response(JSON.stringify({ error }), {
    status, headers: { ...headers, "Content-Type": "application/json" },
  });
  if (req.method !== "POST") return { response: reject(405, "Método não permitido") };
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return { response: reject(401, "Não autorizado") };
  try {
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return { response: reject(401, "Não autorizado") };
    const { data: role, error: roleError } = await client.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (roleError) return { response: reject(503, "Não foi possível verificar permissões") };
    const isAdmin = role?.role === "admin";
    if (adminOnly && !isAdmin) return { response: reject(403, "Acesso restrito a administradores") };
    const { data: allowed, error: limitError } = await client.rpc("check_rate_limit", {
      _user_id: user.id, _function_name: functionName, _max_calls: adminOnly ? 100 : 30, _window_minutes: 60,
    });
    if (limitError) return { response: reject(503, "Controle de uso temporariamente indisponível") };
    if (!allowed) return { response: reject(429, "Limite de solicitações atingido") };
    return { user, isAdmin };
  } catch {
    return { response: reject(503, "Autenticação temporariamente indisponível") };
  }
}
