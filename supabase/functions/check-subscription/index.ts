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

    // The local projection is the server-owned entitlement source. Stripe is
    // synchronized by the signed webhook; this read must not search by email
    // or grant access based on a client-provided identity.
    const [{ data: subscription, error }, { data: redacaoCredits, error: creditsError }] = await Promise.all([
      auth.serviceClient
        .from("subscriptions")
        .select("status, plan_type, end_date, updated_at")
        .eq("user_id", auth.user.id)
        .eq("status", "authorized")
        .or("end_date.is.null,end_date.gt." + new Date().toISOString())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      auth.serviceClient.rpc("get_essay_addon_credit_balance", { _user_id: auth.user.id }),
    ]);
    if (error) throw new Error("subscription projection unavailable");
    if (creditsError || typeof redacaoCredits !== "number" || !Number.isSafeInteger(redacaoCredits) || redacaoCredits < 0) {
      throw new Error("essay add-on credit balance unavailable");
    }

    const planType = subscription?.plan_type ?? null;
    const essayLimit = planType === "annual" || planType === "god" || planType === "creator"
      ? 12
      : planType === "monthly" ? 4 : 1;
    return jsonResponse({
      subscribed: Boolean(subscription),
      plan_type: planType,
      tier: !subscription ? "free" : (planType === "annual" || planType === "god" || planType === "creator") ? "complete" : "starter",
      monthly_essay_limit: essayLimit,
      redacao_combo_credits: redacaoCredits,
      subscription_end: subscription?.end_date ?? null,
      source: "server_projection",
    }, 200, corsHeaders, rateLimitHeaders(limit));
  } catch (error) {
    return errorResponse(error, corsHeaders, "SUBSCRIPTION_UNAVAILABLE", "Não foi possível verificar a assinatura");
  }
});
