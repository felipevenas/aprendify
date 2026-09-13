import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { ApiError, errorResponse, jsonResponse } from "../_shared/api.ts";
import {
  REDACAO_ADD_ON_CODE,
  resolvePlanFromConfiguredPrice,
  stripeCatalog,
} from "../_shared/catalog.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

type BackendClient = ReturnType<typeof createClient>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_BODY_BYTES = 256 * 1024;

function logStep(step: string) {
  console.log(`[STRIPE-WEBHOOK] ${step}`);
}

function requiredUserId(metadata: Stripe.Metadata | null | undefined): string {
  const userId = metadata?.user_id;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new ApiError(422, "WEBHOOK_USER_BINDING_MISSING", "Evento sem vínculo de usuário válido");
  }
  return userId;
}

function hasRedacaoAddOnMetadata(metadata: Stripe.Metadata | null | undefined): boolean {
  return metadata?.add_on === REDACAO_ADD_ON_CODE;
}

function requireRedacaoAddOnCredits(): number {
  const raw = Deno.env.get("STRIPE_ORDER_BUMP_CREDITS")?.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    throw new ApiError(503, "ADD_ON_CREDITS_NOT_CONFIGURED", "Benefício do adicional temporariamente indisponível");
  }
  const amount = Number(raw);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000) {
    throw new ApiError(503, "ADD_ON_CREDITS_NOT_CONFIGURED", "Benefício do adicional temporariamente indisponível");
  }
  return amount;
}

function subscriptionHasRedacaoAddOn(subscription: Stripe.Subscription): boolean {
  const configuredPrices = stripeCatalog().orderBumpRedacao;
  return subscription.items.data.some((item) => {
    const priceId = item.price?.id;
    return typeof priceId === "string" && configuredPrices.includes(priceId);
  });
}

async function grantRedacaoAddOnCredits(
  supabase: BackendClient,
  sourceEventId: string,
  userId: string,
  session: Stripe.Checkout.Session,
  subscription: Stripe.Subscription,
): Promise<void> {
  // A completed checkout plus both server-written metadata copies and the
  // configured Stripe price are required before granting the benefit.
  const sessionConfirmsAddOn = hasRedacaoAddOnMetadata(session.metadata);
  const subscriptionConfirmsAddOn = hasRedacaoAddOnMetadata(subscription.metadata);
  if (!sessionConfirmsAddOn && !subscriptionConfirmsAddOn) {
    return;
  }
  if (!sessionConfirmsAddOn || !subscriptionConfirmsAddOn || !subscriptionHasRedacaoAddOn(subscription)) {
    throw new ApiError(422, "ADD_ON_CONFIRMATION_FAILED", "Não foi possível confirmar o adicional de redação");
  }

  const { error } = await supabase.rpc("grant_essay_addon_credits", {
    _source_event_id: sourceEventId,
    _user_id: userId,
    _amount: requireRedacaoAddOnCredits(),
  });
  if (error) throw new ApiError(503, "ADD_ON_CREDITS_PERSISTENCE_FAILED", "Benefício do adicional temporariamente indisponível");
}

async function recordCreatorCouponRedemption(
  supabase: BackendClient,
  creatorCouponId: string,
  redeemedByUserId: string,
  subscriptionDbId: string | null,
) {
  const { error } = await supabase.from("coupon_redemptions").upsert({
    coupon_id: creatorCouponId,
    redeemed_by: redeemedByUserId,
    subscription_id: subscriptionDbId,
  }, { onConflict: "coupon_id,redeemed_by", ignoreDuplicates: true });
  if (error) throw new Error("Coupon redemption persistence failed");
}

async function processSubscription(
  supabase: BackendClient,
  eventId: string,
  eventCreated: number,
  subscription: Stripe.Subscription,
  userId: string,
): Promise<string> {
  const priceId = subscription.items.data
    .map((item) => item.price?.id)
    .find((candidate) => resolvePlanFromConfiguredPrice(stripeCatalog(), candidate));
  if (!priceId) throw new Error("Subscription price missing");
  const catalog = stripeCatalog();
  const plan = resolvePlanFromConfiguredPrice(catalog, priceId);
  if (!plan) throw new Error("Subscription price is not configured");
  const planType = plan === "annual" ? "annual" : "monthly";
  const status = subscription.status === "active" ? "authorized" : subscription.status;
  const startDate = subscription.start_date ? new Date(subscription.start_date * 1000).toISOString() : new Date().toISOString();
  const endDate = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;

  const { data, error } = await supabase.rpc("record_subscription_projection", {
    _event_id: eventId,
    _event_created: eventCreated,
    _user_id: userId,
    _stripe_subscription_id: subscription.id,
    _stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : null,
    _status: status,
    _plan_type: planType,
    _start_date: startDate,
    _end_date: endDate,
  });
  if (error || !data) throw new Error("Subscription projection persistence failed");
  return String(data);
}

