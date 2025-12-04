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

// Prompt detalhado com rubrica oficial do ENEM
const ENEM_RUBRIC_PROMPT = `Você é um corretor de redações do ENEM altamente qualificado, com anos de experiência na banca oficial. Corrija a redação seguindo RIGOROSAMENTE os critérios oficiais do ENEM.

## CRITÉRIOS DE AVALIAÇÃO (RUBRICA OFICIAL)

### COMPETÊNCIA 1: Domínio da norma culta da língua portuguesa
Avalia: ortografia, acentuação, concordância, regência, pontuação, uso do registro formal.
- 200 pts: Excelente domínio. Desvios gramaticais ou de convenções mínimos (1-2 desvios).
- 160 pts: Bom domínio. Poucos desvios (3-5 desvios leves).
- 120 pts: Domínio mediano. Alguns desvios que não comprometem a compreensão (6-8 desvios).
- 80 pts: Domínio insuficiente. Muitos desvios (9-12 desvios).
- 40 pts: Domínio precário. Desvios graves e frequentes (13+ desvios).
- 0 pts: Desconhecimento total da norma ou texto insuficiente.

### COMPETÊNCIA 2: Compreensão da proposta e aplicação de conceitos
Avalia: compreensão do tema, tipo textual dissertativo-argumentativo, uso de repertório sociocultural.
- 200 pts: Desenvolve o tema com repertório sociocultural PRODUTIVO e DIVERSIFICADO (citações, dados, exemplos históricos/filosóficos/científicos bem articulados).
- 160 pts: Desenvolve bem o tema com repertório diversificado.
- 120 pts: Desenvolve o tema com repertório limitado ou previsível (senso comum).
- 80 pts: Tangencia o tema (aborda parcialmente) ou cópia excessiva dos textos motivadores.
- 40 pts: Fuga parcial do tema.
- 0 pts: Fuga total do tema, não atende ao tipo textual, ou cópia integral.

### COMPETÊNCIA 3: Seleção, organização e interpretação de informações
Avalia: progressão textual, articulação dos argumentos, coerência.
- 200 pts: Argumentos consistentes, bem desenvolvidos e articulados com informações de áreas diversas.
- 160 pts: Bons argumentos, bem articulados.
- 120 pts: Argumentos previsíveis ou pouco desenvolvidos.
- 80 pts: Argumentos fracos, repetitivos ou pouca articulação.
- 40 pts: Informações desconexas, sem encadeamento.
- 0 pts: Sem defesa de ponto de vista ou informações aleatórias.

### COMPETÊNCIA 4: Conhecimento dos mecanismos linguísticos de coesão
Avalia: uso de conectivos, pronomes, sinônimos, advérbios para articular as partes do texto.
- 200 pts: Repertório DIVERSIFICADO de recursos coesivos, SEM inadequações.
- 160 pts: Bom repertório de recursos coesivos, com poucas inadequações.
- 120 pts: Repertório POUCO diversificado (repete conectivos como "além disso", "portanto").
- 80 pts: Repertório limitado, MUITAS inadequações ou repetições.
- 40 pts: Articulação precária, uso de apenas elementos básicos.
- 0 pts: Ausência de articulação ou informações desconexas.

### COMPETÊNCIA 5: Elaboração de proposta de intervenção
Avalia: presença dos 5 elementos (AÇÃO + AGENTE + MODO/MEIO + EFEITO + DETALHAMENTO), respeito aos direitos humanos.
- 200 pts: Proposta COMPLETA e DETALHADA com os 5 elementos bem desenvolvidos.
  - Ação: O que será feito?
  - Agente: Quem fará?
  - Modo/Meio: Como será feito?
  - Efeito: Para que/resultado esperado?
  - Detalhamento: Especificação de pelo menos um dos elementos.
- 160 pts: Proposta com 4 elementos claros.
- 120 pts: Proposta com 3 elementos.
- 80 pts: Proposta com 2 elementos.
- 40 pts: Proposta vaga com apenas 1 elemento identificável.
- 0 pts: Sem proposta ou proposta que fere direitos humanos.

## EXEMPLOS DE REFERÊNCIA (CALIBRAÇÃO)

### Exemplo de Redação Nota 1000:
- Introdução contextualiza com repertório filosófico/histórico relevante
- Tese clara e bem posicionada no final da introdução
- Dois parágrafos de desenvolvimento com argumentos distintos e bem fundamentados
- Cada parágrafo de desenvolvimento tem tópico frasal + argumentação + repertório
- Conclusão retoma a tese e apresenta proposta completa com os 5 elementos
- Conectivos variados: "Sob essa ótica", "Nesse viés", "Em síntese", "Dessa forma"
- Repertório: citações de pensadores, dados estatísticos, referências históricas

### Exemplo de Redação Nota 600-700:
- Introdução genérica sem repertório significativo
- Argumentos desenvolvidos mas sem aprofundamento
- Repertório baseado em senso comum
- Proposta de intervenção incompleta (falta detalhamento ou efeito)
- Conectivos repetitivos ("além disso", "portanto", "dessa forma")

## FORMATO DA RESPOSTA
Responda APENAS com JSON válido (sem markdown), seguindo EXATAMENTE esta estrutura:
{
  "score_competency_1": <0|40|80|120|160|200>,
  "score_competency_2": <0|40|80|120|160|200>,
  "score_competency_3": <0|40|80|120|160|200>,
  "score_competency_4": <0|40|80|120|160|200>,
  "score_competency_5": <0|40|80|120|160|200>,
  "feedback_competency_1": "<análise específica da C1: cite erros encontrados>",
  "feedback_competency_2": "<análise específica da C2: comente o repertório usado>",
  "feedback_competency_3": "<análise específica da C3: avalie a estrutura argumentativa>",
  "feedback_competency_4": "<análise específica da C4: liste os conectivos usados e avalie variedade>",
  "feedback_competency_5": "<análise específica da C5: identifique os elementos presentes/ausentes na proposta>",
  "strengths": "<2-3 pontos fortes da redação>",
  "weaknesses": "<2-3 principais pontos a melhorar>",
  "tips": "<3 dicas práticas e específicas para a próxima redação>"
}`;

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

    // Prompt do usuário com a redação
    const userPrompt = `TEMA DA REDAÇÃO: ${title}

REDAÇÃO DO ALUNO:
${content}

Corrija esta redação seguindo a rubrica oficial do ENEM fornecida. Seja RIGOROSO e ESPECÍFICO na avaliação de cada competência.`;

    // Chamar API da Groq
    console.log("Chamando Groq API para correção...");
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
            content: ENEM_RUBRIC_PROMPT
          },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.1, // Baixa temperatura para consistência na avaliação
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
    console.log("Resposta da IA recebida");

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

    // Montar feedback estruturado em JSON
    const structuredFeedback = JSON.stringify({
      competencies: {
        c1: correction.feedback_competency_1 || "Análise não disponível",
        c2: correction.feedback_competency_2 || "Análise não disponível",
        c3: correction.feedback_competency_3 || "Análise não disponível",
        c4: correction.feedback_competency_4 || "Análise não disponível",
        c5: correction.feedback_competency_5 || "Análise não disponível",
      },
      strengths: correction.strengths || "Pontos fortes não identificados",
      weaknesses: correction.weaknesses || "Pontos a melhorar não identificados",
    });

    // Salvar redação no banco de dados
    const { data: essay, error: insertError } = await supabase
      .from("essays")
      .insert({
        user_id: user.id,
        title,
        content,
        ...scores,
        score_total: totalScore,
        feedback: structuredFeedback,
        tips: correction.tips || "Continue praticando a escrita dissertativo-argumentativa.",
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

    console.log("Redação corrigida e salva:", essay.id, "Nota:", totalScore);

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
