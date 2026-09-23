import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { consumeRateLimit, rateLimitHeaders } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
};

// Rate limit configuration
const RATE_LIMIT_MAX_CALLS = 5; // 5 calls per hour
const RATE_LIMIT_WINDOW_MINUTES = 60;

/**
 * Edge function to generate ENEM-style essay topics using AI
 * Returns a pertinent, current topic similar to official ENEM essays
 * Requires authentication and enforces rate limiting
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[generate-essay-topic] No authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user token to verify authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error("[generate-essay-topic] Auth failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User authenticated successfully

    // Check rate limit using service role client
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Topic generation is part of the Premium simulado flow. Enforce the
    // entitlement here as well as at the client/database boundary, since this
    // Edge Function can also be called directly.
    const { data: hasPremiumAccess, error: entitlementError } = await supabaseService
      .rpc("is_user_premium", { _user_id: user.id });
    if (entitlementError || typeof hasPremiumAccess !== "boolean") {
      console.error("[generate-essay-topic] Entitlement unavailable", entitlementError?.code ?? "invalid response");
      return new Response(JSON.stringify({ error: "NÃ£o foi possÃ­vel verificar o acesso Premium", code: "ENTITLEMENT_UNAVAILABLE" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!hasPremiumAccess) {
      return new Response(JSON.stringify({ error: "Acesso Premium necessÃ¡rio", code: "PREMIUM_REQUIRED" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    let rateLimit;
    try {
      rateLimit = await consumeRateLimit(supabaseService, req, user.id, "generate-essay-topic", RATE_LIMIT_MAX_CALLS, RATE_LIMIT_WINDOW_MINUTES);
    } catch (error) {
      console.error("[generate-essay-topic] Rate limit unavailable:", error instanceof Error ? error.name : "unknown");
      return new Response(JSON.stringify({ error: "Controle de uso temporariamente indisponível", code: "RATE_LIMIT_UNAVAILABLE" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em 1 hora.", code: "RATE_LIMITED", rateLimited: true }), {
        status: 429,
        headers: { ...corsHeaders, ...rateLimitHeaders(rateLimit), "Content-Type": "application/json" },
      });
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      throw new Error("GROQ_API_KEY não está configurada");
    }

    console.log("[generate-essay-topic] Generating ENEM-style essay topic using Groq...");

    let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em criar temas de redação no estilo ENEM. 
Gere um tema de redação atual, pertinente e desafiador que poderia aparecer em uma prova oficial do ENEM.

O tema deve:
- Ser sobre questões sociais, ambientais, tecnológicas ou culturais relevantes para o Brasil
- Seguir o formato oficial do ENEM com título e textos motivadores
- Ser atual e relevante para os dias de hoje
- Permitir argumentação em diferentes perspectivas
- Exigir proposta de intervenção respeitando os direitos humanos

Retorne no seguinte formato JSON:
{
  "titulo": "O tema principal da redação",
  "textos_motivadores": ["Texto 1...", "Texto 2...", "Texto 3..."],
  "instrucao": "A partir da leitura dos textos motivadores e com base nos conhecimentos construídos ao longo de sua formação, redija um texto dissertativo-argumentativo..."
}`
          },
          {
            role: "user",
            content: "Gere um tema de redação ENEM original e atual."
          }
        ],
        max_tokens: 2000,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      console.warn("[generate-essay-topic] Falha no 70b, tentando fallback com llama-3.1-8b-instant...");
      try {
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              {
                role: "system",
                content: "Gere um tema de redação estilo ENEM com titulo, textos_motivadores e instrucao em JSON."
              },
              {
                role: "user",
                content: "Gere um tema de redação ENEM original e atual."
              }
            ],
            max_tokens: 1500,
            temperature: 0.7,
          }),
        });
      } catch (fbErr) {
        console.warn("[generate-essay-topic] Erro no fallback:", fbErr);
      }
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "Sem conexão";
      console.error("[generate-essay-topic] Groq API error:", response?.status, errorText);
      throw new Error("Erro ao gerar tema de redação");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Resposta vazia da IA");
    }

    // Parse the JSON response
    let essayTopic;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        essayTopic = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("JSON não encontrado na resposta");
      }
    } catch (parseError) {
      console.error("[generate-essay-topic] Parse error:", parseError);
      // Fallback to a default topic structure
      essayTopic = {
        titulo: "Os desafios para a inclusão digital no Brasil contemporâneo",
        textos_motivadores: [
          "A transformação digital tem alterado profundamente as relações sociais e econômicas no mundo todo...",
          "No Brasil, milhões de pessoas ainda não têm acesso à internet de qualidade...",
          "A pandemia de COVID-19 evidenciou a importância da conectividade para educação e trabalho..."
        ],
        instrucao: "A partir da leitura dos textos motivadores e com base nos conhecimentos construídos ao longo de sua formação, redija um texto dissertativo-argumentativo em modalidade escrita formal da língua portuguesa sobre o tema, apresentando proposta de intervenção que respeite os direitos humanos."
      };
    }

    console.log("[generate-essay-topic] Essay topic generated successfully");

    return new Response(JSON.stringify(essayTopic), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-essay-topic] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao gerar tema de redação" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
