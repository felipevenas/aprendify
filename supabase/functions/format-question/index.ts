import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function para formatar e analisar questões ENEM via IA (Groq)
 * - Classifica dificuldade: easy, medium, hard
 * - Formata textos: limpa artefatos, padroniza formatação ENEM
 * - Salva as alterações no banco de dados
 * 
 * ADMIN ONLY - Requires admin role
 * Rate limited to prevent API quota exhaustion
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration (admin-only, but still limited)
const RATE_LIMIT_MAX_CALLS = 100; // 100 calls per hour for admins
const RATE_LIMIT_WINDOW_MINUTES = 60;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[format-question] No authorization header");
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
      console.error("[format-question] Auth failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[format-question] Authenticated user:", user.id);

    // Verify admin role using service role client
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleData, error: roleError } = await supabaseService
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      console.error("[format-question] Admin check failed:", roleError?.message || "Not admin");
      return new Response(
        JSON.stringify({ error: "Acesso restrito a administradores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limit
    const { data: rateLimitAllowed, error: rateLimitError } = await supabaseService
      .rpc("check_rate_limit", {
        _user_id: user.id,
        _function_name: "format-question",
        _max_calls: RATE_LIMIT_MAX_CALLS,
        _window_minutes: RATE_LIMIT_WINDOW_MINUTES,
      });

    if (rateLimitError) {
      console.error("[format-question] Rate limit check error:", rateLimitError);
      return new Response(
        JSON.stringify({ error: "Controle de uso temporariamente indisponível" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else if (!rateLimitAllowed) {
      console.log("[format-question] Rate limit exceeded for admin:", user.id);
      return new Response(
        JSON.stringify({ 
          error: "Limite de requisições atingido. Tente novamente em 1 hora.",
          rateLimited: true 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { 
      questionId, 
      discipline, 
      context, 
      title, 
      alternatives,
    } = await req.json();

    // Valida dados obrigatórios
    if (!questionId) {
      console.error("[format-question] questionId não fornecido");
      return new Response(
        JSON.stringify({ error: "questionId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      console.error("[format-question] GROQ_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "API key não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[format-question] Processando questão: ${questionId}`);

    // Monta o texto da questão para análise
    const questionText = [
      context && `Contexto: ${context}`,
      title && `Enunciado: ${title}`,
      alternatives && `Alternativas: ${JSON.stringify(alternatives)}`,
    ].filter(Boolean).join("\n\n");

    // Prompt para classificação de dificuldade
    const prompt = `Você é um especialista em questões do ENEM. Analise a questão abaixo e faça duas tarefas:

1. CLASSIFICAÇÃO DE DIFICULDADE:
- EASY (Fácil): Questões diretas, interpretação simples, conceitos básicos, poucos passos de raciocínio
- MEDIUM (Médio): Exigem interpretação moderada, aplicação de conceitos, raciocínio em 2-3 etapas
- HARD (Difícil): Interpretação complexa, múltiplos conceitos integrados, raciocínio abstrato, várias etapas

2. FORMATAÇÃO (se necessário):
- Remova códigos de questão como "ENEM 2024 - Questão 99"
- Remova artefatos markdown como ** ou __
- Mantenha o texto limpo e no padrão ENEM

DISCIPLINA: ${discipline || "Geral"}

QUESTÃO:
${questionText}

Responda em JSON válido no formato:
{
  "difficulty": "easy" | "medium" | "hard",
  "formattedTitle": "título formatado se houver correções, ou null",
  "formattedContext": "contexto formatado se houver correções, ou null"
}

Retorne APENAS o JSON, sem explicações adicionais.`;

    // Chama a API da Groq
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[format-question] Erro Groq API:", errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawResponse = data.choices?.[0]?.message?.content?.trim() || "";
    
    console.log(`[format-question] Resposta da IA: ${rawResponse.substring(0, 200)}...`);

    // Tenta parsear a resposta JSON
    let parsedResponse: {
      difficulty: "easy" | "medium" | "hard";
      formattedTitle: string | null;
      formattedContext: string | null;
    };

    try {
      // Remove possíveis marcadores de código markdown
      const cleanJson = rawResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedResponse = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("[format-question] Erro ao parsear JSON:", parseError);
      
      // Fallback: extrai apenas a dificuldade
      let difficulty: "easy" | "medium" | "hard" = "medium";
      if (rawResponse.includes("easy") || rawResponse.includes("fácil")) {
        difficulty = "easy";
      } else if (rawResponse.includes("hard") || rawResponse.includes("difícil")) {
        difficulty = "hard";
      }
      
      parsedResponse = {
        difficulty,
        formattedTitle: null,
        formattedContext: null,
      };
    }

    // Normaliza a dificuldade
    let difficulty = parsedResponse.difficulty || "medium";
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      difficulty = "medium";
    }

    console.log(`[format-question] Dificuldade: ${difficulty}`);

    // Prepara atualização para o banco
    const updateData: Record<string, string> = {
      difficulty,
    };

    // Adiciona título formatado se houver
    if (parsedResponse.formattedTitle) {
      updateData.title = parsedResponse.formattedTitle;
    }

    // Adiciona contexto formatado se houver
    if (parsedResponse.formattedContext) {
      updateData.context = parsedResponse.formattedContext;
    }

    // Salva no banco de dados using service role
    const { error: updateError } = await supabaseService
      .from("enem_questions")
      .update(updateData)
      .eq("id", questionId);

    if (updateError) {
      console.error("[format-question] Erro ao salvar no banco:", updateError);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao salvar no banco",
          difficulty, // Retorna a dificuldade mesmo com erro de save
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[format-question] Questão ${questionId} atualizada com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true,
        difficulty,
        title: parsedResponse.formattedTitle,
        context: parsedResponse.formattedContext,
        questionId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[format-question] Erro na função:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
