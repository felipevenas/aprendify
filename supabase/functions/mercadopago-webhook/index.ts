// webhook_mercadopago.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ----------------------------------------------------------
// VERIFICAÇÃO DE ASSINATURA DO MERCADOPAGO (SEGURANÇA)
// ----------------------------------------------------------
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
  if (!secret) return false;

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  if (!xSignature || !xRequestId) return false;

  // x-signature vem no formato: ts=1234,v1=HASH
  const parts: Record<string, string> = {};
  xSignature.split(",").forEach((p) => {
    const [k, v] = p.split("=");
    parts[k.trim()] = v.trim();
  });

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  // Validar timestamp ±5min
  const timeNow = Math.floor(Date.now() / 1000);
  if (Math.abs(timeNow - parseInt(ts)) > 300) return false;

  const parsed = JSON.parse(rawBody);
  const dataId = parsed?.data?.id || "";

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);

  const hashBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
  const hashHex = [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex === v1;
}

// ----------------------------------------------------------
// FUNÇÕES AUXILIARES
// ----------------------------------------------------------
async function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function success(body: any) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(msg: any, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ----------------------------------------------------------
// HANDLER PRINCIPAL
// ----------------------------------------------------------
Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const rawBody = await req.text();

  // Verificação da assinatura
  const valid = await verifySignature(req, rawBody);
  if (!valid) return fail("Invalid signature", 401);

  const supabase = await getSupabaseClient();
  const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

  const webhook = JSON.parse(rawBody);
  console.log("WEBHOOK RECEBIDO:", webhook);

  // ==========================================================
  // 1) PROCESSAR PAGAMENTOS ÚNICOS
  // ==========================================================
  if (webhook.type === "payment") {
    const paymentId = webhook.data.id;

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });

    const payment = await mpRes.json();
    console.log("PAGAMENTO:", payment);

    if (payment.status !== "approved") return success({ message: "Payment not approved" });

    const userId = payment.metadata?.user_id;
    if (!userId) return success({ message: "Missing user_id" });

    await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        status: "active",
        plan_type: payment.metadata?.plan_type || "monthly",
        mercadopago_payment_id: paymentId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    console.log("PREMIUM LIBERADO PARA USER:", userId);
    return success({ message: "Payment processed" });
  }

  // ==========================================================
  // 2) PROCESSAR ASSINATURAS (PREAPPROVAL)
  // ==========================================================
  if (webhook.type === "subscription" || webhook.type === "subscription_preapproval") {
    const subscriptionId = webhook.data.id;

    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    });

    const sub = await mpRes.json();
    console.log("ASSINATURA:", sub);

    const email = sub.payer_email;
    const status = sub.status;

    const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).single();

    if (!profile) return success({ message: "User not found" });

    const planMap: Record<string, string> = {
      "2fab389d1e6546429376b4a50517acd2": "monthly",
      "aa593ab5788f43a29726b7a45381baaa": "annual",
    };

    const planType = planMap[sub.preapproval_plan_id] || "monthly";

    await supabase.from("subscriptions").upsert(
      {
        user_id: profile.id,
        status: status,
        plan_id: sub.preapproval_plan_id,
        plan_type: planType,
        mercadopago_subscription_id: subscriptionId,
        start_date: sub.date_created,
        end_date: sub.auto_recurring?.end_date ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    console.log("ASSINATURA PROCESSADA PARA USER:", profile.id);
    return success({ message: "Subscription processed" });
  }

  // ==========================================================
  // 3) OUTROS EVENTOS
  // ==========================================================
  return success({ message: "Webhook ignored" });
});
