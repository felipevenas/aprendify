import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge function para corrigir redações no padrão ENEM usando Groq API
 * Free: 1 redação/mês | Premium: 4 redações/mês (1/semana)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EssayCorrectionRequest {
  title: string;
  content: string;
}

// Limites de redações por tipo de usuário
const FREE_MONTHLY_LIMIT = 1;
const PREMIUM_MONTHLY_LIMIT = 4;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Obter usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar status premium
    const { data: isPremium } = await supabase
      .rpc("is_user_premium", { _user_id: user.id });

    // Contar redações do mês
    const { data: monthlyCount } = await supabase
      .rpc("get_monthly_essay_count", { _user_id: user.id });

    const currentCount = monthlyCount || 0;
    const limit = isPremium ? PREMIUM_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT;

    // Verificar limite
    if (currentCount >= limit) {
      const message = isPremium
        ? "Você atingiu o limite de 4 redações por mês. Aguarde o próximo mês para enviar mais."
        : "Você atingiu o limite de 1 redação por mês no plano gratuito. Assine o Premium para corrigir até 4 redações por mês.";
      
      return new Response(
        JSON.stringify({ error: message, limitReached: true }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse do body
    const { title, content }: EssayCorrectionRequest = await req.json();

    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: "Título e conteúdo são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar tamanho mínimo da redação (aproximadamente 7 linhas)
    if (content.length < 200) {
      return new Response(
        JSON.stringify({ error: "A redação deve ter pelo menos 200 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter chave da Groq
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      console.error("GROQ_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Serviço de IA não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prompt para correção no padrão ENEM
    const prompt = `Você é um corretor de redações do ENEM altamente qualificado. Corrija a seguinte redação de acordo com as 5 competências do ENEM e forneça uma avaliação detalhada.

TEMA: ${title}

REDAÇÃO:
${content}

Avalie cada competência de 0 a 200 pontos (em múltiplos de 40: 0, 40, 80, 120, 160, 200):

1. Competência 1: Domínio da norma culta da língua portuguesa
2. Competência 2: Compreensão da proposta e aplicação de conceitos das várias áreas do conhecimento
3. Competência 3: Seleção, relação, organização e interpretação de informações
4. Competência 4: Demonstração de conhecimento dos mecanismos linguísticos necessários para a construção da argumentação
5. Competência 5: Elaboração de proposta de intervenção para o problema abordado

Forneça sua resposta EXATAMENTE no seguinte formato JSON (sem markdown, apenas JSON puro):
{
  "score_competency_1": <número>,
  "score_competency_2": <número>,
  "score_competency_3": <número>,
  "score_competency_4": <número>,
  "score_competency_5": <número>,
  "score_total": <soma das competências>,
  "feedback": "<análise geral da redação em 3-4 frases>",
  "tips": "<3 dicas específicas para melhorar, separadas por ponto e vírgula>"
}`;

    // Chamar API da Groq
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "Você é um corretor especialista do ENEM. Sempre responda apenas com JSON válido, sem markdown ou texto adicional."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Erro na API Groq:", groqResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao corrigir redação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqResponse.json();
    const responseContent = groqData.choices?.[0]?.message?.content || "";

    // Parse do JSON da resposta
    let correction;
    try {
      // Tentar extrair JSON do response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        correction = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("JSON não encontrado na resposta");
      }
    } catch (parseError) {
      console.error("Erro ao parsear resposta da IA:", parseError, responseContent);
      return new Response(
        JSON.stringify({ error: "Erro ao processar correção" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar e normalizar notas
    const normalizeScore = (score: number) => {
      const validScores = [0, 40, 80, 120, 160, 200];
      return validScores.reduce((prev, curr) => 
        Math.abs(curr - score) < Math.abs(prev - score) ? curr : prev
      );
    };

    const scores = {
      score_competency_1: normalizeScore(correction.score_competency_1 || 0),
      score_competency_2: normalizeScore(correction.score_competency_2 || 0),
      score_competency_3: normalizeScore(correction.score_competency_3 || 0),
      score_competency_4: normalizeScore(correction.score_competency_4 || 0),
      score_competency_5: normalizeScore(correction.score_competency_5 || 0),
    };

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

    // Salvar redação no banco de dados
    const { data: essay, error: insertError } = await supabase
      .from("essays")
      .insert({
        user_id: user.id,
        title,
        content,
        ...scores,
        score_total: totalScore,
        feedback: correction.feedback || "Correção concluída.",
        tips: correction.tips || "Continue praticando!",
        status: "corrected"
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao salvar redação:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar redação" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Redação corrigida e salva:", essay.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        essay,
        remainingEssays: limit - currentCount - 1
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro na função correct-essay:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
