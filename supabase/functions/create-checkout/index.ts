import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { ApiError, errorResponse, jsonResponse, readJsonObject } from "../_shared/api.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import {
  rateLimitHeaders,
  consumeRateLimit,
} from "../_shared/rate-limit.ts";
import {
  requireOrderBumpPrice,
  requirePlanPrice,
  REDACAO_ADD_ON_CODE,
  resolvePlanFromConfiguredPrice,
  stripeCatalog,
  type PlanKey,
} from "../_shared/catalog.ts";
import { isAllowedPaymentReturnUrl, paymentReturnUrl } from "../_shared/redirects.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
};

function invalid(message: string): never {
  throw new ApiError(400, "INVALID_CHECKOUT_REQUEST", message);
}

function resolveItems(body: Record<string, unknown>, catalog: ReturnType<typeof stripeCatalog>) {
  const requestedPlan = body.plan === undefined
    ? null
    : body.plan === "starter" || body.plan === "annual" ? body.plan as PlanKey : null;
  const legacyPlan = body.priceId === undefined ? null : resolvePlanFromConfiguredPrice(catalog, body.priceId);
  if (body.plan !== undefined && !requestedPlan) invalid("Plano inválido");
  if (body.priceId !== undefined && !legacyPlan) invalid("Plano inválido");
  if (requestedPlan && legacyPlan && requestedPlan !== legacyPlan) invalid("Planos conflitantes");

  let plan: PlanKey | null = requestedPlan ?? legacyPlan;
  let includeBump = body.orderBump === true;
  if (body.orderBump !== undefined && body.orderBump !== true && body.orderBump !== false) invalid("Order bump inválido");
  if (body.includeOrderBump !== undefined && typeof body.includeOrderBump !== "boolean") invalid("Order bump inválido");
  if (body.includeOrderBump === true) includeBump = true;
  if (body.orderBumpPriceId !== undefined) {
    // The old client sends this symbolic key. A raw Stripe price is never accepted.
    if (body.orderBumpPriceId !== REDACAO_ADD_ON_CODE) invalid("Order bump inválido");
    includeBump = true;
  }
  if (body.quantity !== undefined && (body.quantity !== 1 || !Number.isInteger(body.quantity))) invalid("Quantidade inválida");

  if (body.items !== undefined) {
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 2) invalid("Itens inválidos");
    for (const raw of body.items) {
      if (!raw || typeof raw !== "object") invalid("Itens inválidos");
      const item = raw as Record<string, unknown>;
      if (item.quantity !== 1 || !Number.isInteger(item.quantity)) invalid("Quantidade inválida");
      const itemId = item.id ?? item.plan ?? item.priceId ?? item.price;
      if (itemId === REDACAO_ADD_ON_CODE) {
        includeBump = true;
        continue;
      }
      const itemPlan = itemId === "starter" || itemId === "annual"
        ? itemId as PlanKey
        : resolvePlanFromConfiguredPrice(catalog, itemId);
      if (!itemPlan || (plan && plan !== itemPlan)) invalid("Item não permitido");
      plan = itemPlan;
    }
  }

  if (!plan) invalid("Plano obrigatório");
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: requirePlanPrice(catalog, plan), quantity: 1 }];
  if (includeBump) lineItems.push({ price: requireOrderBumpPrice(catalog), quantity: 1 });
  return { plan, lineItems, includeOrderBump };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { user, serviceClient } = await authenticateRequest(req, corsHeaders);
    if (!user.email) throw new ApiError(422, "CHECKOUT_ACCOUNT_INVALID", "Conta não elegível para checkout");

    const limit = await consumeRateLimit(serviceClient, req, user.id, "create-checkout", 5, 60);
    if (!limit.allowed) return jsonResponse({ error: "Limite de solicitações atingido", code: "RATE_LIMITED", rateLimited: true }, 429, corsHeaders, rateLimitHeaders(limit));
    const requestHeaders = { ...corsHeaders, ...rateLimitHeaders(limit) };

    const body = await readJsonObject(req, 16 * 1024);
    const catalog = stripeCatalog();
    const { plan, lineItems, includeOrderBump } = resolveItems(body, catalog);

    for (const key of ["successUrl", "cancelUrl"] as const) {
      if (body[key] !== undefined && !isAllowedPaymentReturnUrl(body[key])) {
        throw new ApiError(400, "INVALID_RETURN_URL", "URL de retorno inválida");
      }
    }
    if (body.couponCode !== undefined && typeof body.couponCode !== "string") {
      throw new ApiError(400, "INVALID_COUPON", "Cupom inválido");
    }
    const couponCode = body.couponCode === undefined ? "" : body.couponCode.trim().toUpperCase();
    if (couponCode && (couponCode.length > 64 || !/^[A-Z0-9_-]+$/.test(couponCode))) {
      throw new ApiError(400, "INVALID_COUPON", "Cupom inválido");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new ApiError(503, "PAYMENT_UNAVAILABLE", "Pagamento temporariamente indisponível");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 10 });
    const customer = customers.data.find((candidate) => !candidate.metadata?.user_id || candidate.metadata.user_id === user.id);

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
      const { data: creatorCoupon, error } = await serviceClient
        .from("creator_coupons")
        .select("id, coupon_code")
        .eq("coupon_code", couponCode)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw new ApiError(503, "COUPON_LOOKUP_UNAVAILABLE", "Cupom temporariamente indisponível");
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

    const session = await stripe.checkout.sessions.create(sessionConfig);
    if (!session.url) throw new ApiError(503, "CHECKOUT_UNAVAILABLE", "Checkout temporariamente indisponível");
    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: requestHeaders });
  } catch (error) {
    return errorResponse(error, corsHeaders, "CHECKOUT_UNAVAILABLE", "Não foi possível iniciar o checkout");
  }
});
