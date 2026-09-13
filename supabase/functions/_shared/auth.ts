import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ApiError } from "./api.ts";

export type AuthenticatedRequest = {
  user: User;
  token: string;
  serviceClient: ReturnType<typeof createClient>;
  userClient: ReturnType<typeof createClient>;
};

export async function authenticateRequest(
  req: Request,
  headers: Record<string, string>,
  method = "POST",
): Promise<AuthenticatedRequest> {
  if (req.method !== method) {
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Método não permitido");
  }

  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Não autorizado");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    throw new ApiError(503, "AUTH_UNAVAILABLE", "Autenticação temporariamente indisponível");
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await serviceClient.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, "UNAUTHENTICATED", "Não autorizado");

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return { user: data.user, token, serviceClient, userClient };
}

