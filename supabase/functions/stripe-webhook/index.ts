import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Função para registrar resgate de cupom de criador
async function recordCreatorCouponRedemption(
  supabase: any,
  creatorCouponId: string,
  redeemedByUserId: string,
  subscriptionDbId: string | null
) {
  try {
    // Verifica se já existe um resgate para este usuário e cupom
    const { data: existingRedemption } = await supabase
      .from("coupon_redemptions")
      .select("id")
      .eq("coupon_id", creatorCouponId)
      .eq("redeemed_by", redeemedByUserId)
      .maybeSingle();
    
    if (existingRedemption) {
      logStep("Coupon redemption already exists, skipping", { 
        couponId: creatorCouponId, 
        userId: redeemedByUserId 
      });
      return;
    }
    
    const { error } = await supabase
      .from("coupon_redemptions")
      .insert({
        coupon_id: creatorCouponId,
        redeemed_by: redeemedByUserId,
        subscription_id: subscriptionDbId,
      });
    
    if (error) {
      logStep("Error recording coupon redemption", { error });
    } else {
      logStep("Creator coupon redemption recorded successfully", { 
        couponId: creatorCouponId, 
        userId: redeemedByUserId 
      });
    }
  } catch (error) {
    logStep("Error in recordCreatorCouponRedemption", { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const body = await req.text();

    logStep("Webhook received", { hasSignature: !!signature, hasSecret: !!webhookSecret });

    // SECURITY: Always require signature verification in production
    if (!webhookSecret) {
      logStep("STRIPE_WEBHOOK_SECRET is not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!signature) {
      logStep("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Webhook signature verified successfully");
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { 
          sessionId: session.id, 
          customerId: session.customer,
          subscriptionId: session.subscription,
          metadata: session.metadata
        });

        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          const userId = session.metadata?.user_id || subscription.metadata?.user_id;
          
          // Captura o cupom de criador dos metadados
          const creatorCouponId = session.metadata?.creator_coupon_id || subscription.metadata?.creator_coupon_id;
          const creatorCouponCode = session.metadata?.creator_coupon_code || subscription.metadata?.creator_coupon_code;
          
          if (creatorCouponCode) {
            logStep("Creator coupon found in session", { 
              couponId: creatorCouponId,
              couponCode: creatorCouponCode 
            });
          }
          
          if (!userId) {
            logStep("No user_id found in metadata, trying to find by email");
            const customerEmail = session.customer_email || 
              (session.customer ? (await stripe.customers.retrieve(session.customer as string) as Stripe.Customer).email : null);
            
            if (customerEmail) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("id")
                .eq("email", customerEmail)
                .maybeSingle();
              
              if (profile) {
                const subscriptionDbId = await processSubscription(supabase, stripe, subscription, profile.id);
                
                // Registra o resgate do cupom do criador
                if (creatorCouponId && profile.id) {
                  await recordCreatorCouponRedemption(supabase, creatorCouponId, profile.id, subscriptionDbId);
                }
              } else {
                logStep("User not found by email", { email: customerEmail });
              }
            }
          } else {
            const subscriptionDbId = await processSubscription(supabase, stripe, subscription, userId);
            
            // Registra o resgate do cupom do criador
            if (creatorCouponId && userId) {
              await recordCreatorCouponRedemption(supabase, creatorCouponId, userId, subscriptionDbId);
            }
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription event", { 
          subscriptionId: subscription.id, 
          status: subscription.status,
          customerId: subscription.customer 
        });

        const userId = subscription.metadata?.user_id;
        if (userId) {
          await processSubscription(supabase, stripe, subscription, userId);
        } else {
          // Try to find user by customer email
          const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
          if (customer.email) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("email", customer.email)
              .maybeSingle();
            
            if (profile) {
              await processSubscription(supabase, stripe, subscription, profile.id);
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription cancelled", { subscriptionId: subscription.id });

        // Find and update subscription in database
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_subscription_id", subscription.id)
          .maybeSingle();

        if (existingSub) {
          await supabase
            .from("subscriptions")
            .update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscription.id);
          logStep("Subscription marked as cancelled in database");
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment succeeded", { invoiceId: invoice.id, subscriptionId: invoice.subscription });
        
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const userId = subscription.metadata?.user_id;
          
          if (userId) {
            await processSubscription(supabase, stripe, subscription, userId);
          } else {
            // Try to find user by customer email
            const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
            if (customer.email) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("id")
                .eq("email", customer.email)
                .maybeSingle();
              
              if (profile) {
                await processSubscription(supabase, stripe, subscription, profile.id);
              }
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Invoice payment failed", { invoiceId: invoice.id, subscriptionId: invoice.subscription });
        
        if (invoice.subscription) {
          await supabase
            .from("subscriptions")
            .update({
              status: "payment_failed",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", invoice.subscription);
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function processSubscription(
  supabase: any,
  stripe: Stripe,
  subscription: Stripe.Subscription,
  userId: string
): Promise<string | null> {
  try {
    const priceId = subscription.items.data[0]?.price?.id;
    if (!priceId) {
      logStep("No price ID found in subscription");
      return null;
    }
    
    const price = await stripe.prices.retrieve(priceId);
    const planType = price.recurring?.interval === "year" ? "annual" : "monthly";
    
    const status = subscription.status === "active" ? "authorized" : subscription.status;
    
    // Safely handle dates - use current time as fallback for start_date
    const startDate = subscription.start_date 
      ? new Date(subscription.start_date * 1000).toISOString()
      : new Date().toISOString();
    
    const endDate = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    const { data, error } = await supabase.from("subscriptions").upsert({
      user_id: userId,
      status: status,
      plan_type: planType,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      start_date: startDate,
      end_date: endDate,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }).select("id").single();

    if (error) {
      logStep("Error upserting subscription", { error });
      return null;
    } else {
      logStep("Subscription processed successfully", { 
        userId, 
        status, 
        planType,
        subscriptionId: subscription.id,
        dbId: data?.id
      });
      return data?.id || null;
    }
  } catch (error) {
    logStep("Error in processSubscription", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
