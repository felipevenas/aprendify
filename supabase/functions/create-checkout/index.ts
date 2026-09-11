import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration - prevent checkout abuse
const RATE_LIMIT_MAX_CALLS = 5; // 5 checkout attempts per hour
const RATE_LIMIT_WINDOW_MINUTES = 60;

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logStep("Function started");

    // Extrai priceId, orderBumpPriceId, items, cupom e URLs customizadas do body
    const { priceId, orderBumpPriceId, items, couponCode, successUrl, cancelUrl } = await req.json();
    logStep("Received request", { priceId, orderBumpPriceId, itemsCount: items?.length, couponCode: couponCode || "none" });

    const authHeader = req.headers.get("Authorization")!;
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated", { userId: user.id });

    // Check rate limit to prevent checkout abuse
    const { data: rateLimitAllowed, error: rateLimitError } = await supabaseAdmin
      .rpc("check_rate_limit", {
        _user_id: user.id,
        _function_name: "create-checkout",
        _max_calls: RATE_LIMIT_MAX_CALLS,
        _window_minutes: RATE_LIMIT_WINDOW_MINUTES,
      });

    if (rateLimitError) {
      logStep("Rate limit check error", { error: rateLimitError.message });
    } else if (!rateLimitAllowed) {
      logStep("Rate limit exceeded", { userId: user.id });
      return new Response(
        JSON.stringify({ 
          error: "Muitas tentativas de checkout. Tente novamente em 1 hora.",
          rateLimited: true 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    const rawOrigin = req.headers.get("origin") || "";
    // Se a requisição veio de um subdomínio de vendas ou página externa, direciona o retorno para a plataforma principal
    const defaultAppUrl = "https://www.aprendify.cloud";
    const resolvedOrigin = rawOrigin.includes("aprendify.cloud") ? defaultAppUrl : (rawOrigin || defaultAppUrl);
    
    // Montagem dinâmica dos line_items
    let checkoutLineItems: Array<{ price: string; quantity: number }> = [];
    if (Array.isArray(items) && items.length > 0) {
      checkoutLineItems = items.map((it: any) => ({
        price: it.price || it.priceId,
        quantity: it.quantity || 1,
      }));
    } else if (priceId) {
      checkoutLineItems.push({
        price: priceId,
        quantity: 1,
      });
      if (orderBumpPriceId) {
        checkoutLineItems.push({
          price: orderBumpPriceId,
          quantity: 1,
        });
      }
    } else {
      throw new Error("Nenhum item ou priceId especificado para o checkout");
    }

    // Variável para guardar o código do cupom de criador validado
    let validatedCreatorCouponCode: string | null = null;
    let creatorCouponId: string | null = null;
    
    // Configuração base da sessão de checkout
    const sessionConfig: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: checkoutLineItems,
      mode: "subscription",
      success_url: successUrl || `${resolvedOrigin}/subscription/success`,
      cancel_url: cancelUrl || `${resolvedOrigin}/dashboard?payment=cancelled`,
      metadata: {
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
      },
      // Permite que o cupom pré-preenchido seja editado pelo usuário
      allow_promotion_codes: !couponCode,
    };
    
    // Se um código de cupom foi fornecido, valida e aplica
    if (couponCode) {
      try {
        // Primeiro, verifica se é um cupom de criador no banco de dados
        const { data: creatorCoupon } = await supabaseAdmin
          .from("creator_coupons")
          .select("id, coupon_code, user_id")
          .eq("coupon_code", couponCode.toUpperCase())
          .eq("is_active", true)
          .maybeSingle();
        
        if (creatorCoupon) {
          logStep("Found creator coupon in database", { 
            couponCode: creatorCoupon.coupon_code,
            creatorId: creatorCoupon.user_id 
          });
          validatedCreatorCouponCode = creatorCoupon.coupon_code;
          creatorCouponId = creatorCoupon.id;
          
          // Adiciona o cupom do criador aos metadados para rastreamento
          sessionConfig.metadata.creator_coupon_code = creatorCoupon.coupon_code;
          sessionConfig.metadata.creator_coupon_id = creatorCoupon.id;
          sessionConfig.subscription_data.metadata.creator_coupon_code = creatorCoupon.coupon_code;
          sessionConfig.subscription_data.metadata.creator_coupon_id = creatorCoupon.id;
        }
        
        // Busca o cupom no Stripe pelo código para obter o promotion_code
        const promotionCodes = await stripe.promotionCodes.list({
          code: couponCode,
          active: true,
          limit: 1,
        });
        
        if (promotionCodes.data.length > 0) {
          // Aplica o código promocional à sessão
          sessionConfig.discounts = [{ promotion_code: promotionCodes.data[0].id }];
          logStep("Stripe promotion code applied", { 
            couponCode, 
            promotionCodeId: promotionCodes.data[0].id 
          });
        } else if (validatedCreatorCouponCode) {
          // Cupom de criador encontrado mas sem promoção no Stripe
          // Ainda assim rastreamos, mas permite códigos promocionais manuais
          logStep("Creator coupon tracked but no Stripe promo found", { couponCode });
          sessionConfig.allow_promotion_codes = true;
        } else {
          // Cupom não encontrado em lugar nenhum
          sessionConfig.allow_promotion_codes = true;
          logStep("Coupon not found anywhere, allowing manual entry", { couponCode });
        }
      } catch (couponError) {
        // Em caso de erro ao buscar cupom, permite entrada manual
        logStep("Error fetching coupon, allowing manual entry", { 
          error: couponError instanceof Error ? couponError.message : String(couponError) 
        });
        sessionConfig.allow_promotion_codes = true;
      }
    }
    
    const session = await stripe.checkout.sessions.create(sessionConfig);

    logStep("Checkout session created", { 
      sessionId: session.id, 
      url: session.url,
      creatorCoupon: validatedCreatorCouponCode || "none"
    });

    return new Response(JSON.stringify({ url: session.url }), {
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
