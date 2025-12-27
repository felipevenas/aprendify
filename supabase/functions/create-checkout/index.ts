import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Extrai priceId e código do cupom (opcional) do body da requisição
    const { priceId, couponCode } = await req.json();
    logStep("Received request", { priceId, couponCode: couponCode || "none" });

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

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

    const origin = req.headers.get("origin") || "https://lvhfwbpivankwzzwvdjj.lovable.app";
    
    // Configuração base da sessão de checkout
    const sessionConfig: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/subscription/success`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
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
        // Busca o cupom pelo código para obter o promotion_code
        const promotionCodes = await stripe.promotionCodes.list({
          code: couponCode,
          active: true,
          limit: 1,
        });
        
        if (promotionCodes.data.length > 0) {
          // Aplica o código promocional à sessão
          sessionConfig.discounts = [{ promotion_code: promotionCodes.data[0].id }];
          logStep("Coupon applied", { 
            couponCode, 
            promotionCodeId: promotionCodes.data[0].id 
          });
        } else {
          // Cupom não encontrado - permite que o usuário adicione um na página de checkout
          sessionConfig.allow_promotion_codes = true;
          logStep("Coupon not found, allowing manual entry", { couponCode });
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

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

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
