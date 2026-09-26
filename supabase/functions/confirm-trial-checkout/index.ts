import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { ApiError, errorResponse, jsonResponse, readJsonObject } from "../_shared/api.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { consumeRateLimit, rateLimitHeaders } from "../_shared/rate-limit.ts";
import { requirePlanPrice, stripeCatalog } from "../_shared/catalog.ts";
import { validateTrialCheckoutSnapshot } from "../_shared/trial.ts";
import {
  trialConfirmationDiagnostic,
  trialConfirmationStripeOptions,
  type TrialConfirmationStage,
} from "../_shared/trial-confirmation-runtime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  let stage: TrialConfirmationStage = "authentication";
  try {
    const { user, serviceClient } = await authenticateRequest(req, corsHeaders);
    if (!(user.email_confirmed_at || user.confirmed_at)) {
      throw new ApiError(403, "TRIAL_EMAIL_CONFIRMATION_REQUIRED", "Confirme seu e-mail para iniciar o teste");
    }
    stage = "rate_limit";
    const limit = await consumeRateLimit(serviceClient, req, user.id, "confirm-trial-checkout", 10, 60);
    const responseHeaders = { ...corsHeaders, ...rateLimitHeaders(limit) };
    if (!limit.allowed) return jsonResponse({ error: "Limite de solicitações atingido", code: "RATE_LIMITED", rateLimited: true }, 429, corsHeaders, rateLimitHeaders(limit));

    stage = "request_validation";
    const body = await readJsonObject(req, 4096);
    if (Object.keys(body).length !== 1 || typeof body.session_id !== "string" || !/^cs_[A-Za-z0-9_]{8,255}$/.test(body.session_id)) {
      throw new ApiError(400, "INVALID_TRIAL_CONFIRMATION", "Identificador do checkout inválido");
    }
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new ApiError(503, "PAYMENT_UNAVAILABLE", "Pagamento temporariamente indisponível");
    const stripe = new Stripe(stripeKey, trialConfirmationStripeOptions);
    let session: Stripe.Checkout.Session;
    stage = "stripe_session";
    try {
      session = await stripe.checkout.sessions.retrieve(body.session_id);
    } catch (error) {
      const statusCode = error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 0;
      if (statusCode === 404) throw new ApiError(404, "TRIAL_CHECKOUT_NOT_FOUND", "Checkout de teste não encontrado");
      throw new ApiError(503, "STRIPE_LOOKUP_UNAVAILABLE", "Não foi possível consultar o checkout temporariamente");
    }
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (!subscriptionId || !customerId) throw new ApiError(409, "TRIAL_CONFIRMATION_FAILED", "Checkout ainda não foi concluído");

    stage = "stripe_subscription_customer";
    const [subscription, customer] = await Promise.all([
      stripe.subscriptions.retrieve(subscriptionId),
      stripe.customers.retrieve(customerId),
    ]);
    if ("deleted" in customer) throw new ApiError(409, "TRIAL_CONFIRMATION_FAILED", "Não foi possível confirmar o período de teste");
    stage = "snapshot_validation";
    const confirmation = validateTrialCheckoutSnapshot({
      session,
      subscription,
      customer,
      userId: user.id,
      expectedPriceId: requirePlanPrice(stripeCatalog(), "annual"),
    });

    stage = "activation";
    const { data, error } = await serviceClient.rpc("activate_free_trial_from_stripe", {
      _user_id: user.id,
      _checkout_session_id: session.id,
      _stripe_customer_id: confirmation.customerId,
      _stripe_subscription_id: confirmation.subscriptionId,
      _trial_started_at: confirmation.startedAt,
      _trial_ends_at: confirmation.endsAt,
    });
    if (error) throw new ApiError(503, "TRIAL_ACTIVATION_UNAVAILABLE", "Não foi possível ativar o teste temporariamente");
    if (data !== true) throw new ApiError(409, "TRIAL_NOT_ELIGIBLE", "Esta conta não está elegível para o teste grátis");
    return jsonResponse({ confirmed: true, trial_ends_at: confirmation.endsAt }, 200, responseHeaders);
  } catch (error) {
    const safeError = error instanceof ApiError
      ? error
      : new ApiError(503, "TRIAL_CONFIRMATION_UNAVAILABLE", "Não foi possível confirmar o checkout do teste");
    console.error("[CONFIRM-TRIAL-CHECKOUT] failure", trialConfirmationDiagnostic(stage, safeError.code));
    return errorResponse(safeError, corsHeaders, "TRIAL_CONFIRMATION_UNAVAILABLE", "Não foi possível confirmar o checkout do teste");
  }
});