async function processEvent(supabase: BackendClient, stripe: Stripe, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) return;
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const userId = requiredUserId(session.metadata?.user_id ? session.metadata : subscription.metadata);
      const subscriptionDbId = await processSubscription(supabase, event.id, event.created, subscription, userId);
      await grantRedacaoAddOnCredits(supabase, event.id, userId, session, subscription);
      const couponId = session.metadata?.creator_coupon_id ?? subscription.metadata?.creator_coupon_id;
      if (couponId) await recordCreatorCouponRedemption(supabase, couponId, userId, subscriptionDbId);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await processSubscription(supabase, event.id, event.created, subscription, requiredUserId(subscription.metadata));
      return;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const { data, error } = await supabase.rpc("record_subscription_status_event", {
        _event_id: event.id,
        _event_created: event.created,
        _stripe_subscription_id: subscription.id,
        _status: "cancelled",
      });
      if (error) throw new Error("Subscription cancellation persistence failed");
      if (!data) throw new ApiError(503, "SUBSCRIPTION_PROJECTION_MISSING", "Projeção da assinatura ainda não disponível");
      return;
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.subscription) return;
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
      await processSubscription(supabase, event.id, event.created, subscription, requiredUserId(subscription.metadata));
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.subscription) return;
      const { data, error } = await supabase.rpc("record_subscription_status_event", {
        _event_id: event.id,
        _event_created: event.created,
        _stripe_subscription_id: invoice.subscription as string,
        _status: "payment_failed",
      });
      if (error) throw new Error("Payment failure persistence failed");
      if (!data) throw new ApiError(503, "SUBSCRIPTION_PROJECTION_MISSING", "Projeção da assinatura ainda não disponível");
      return;
    }
    default:
      return;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ code: "METHOD_NOT_ALLOWED", error: "Método não permitido" }, 405, { ...corsHeaders, Allow: "POST, OPTIONS" });

  let eventId: string | null = null;
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey || !webhookSecret) throw new ApiError(503, "WEBHOOK_NOT_CONFIGURED", "Webhook temporariamente indisponível");
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new ApiError(400, "WEBHOOK_SIGNATURE_MISSING", "Assinatura inválida");
    const body = await req.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      throw new ApiError(413, "WEBHOOK_PAYLOAD_TOO_LARGE", "Payload excede o limite permitido");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch {
      throw new ApiError(400, "WEBHOOK_SIGNATURE_INVALID", "Assinatura inválida");
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: claimData, error: claimError } = await supabase.rpc("claim_stripe_webhook_event", {
      _event_id: event.id,
      _event_type: event.type,
      _payload: JSON.parse(body),
    });
    if (claimError) throw new ApiError(503, "WEBHOOK_INBOX_UNAVAILABLE", "Processamento temporariamente indisponível");
    const claim = Array.isArray(claimData) ? claimData[0] : claimData;
    if (!claim?.claimed) {
      if (claim?.current_status === "processed") return jsonResponse({ received: true, duplicate: true }, 200, corsHeaders);
      // Another worker owns the lease. Return 5xx so Stripe retries if that worker fails.
      throw new ApiError(500, "WEBHOOK_PROCESSING_IN_PROGRESS", "Processamento ainda em andamento");
    }
    eventId = event.id;

    logStep(`processing ${event.type}`);
    await processEvent(supabase, stripe, event);
    const { error: completeError } = await supabase.rpc("complete_stripe_webhook_event", { _event_id: event.id });
    if (completeError) throw new Error("Webhook completion persistence failed");
    return jsonResponse({ received: true }, 200, corsHeaders);
  } catch (error) {
    if (eventId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        await supabase.rpc("fail_stripe_webhook_event", { _event_id: eventId, _error_code: error instanceof ApiError ? error.code : "PROCESSING_FAILED" });
      } catch {
        // The original 5xx remains the retry signal if failure recording also fails.
      }
    }
    return errorResponse(error, corsHeaders, "WEBHOOK_PROCESSING_FAILED", "Webhook não processado");
  }
});
