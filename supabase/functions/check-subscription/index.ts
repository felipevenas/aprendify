import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { ApiError, errorResponse, jsonResponse } from "../_shared/api.ts";
import { consumeRateLimit, rateLimitHeaders } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 1024) {
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Payload excede o limite permitido");
    }
    const auth = await authenticateRequest(req, corsHeaders);
    const limit = await consumeRateLimit(auth.serviceClient, req, auth.user.id, "check-subscription", 200, 60);
    if (!limit.allowed) return jsonResponse({ error: "Muitas solicitações. Tente novamente em breve.", code: "RATE_LIMITED", rateLimited: true }, 429, corsHeaders, rateLimitHeaders(limit));

    // Trial access is opt-in and only activated after a server-side Stripe
    // Checkout confirmation. This endpoint remains read-only for entitlements.
    const [{ data: entitlementRows, error }, { data: redacaoCredits, error: creditsError }] = await Promise.all([
      auth.serviceClient.rpc("get_user_entitlement", { _user_id: auth.user.id }),
      auth.serviceClient.rpc("get_essay_addon_credit_balance", { _user_id: auth.user.id }),
    ]);
    if (error) throw new Error("subscription entitlement unavailable");
    if (creditsError || typeof redacaoCredits !== "number" || !Number.isSafeInteger(redacaoCredits) || redacaoCredits < 0) {
      throw new Error("essay add-on credit balance unavailable");
    }

    const entitlement = Array.isArray(entitlementRows) ? entitlementRows[0] : entitlementRows;
    if (!entitlement || typeof entitlement.subscribed !== "boolean" || typeof entitlement.has_premium_access !== "boolean") {
      throw new Error("subscription entitlement unavailable");
    }
    const trialStatus = entitlement.subscribed
      ? "ineligible"
      : entitlement.trial_status === "active"
        ? "active"
        : entitlement.trial_status === "expired"
          ? "expired"
          : entitlement.trial_status === "eligible"
            ? "not_started"
            : "ineligible";
    return jsonResponse({
      // `subscribed` intentionally keeps its historical paid-subscription meaning.
      subscribed: entitlement.subscribed,
      has_premium_access: entitlement.has_premium_access,
      trial_status: trialStatus,
      trial_ends_at: entitlement.trial_ends_at,
      plan_type: entitlement.plan_type ?? null,
      tier: entitlement.tier,
      monthly_essay_limit: entitlement.monthly_essay_limit,
      redacao_combo_credits: redacaoCredits,
      subscription_end: entitlement.subscription_end ?? null,
      source: "server_projection",
    }, 200, corsHeaders, rateLimitHeaders(limit));
  } catch (error) {
    return errorResponse(error, corsHeaders, "SUBSCRIPTION_UNAVAILABLE", "Não foi possível verificar a assinatura");
  }
});
