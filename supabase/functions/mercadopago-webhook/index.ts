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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const webhook: MercadoPagoWebhook = await req.json();
    console.log('Received webhook:', JSON.stringify(webhook));

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

      // Upsert subscription
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: profile.id,
          mercadopago_subscription_id: subscriptionId,
          mercadopago_payer_email: payerEmail,
          status: status,
          plan_id: planId,
          start_date: subscriptionData.date_created,
          end_date: subscriptionData.auto_recurring?.end_date || null,
        }, {
          onConflict: 'mercadopago_subscription_id',
        });

      if (upsertError) {
        console.error('Failed to upsert subscription:', upsertError);
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Subscription processed successfully for user:', profile.id);
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
