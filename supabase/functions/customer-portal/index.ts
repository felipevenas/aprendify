import { APP_ORIGIN } from "../_shared/redirects.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { ApiError, errorResponse, jsonResponse } from "../_shared/api.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { consumeRateLimit, rateLimitHeaders } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
};

// Rate limit configuration
const RATE_LIMIT_MAX_CALLS = 10; // 10 portal access attempts per hour
const RATE_LIMIT_WINDOW_MINUTES = 60;

const logStep = (step: string, details?: Record<string, unknown>) => {
  // Redact sensitive information from logs
  const safeDetails = details ? { ...details } : undefined;
  if (safeDetails?.email) safeDetails.email = "[REDACTED]";
  const detailsStr = safeDetails ? ` - ${JSON.stringify(safeDetails)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { user, serviceClient } = await authenticateRequest(req, corsHeaders);
    logStep("User authenticated", { userId: user.id });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new ApiError(503, "PAYMENT_UNAVAILABLE", "Pagamento temporariamente indisponível");

    const limit = await consumeRateLimit(serviceClient, req, user.id, "customer-portal", RATE_LIMIT_MAX_CALLS, RATE_LIMIT_WINDOW_MINUTES);
    if (!limit.allowed) {
      logStep("Rate limit exceeded");
      return jsonResponse({ error: "Too many requests", code: "RATE_LIMITED", rateLimited: true }, 429, corsHeaders, rateLimitHeaders(limit));
    }

    const { data: projection, error: projectionError } = await serviceClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (projectionError) throw new ApiError(503, "SUBSCRIPTION_UNAVAILABLE", "Assinatura temporariamente indisponível");
    const customerId = projection?.stripe_customer_id;
    if (!customerId) throw new ApiError(400, "STRIPE_CUSTOMER_NOT_FOUND", "Esta assinatura não possui gerenciamento pelo Stripe");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    logStep("Found Stripe customer", { customerId });

    const origin = APP_ORIGIN;
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard`,
    });
    logStep("Customer portal session created", { sessionId: portalSession.id });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, ...rateLimitHeaders(limit), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("ERROR in customer-portal", { code: error instanceof ApiError ? error.code : "INTERNAL_ERROR" });
    return errorResponse(error, corsHeaders, "CUSTOMER_PORTAL_UNAVAILABLE", "Não foi possível abrir o portal de gerenciamento");
  }
});
