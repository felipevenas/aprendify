import { ApiError } from "./api.ts";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
  resetAt: string;
};

function firstValidAddress(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.split(",")[0].trim();
  if (!candidate || candidate.length > 128 || [...candidate].some((char) => char.charCodeAt(0) < 0x20 || /\s/.test(char))) return null;
  return candidate;
}

async function clientKey(req: Request): Promise<string | null> {
  const address = firstValidAddress(
    req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for"),
  );
  if (!address) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
    "X-RateLimit-Reset": String(Math.floor(new Date(result.resetAt).getTime() / 1000)),
    ...(result.allowed ? {} : { "Retry-After": String(Math.max(1, result.retryAfterSeconds)) }),
  };
}

export async function consumeRateLimit(
  serviceClient: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  req: Request,
  userId: string,
  functionName: string,
  maxCalls: number,
  windowMinutes: number,
): Promise<RateLimitResult> {
  const { data, error } = await serviceClient.rpc("consume_rate_limit", {
    _user_id: userId,
    _function_name: functionName,
    _max_calls: maxCalls,
    _window_minutes: windowMinutes,
    _client_key: await clientKey(req),
  });
  if (error) throw new ApiError(503, "RATE_LIMIT_UNAVAILABLE", "Controle de uso temporariamente indisponível");

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.allowed !== "boolean") {
    throw new ApiError(503, "RATE_LIMIT_UNAVAILABLE", "Controle de uso temporariamente indisponível");
  }

  return {
    allowed: row.allowed,
    remaining: Number(row.remaining ?? 0),
    limit: Number(row.limit_value ?? maxCalls),
    retryAfterSeconds: Number(row.retry_after_seconds ?? 0),
    resetAt: String(row.reset_at ?? new Date().toISOString()),
  };
}
