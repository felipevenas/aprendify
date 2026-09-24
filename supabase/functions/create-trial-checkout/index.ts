import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { ApiError, errorResponse, jsonResponse, readJsonObject } from "../_shared/api.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { consumeRateLimit, rateLimitHeaders } from "../_shared/rate-limit.ts";
import { requirePlanPrice, stripeCatalog } from "../_shared/catalog.ts";
import { APP_ORIGIN } from "../_shared/redirects.ts";
import { STRIPE_TRIAL_OFFER } from "../_shared/trial.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
};

type Reservation = {
  eligible: boolean;
  idempotency_key: string | null;
  stripe_customer_id: string | null;
  checkout_session_id: string | null;
  checkout_session_expires_at: string | null;
};

function row(data: unknown): Reservation | null {
  const value = Array.isArray(data) ? data[0] : data;
  return value && typeof value === "object" ? value as Reservation : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const { user, serviceClient } = await authenticateRequest(req, corsHeaders);
    if (!user.email || !(user.email_confirmed_at || user.confirmed_at)) {
      throw new ApiError(403, "TRIAL_EMAIL_CONFIRMATION_REQUIRED", "Confirme seu e-mail para iniciar o teste");
    }
    const limit = await consumeRateLimit(serviceClient, req, user.id, "create-trial-checkout", 3, 60);
    const responseHeaders = { ...corsHeaders, ...rateLimitHeaders(limit) };
    if (!limit.allowed) return jsonResponse({ error: "Limite de solicitações atingido", code: "RATE_LIMITED", rateLimited: true }, 429, corsHeaders, rateLimitHeaders(limit));

    if (req.headers.get("content-length") && Number(req.headers.get("content-length")) > 4096) {
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Payload excede o limite permitido");
    }
    const bodyText = await req.clone().text();
    if (bodyText.trim()) {
      const body = await readJsonObject(req, 4096);
      if (Object.keys(body).length) throw new ApiError(400, "INVALID_TRIAL_REQUEST", "O teste não aceita parâmetros enviados pelo cliente");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new ApiError(503, "PAYMENT_UNAVAILABLE", "Pagamento temporariamente indisponível");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const { data, error } = await serviceClient.rpc("reserve_free_trial_checkout", { _user_id: user.id });
    if (error) throw new ApiError(503, "TRIAL_RESERVATION_UNAVAILABLE", "Não foi possível iniciar o teste temporariamente");
    const reservation = row(data);
    if (!reservation?.eligible || !reservation.idempotency_key) {
      throw new ApiError(409, "TRIAL_NOT_ELIGIBLE", "Esta conta não está elegível para o teste grátis");
    }

    if (reservation.checkout_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(reservation.checkout_session_id);
      if (existing.status === "open" && existing.url) return jsonResponse({ url: existing.url }, 200, responseHeaders);
      if (existing.status === "complete") {
        throw new ApiError(409, "TRIAL_CHECKOUT_COMPLETED", "Este checkout já foi concluído. Atualize sua assinatura para confirmar o teste");
      }
      if (existing.status !== "expired") {
        throw new ApiError(503, "TRIAL_CHECKOUT_UNAVAILABLE", "Não foi possível verificar o checkout anterior");
      }
      // Rotate only after Stripe itself confirms expiration. A timestamp alone
      // cannot prove an earlier Checkout was not completed before expiry.
      const { data: released, error: releaseError } = await serviceClient.rpc("release_expired_free_trial_checkout", {
        _user_id: user.id,
        _idempotency_key: reservation.idempotency_key,
        _checkout_session_id: existing.id,
      });
      if (releaseError || released !== true) {
        throw new ApiError(409, "TRIAL_CHECKOUT_PENDING", "O checkout do teste está sendo reconciliado; tente novamente em instantes");
      }
      const { data: refreshedData, error: refreshedError } = await serviceClient.rpc("reserve_free_trial_checkout", { _user_id: user.id });
      if (refreshedError) throw new ApiError(503, "TRIAL_RESERVATION_UNAVAILABLE", "Não foi possível iniciar o teste temporariamente");
      const refreshed = row(refreshedData);
      if (!refreshed?.eligible || !refreshed.idempotency_key || refreshed.checkout_session_id) {
        throw new ApiError(409, "TRIAL_CHECKOUT_PENDING", "O checkout do teste está sendo preparado; tente novamente em instantes");
      }
      reservation.idempotency_key = refreshed.idempotency_key;
      reservation.stripe_customer_id = refreshed.stripe_customer_id;
    }

    let customerId = reservation.stripe_customer_id;
    if (customerId) {
      const customer = await stripe.customers.retrieve(customerId);
      if ("deleted" in customer || customer.metadata?.user_id !== user.id || customer.metadata?.aprendify_trial_only !== "true") {
        throw new ApiError(503, "TRIAL_CUSTOMER_UNAVAILABLE", "Não foi possível preparar o checkout do teste");
      }
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id, aprendify_trial_only: "true", trial_offer: STRIPE_TRIAL_OFFER },
      }, { idempotencyKey: `aprendify-trial-customer-${user.id}` });
      customerId = customer.id;
      const { data: stored, error: storeError } = await serviceClient.rpc("set_free_trial_stripe_customer", {
        _user_id: user.id,
        _idempotency_key: reservation.idempotency_key,
        _stripe_customer_id: customerId,
      });
      if (storeError || stored !== true) throw new ApiError(503, "TRIAL_CUSTOMER_PERSISTENCE_FAILED", "Não foi possível preparar o checkout do teste");
    }

    const price = requirePlanPrice(stripeCatalog(), "annual");
    const metadata = {
      user_id: user.id,
      trial_offer: STRIPE_TRIAL_OFFER,
      trial_attempt_key: reservation.idempotency_key,
    };
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      mode: "subscription",
      payment_method_collection: "if_required",
      success_url: `${APP_ORIGIN}/settings?tab=subscription&trial_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_ORIGIN}/settings?tab=subscription&trial=cancelled`,
      metadata,
      subscription_data: {
        trial_period_days: 3,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        metadata,
      },
    }, { idempotencyKey: `aprendify-trial-checkout-${user.id}-${reservation.idempotency_key}` });
    if (!session.url || !session.expires_at) throw new ApiError(503, "TRIAL_CHECKOUT_UNAVAILABLE", "Checkout do teste temporariamente indisponível");

    const { data: attached, error: attachError } = await serviceClient.rpc("attach_free_trial_checkout_session", {
      _user_id: user.id,
      _idempotency_key: reservation.idempotency_key,
      _stripe_customer_id: customerId,
      _checkout_session_id: session.id,
      _checkout_session_expires_at: new Date(session.expires_at * 1000).toISOString(),
    });
    if (attachError || attached !== true) throw new ApiError(503, "TRIAL_SESSION_PERSISTENCE_FAILED", "Não foi possível salvar o checkout do teste");
    return jsonResponse({ url: session.url }, 200, responseHeaders);
  } catch (error) {
    const safeError = error instanceof ApiError
      ? error
      : new ApiError(503, "TRIAL_CHECKOUT_UNAVAILABLE", "Não foi possível iniciar o checkout do teste");
    return errorResponse(safeError, corsHeaders, "TRIAL_CHECKOUT_UNAVAILABLE", "Não foi possível iniciar o checkout do teste");
  }
});
