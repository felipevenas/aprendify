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
  // This hash is currently an auxiliary per-user scope in consume_rate_limit,
  // not a shared cross-account IP quota. Do not treat forwarded headers as a
  // trusted global identity until the Edge proxy contract and NAT-friendly cap
  // are verified; otherwise callers could spoof or legitimate users could be
  // throttled together.
  const address = firstValidAddress(
    req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for"),
  );
  if (!address) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function anonymousBucketId(req: Request): Promise<string> {
  const key = (await clientKey(req)) ?? "anonymous";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

  const remaining = Number(row.remaining);
  const limit = Number(row.limit_value);
  const retryAfterSeconds = Number(row.retry_after_seconds);
  const resetAt = typeof row.reset_at === "string" ? row.reset_at : "";
  if (
    !Number.isInteger(remaining) || remaining < 0 ||
    !Number.isInteger(limit) || limit < 1 ||
    !Number.isInteger(retryAfterSeconds) || retryAfterSeconds < 0 ||
    !Number.isFinite(Date.parse(resetAt))
  ) {
    throw new ApiError(503, "RATE_LIMIT_UNAVAILABLE", "Rate limit temporarily unavailable");
  }

  return { allowed: row.allowed, remaining, limit, retryAfterSeconds, resetAt };
}

export async function consumeAnonymousRateLimit(
  serviceClient: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  req: Request,
  functionName: string,
  maxCalls: number,
  windowMinutes: number,
): Promise<RateLimitResult> {
  return consumeRateLimit(serviceClient, req, await anonymousBucketId(req), functionName, maxCalls, windowMinutes);
}
