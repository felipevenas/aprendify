import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    
    if (!token || token.length > 4096) {
      console.error("Token reCAPTCHA não fornecido");
      return new Response(
        JSON.stringify({ success: false, error: "Token não fornecido" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const secretKey = Deno.env.get('RECAPTCHA_SECRET_KEY');
    
    if (!secretKey) {
      console.error("RECAPTCHA_SECRET_KEY não configurada nos secrets");
      return new Response(
        JSON.stringify({ success: false, error: "Configuração do servidor inválida" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar token com a API do Google
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secretKey}&response=${token}`,
    });

    const result = await response.json();
    
    console.log("reCAPTCHA verification result:", { 
      success: result.success, 
      errorCodes: result['error-codes'],
      hostname: result.hostname,
      challenge_ts: result.challenge_ts
    });

    const allowedHostnames = new Set(['app.aprendify.cloud', 'aprendify.cloud', 'www.aprendify.cloud', 'localhost']);
    const hostname = typeof result.hostname === 'string' ? result.hostname.toLowerCase() : '';
    if (!result.success || !allowedHostnames.has(hostname)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Verificação reCAPTCHA falhou",
          errorCodes: result['error-codes'] 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("Erro na verificação reCAPTCHA:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
