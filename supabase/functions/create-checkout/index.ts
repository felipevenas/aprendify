import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { ApiError, errorResponse, jsonResponse, readJsonObject } from "../_shared/api.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import {
  rateLimitHeaders,
  consumeRateLimit,
} from "../_shared/rate-limit.ts";
import {
  REDACAO_ADD_ON_CODE,
  stripeCatalog,
} from "../_shared/catalog.ts";
import { isAllowedPaymentReturnUrl, paymentReturnUrl } from "../_shared/redirects.ts";
import { checkoutFailure } from "./checkout-errors.ts";
import { resolveItems } from "./checkout-items.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  let stage = "authenticate";
  try {
    const { user, serviceClient } = await authenticateRequest(req, corsHeaders);
    if (!user.email) throw new ApiError(422, "CHECKOUT_ACCOUNT_INVALID", "Conta não elegível para checkout");

    stage = "rate_limit";
    const limit = await consumeRateLimit(serviceClient, req, user.id, "create-checkout", 5, 60);
    if (!limit.allowed) return jsonResponse({ error: "Limite de solicitações atingido", code: "RATE_LIMITED", rateLimited: true }, 429, corsHeaders, rateLimitHeaders(limit));
    const requestHeaders = { ...corsHeaders, ...rateLimitHeaders(limit) };

    stage = "read_body";
    const body = await readJsonObject(req, 16 * 1024);
    stage = "catalog";
    const catalog = stripeCatalog();
    stage = "resolve_items";
    const { plan, lineItems, includeOrderBump } = resolveItems(body, catalog);

    stage = "return_urls";
    for (const key of ["successUrl", "cancelUrl"] as const) {
      if (body[key] !== undefined && !isAllowedPaymentReturnUrl(body[key])) {
        throw new ApiError(400, "INVALID_RETURN_URL", "URL de retorno inválida");
      }
    }
    stage = "coupon_validation";
    if (body.couponCode !== undefined && typeof body.couponCode !== "string") {
      throw new ApiError(400, "INVALID_COUPON", "Cupom inválido");
    }
    const couponCode = body.couponCode === undefined ? "" : body.couponCode.trim().toUpperCase();
    if (couponCode && (couponCode.length > 64 || !/^[A-Z0-9_-]+$/.test(couponCode))) {
      throw new ApiError(400, "INVALID_COUPON", "Cupom inválido");
    }

    stage = "stripe_init";
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new ApiError(503, "PAYMENT_UNAVAILABLE", "Pagamento temporariamente indisponível");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil", timeout: 10_000 });
    stage = "customers";
    const customers = await stripe.customers.list({ email: user.email, limit: 10 });
    const customer = customers.data.find((candidate) =>
      candidate.metadata?.aprendify_trial_only !== "true" &&
      (!candidate.metadata?.user_id || candidate.metadata.user_id === user.id)
    );

    const addOnMetadata = includeOrderBump ? REDACAO_ADD_ON_CODE : "none";
    const sessionMetadata = { user_id: user.id, plan, add_on: addOnMetadata };
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      ...(customer ? { customer: customer.id } : { customer_email: user.email }),
      line_items: lineItems,
      mode: "subscription",
      success_url: paymentReturnUrl(body.successUrl, "/subscription/success"),
      cancel_url: paymentReturnUrl(body.cancelUrl, "/dashboard?payment=cancelled"),
      metadata: sessionMetadata,
      subscription_data: { metadata: sessionMetadata },
      allow_promotion_codes: !couponCode,
    };

    if (couponCode) {
      stage = "coupon_lookup";
      const { data: creatorCoupon, error } = await serviceClient
        .from("creator_coupons")
        .select("id, coupon_code")
        .eq("coupon_code", couponCode)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw new ApiError(503, "COUPON_LOOKUP_UNAVAILABLE", "Cupom temporariamente indisponível");
      stage = "promotion_codes";
      const promotionCodes = await stripe.promotionCodes.list({ code: couponCode, active: true, limit: 1 });
      if (promotionCodes.data[0]) sessionConfig.discounts = [{ promotion_code: promotionCodes.data[0].id }];
      if (creatorCoupon) {
        sessionConfig.metadata = { ...sessionConfig.metadata, creator_coupon_id: creatorCoupon.id, creator_coupon_code: creatorCoupon.coupon_code };
        sessionConfig.subscription_data = {
          ...sessionConfig.subscription_data,
          metadata: { ...sessionConfig.subscription_data?.metadata, creator_coupon_id: creatorCoupon.id, creator_coupon_code: creatorCoupon.coupon_code },
        };
      }
      if (!promotionCodes.data[0]) sessionConfig.allow_promotion_codes = true;
    }

    stage = "session";
    const session = await stripe.checkout.sessions.create(sessionConfig);
    if (!session.url) throw new ApiError(503, "CHECKOUT_UNAVAILABLE", "Checkout temporariamente indisponível");
    return jsonResponse({ url: session.url }, 200, requestHeaders);
  } catch (error) {
    return errorResponse(checkoutFailure(error, stage), corsHeaders);
  }
});
