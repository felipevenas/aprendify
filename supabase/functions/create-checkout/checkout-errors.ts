import { ApiError } from "../_shared/api.ts";

type StripeFailure = {
  type?: unknown;
  code?: unknown;
  param?: unknown;
  statusCode?: unknown;
  requestId?: unknown;
};

function safeToken(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(value) ? value : null;
}

export function checkoutFailure(error: unknown, stage: string): ApiError {
  if (error instanceof ApiError) return error;
  const failure = error && typeof error === "object" ? error as StripeFailure : {};
  const type = safeToken(failure.type);
  const code = safeToken(failure.code);
  const parameter = typeof failure.param === "string" ? failure.param : "";
  const statusCode = Number.isInteger(failure.statusCode) ? failure.statusCode as number : null;
  const requestId = safeToken(failure.requestId);

  // Keep diagnostics useful without writing the Stripe error message, customer,
  // email, price ID, request body, or API key to function logs.
  console.error("create-checkout failed", { stage, type, code, statusCode, requestId });

  if (type?.startsWith("Stripe") || statusCode !== null) {
    if (code === "resource_missing" && /(?:^|\[)price\]?/.test(parameter)) {
      return new ApiError(503, "PLAN_UNAVAILABLE", "Plano temporariamente indisponível");
    }
    if (/promotion_code|coupon/.test(parameter)) {
      return new ApiError(422, "INVALID_COUPON", "Cupom indisponível para este checkout");
    }
    return new ApiError(503, "CHECKOUT_UNAVAILABLE", "Não foi possível iniciar o checkout no momento");
  }
  return new ApiError(500, "CHECKOUT_UNAVAILABLE", "Não foi possível iniciar o checkout");
}
