const checkoutDiagnosticCodes = new Set([
  "AUTH_UNAVAILABLE",
  "RATE_LIMIT_UNAVAILABLE",
  "PLAN_UNAVAILABLE",
  "PAYMENT_UNAVAILABLE",
  "COUPON_LOOKUP_UNAVAILABLE",
  "CHECKOUT_UNAVAILABLE",
]);

/** Reads only a known server code; response messages and arbitrary payloads stay private. */
export async function readCheckoutDiagnosticCode(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;

  try {
    const payload: unknown = await context.clone().json();
    if (!payload || typeof payload !== "object" || !("code" in payload)) return null;
    const code = (payload as { code?: unknown }).code;
    return typeof code === "string" && checkoutDiagnosticCodes.has(code) ? code : null;
  } catch {
    return null;
  }
}
