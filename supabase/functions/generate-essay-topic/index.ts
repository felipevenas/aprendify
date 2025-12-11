import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge function to generate ENEM-style essay topics using AI
 * Returns a pertinent, current topic similar to official ENEM essays
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não está configurada");
    }

    console.log("Generating ENEM-style essay topic...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
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
      console.error("Parse error:", parseError);
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

    console.log("Essay topic generated successfully");

    return new Response(JSON.stringify(essayTopic), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating essay topic:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao gerar tema de redação" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
