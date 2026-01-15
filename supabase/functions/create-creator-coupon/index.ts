import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CREATOR-COUPON] ${step}${detailsStr}`);
};

// Validation functions
const isValidCouponCode = (code: string): { valid: boolean; error?: string } => {
  if (!code || code.trim() === "") {
    return { valid: false, error: "Código de cupom é obrigatório" };
  }

  const trimmedCode = code.trim().toUpperCase();

  // Check length (max 12 characters)
  if (trimmedCode.length > 12) {
    return { valid: false, error: "Código de cupom deve ter no máximo 12 caracteres" };
  }

  // Check for only alphanumeric characters
  if (!/^[A-Z0-9]+$/.test(trimmedCode)) {
    return { valid: false, error: "Código de cupom deve conter apenas letras e números" };
  }

  // Check minimum length
  if (trimmedCode.length < 3) {
    return { valid: false, error: "Código de cupom deve ter no mínimo 3 caracteres" };
  }

  return { valid: true };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const adminUser = userData.user;
    if (!adminUser) throw new Error("User not authenticated");

    // Check if user is admin
    const { data: roleData } = await supabaseClient.rpc("get_user_role", { _user_id: adminUser.id });
    if (roleData !== "admin") {
      throw new Error("User is not an admin");
    }
    logStep("Admin verified", { adminId: adminUser.id });

    // Parse request body
    const { userId, couponCode } = await req.json();
    if (!userId || !couponCode) {
      throw new Error("userId and couponCode are required");
    }

    const formattedCouponCode = couponCode.trim().toUpperCase();
    logStep("Request data", { userId, couponCode: formattedCouponCode });

    // Validate coupon code
    const validation = isValidCouponCode(formattedCouponCode);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check if user already has an ACTIVE coupon
    const { data: existingUserCoupon } = await supabaseClient
      .from("creator_coupons")
      .select("id, coupon_code, is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingUserCoupon) {
      if (existingUserCoupon.is_active) {
        throw new Error(`Este usuário já possui um cupom ativo: ${existingUserCoupon.coupon_code}`);
      }
      
      // Get the original creation date before deleting
      const { data: fullCouponData } = await supabaseClient
        .from("creator_coupons")
        .select("created_at")
        .eq("id", existingUserCoupon.id)
        .single();
      
      // Save to history before deleting
      const { error: historyError } = await supabaseClient
        .from("creator_coupon_history")
        .insert({
          user_id: userId,
          coupon_code: existingUserCoupon.coupon_code,
          created_at: fullCouponData?.created_at || new Date().toISOString(),
          revoked_by: adminUser.id,
          reason: 'replaced_with_new_coupon'
        });
      
      if (historyError) {
        logStep("Error saving coupon to history", { error: historyError.message });
        // Continue anyway, history is not critical
      } else {
        logStep("Saved old coupon to history", { oldCoupon: existingUserCoupon.coupon_code });
      }
      
      // If coupon exists but is inactive, delete it to allow creating a new one
      const { error: deleteError } = await supabaseClient
        .from("creator_coupons")
        .delete()
        .eq("id", existingUserCoupon.id);
      
      if (deleteError) {
        logStep("Error deleting inactive coupon", { error: deleteError.message });
        throw new Error("Erro ao remover cupom antigo inativo");
      }
      logStep("Deleted inactive coupon to allow new creation", { oldCoupon: existingUserCoupon.coupon_code });
    }

    // Check if coupon code already exists in database
    const { data: existingDbCoupon } = await supabaseClient
      .from("creator_coupons")
      .select("id")
      .eq("coupon_code", formattedCouponCode)
      .maybeSingle();

    if (existingDbCoupon) {
      throw new Error("Este código de cupom já está em uso por outro criador");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if promotion code already exists in Stripe
    const existingPromoCodes = await stripe.promotionCodes.list({ code: formattedCouponCode, limit: 1 });
    if (existingPromoCodes.data.length > 0) {
      throw new Error("Este código de cupom já existe no Stripe");
    }

    // First, check if there's already a coupon for 15% off creators or create one
    let stripeCouponId: string;
    const couponName = "Criador Afiliado - 15% OFF";

    // Try to find existing coupon
    const existingCoupons = await stripe.coupons.list({ limit: 100 });
    const existingCoupon = existingCoupons.data.find(
      (c: { name: string | null; percent_off: number | null; duration: string; valid: boolean }) =>
        c.name === couponName && c.percent_off === 15 && c.duration === "forever" && c.valid,
    );

    if (existingCoupon) {
      stripeCouponId = existingCoupon.id;
      logStep("Using existing Stripe coupon", { couponId: stripeCouponId });
    } else {
      // Create a new coupon for creators - 15% off forever
      const newCoupon = await stripe.coupons.create({
        name: couponName,
        percent_off: 15,
        duration: "forever",
      });
      stripeCouponId = newCoupon.id;
      logStep("Created new Stripe coupon", { couponId: stripeCouponId });
    }

    // Create a unique promotion code for this creator
    const promotionCode = await stripe.promotionCodes.create({
      coupon: stripeCouponId,
      code: formattedCouponCode,
      active: true,
      metadata: {
        creator_user_id: userId,
        type: "creator_affiliate",
      },
    });
    logStep("Created Stripe promotion code", {
      promoCodeId: promotionCode.id,
      code: promotionCode.code,
    });

    // Create or update subscription to creator type
    const { data: existingSubscription } = await supabaseClient
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingSubscription) {
      const { error } = await supabaseClient
        .from("subscriptions")
        .update({
          status: "authorized",
          plan_type: "creator",
          plan_id: "creator_grant",
          start_date: new Date().toISOString(),
          end_date: null,
        })
        .eq("user_id", userId);

      if (error) throw error;
    } else {
      const { error } = await supabaseClient.from("subscriptions").insert({
        user_id: userId,
        status: "authorized",
        plan_type: "creator",
        plan_id: "creator_grant",
        start_date: new Date().toISOString(),
        end_date: null,
      });

      if (error) throw error;
    }
    logStep("Subscription created/updated");

    // Create coupon in database with Stripe promotion code reference
    const { error: couponError } = await supabaseClient.from("creator_coupons").insert({
      user_id: userId,
      coupon_code: formattedCouponCode,
      is_active: true,
    });

    if (couponError) throw couponError;
    logStep("Database coupon created");

    return new Response(
      JSON.stringify({
        success: true,
        promotionCodeId: promotionCode.id,
        code: promotionCode.code,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
