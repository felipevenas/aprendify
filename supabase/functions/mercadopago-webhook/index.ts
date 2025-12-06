import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MercadoPagoWebhook {
  action: string;
  data: {
    id: string;
  };
  type: string;
}

// Verify MercadoPago webhook signature
async function verifySignature(
  req: Request,
  body: string
): Promise<boolean> {
  const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
  
  // If no secret is configured, log warning and reject request
  if (!webhookSecret) {
    console.error('MERCADOPAGO_WEBHOOK_SECRET not configured - rejecting webhook for security');
    return false;
  }

  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');

  if (!xSignature || !xRequestId) {
    console.error('Missing signature headers');
    return false;
  }

  // Parse x-signature header (format: "ts=timestamp,v1=hash")
  const signatureParts: Record<string, string> = {};
  xSignature.split(',').forEach(part => {
    const [key, value] = part.split('=');
    if (key && value) {
      signatureParts[key.trim()] = value.trim();
    }
  });

  const ts = signatureParts['ts'];
  const v1 = signatureParts['v1'];

  if (!ts || !v1) {
    console.error('Invalid signature format');
    return false;
  }

  // Check timestamp to prevent replay attacks (5 minute window)
  const timestamp = parseInt(ts, 10);
  const now = Math.floor(Date.now() / 1000);
  const fiveMinutes = 5 * 60;
  
  if (Math.abs(now - timestamp) > fiveMinutes) {
    console.error('Webhook timestamp too old or too far in future');
    return false;
  }

  // Build the manifest string for HMAC verification
  // MercadoPago format: id:[data.id];request-id:[x-request-id];ts:[ts];
  let dataId = '';
  try {
    const parsedBody = JSON.parse(body);
    dataId = parsedBody?.data?.id || '';
  } catch {
    console.error('Failed to parse body for signature verification');
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  // Generate HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(manifest)
  );

  // Convert to hex
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Compare signatures
  if (hashHex !== v1) {
    console.error('Signature verification failed');
    return false;
  }

  console.log('Webhook signature verified successfully');
  return true;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read body as text first for signature verification
    const bodyText = await req.text();
    
    // Verify webhook signature
    const isValid = await verifySignature(req, bodyText);
    if (!isValid) {
      console.error('Webhook signature verification failed - rejecting request');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mercadoPagoToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mercadoPagoToken) {
      console.error('MERCADOPAGO_ACCESS_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const webhook: MercadoPagoWebhook = JSON.parse(bodyText);
    console.log('Received verified webhook:', JSON.stringify(webhook));

    // Only process subscription-related events
    if (webhook.type === 'subscription_preapproval' || webhook.type === 'subscription') {
      const subscriptionId = webhook.data.id;

      // Fetch subscription details from MercadoPago
      const mpResponse = await fetch(
        `https://api.mercadopago.com/preapproval/${subscriptionId}`,
        {
          headers: {
            Authorization: `Bearer ${mercadoPagoToken}`,
          },
        }
      );

      if (!mpResponse.ok) {
        console.error('Failed to fetch subscription from MercadoPago:', await mpResponse.text());
        return new Response(JSON.stringify({ error: 'Failed to fetch subscription' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const subscriptionData = await mpResponse.json();
      console.log('Subscription data:', JSON.stringify(subscriptionData));

      const payerEmail = subscriptionData.payer_email;
      const status = subscriptionData.status;
      const planId = subscriptionData.preapproval_plan_id;

      // Mapeamento de plan_id para plan_type
      // IDs conhecidos dos planos MercadoPago
      const PLAN_TYPE_MAP: Record<string, 'monthly' | 'annual'> = {
        '2fab389d1e6546429376b4a50517acd2': 'monthly',
        'aa593ab5788f43a29726b7a45381baaa': 'annual',
      };
      const planType = PLAN_TYPE_MAP[planId] || 'monthly';

      console.log(`Plan mapping: ${planId} -> ${planType}`);

      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', payerEmail)
        .single();

      if (profileError || !profile) {
        console.error('User not found for email:', payerEmail);
        // Still return 200 to prevent MercadoPago from retrying
        return new Response(JSON.stringify({ message: 'User not found' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Upsert subscription com plan_type correto
      // Usa user_id como conflict para garantir 1 subscription por usuário
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: profile.id,
          mercadopago_subscription_id: subscriptionId,
          mercadopago_payer_email: payerEmail,
          status: status,
          plan_id: planId,
          plan_type: planType,
          start_date: subscriptionData.date_created,
          end_date: subscriptionData.auto_recurring?.end_date || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (upsertError) {
        console.error('Failed to upsert subscription:', upsertError);
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Subscription processed: user=${profile.id}, status=${status}, plan_type=${planType}`);
    }

    return new Response(JSON.stringify({ message: 'Webhook processed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
