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

// Prompt detalhado com rubrica oficial do ENEM e exemplo nota 1000
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

## EXEMPLO DE REDAÇÃO NOTA 1000 (USE COMO REFERÊNCIA DE CALIBRAÇÃO)

TEMA: Desafios para a valorização da herança africana no Brasil

"O álbum musical "Duas Cidades", da banda brasileira Baiana System, aborda, em algumas de suas canções, o apagamento da influência histórica africana no Brasil. Inegavelmente, em dias atuais, é possível constatar uma relação direta entre a composição artística citada e a desvalorização da herança africana no país. Isso é explicado devido à falta de política pública de ensino e à ausência de lei específica. Logo, é essencial analisar e intervir sobre essa problemática.

A princípio, deve-se observar que o pouco fomento governamental em ações de gestão educacional é um problema a ser combatido. Sob a perspectiva de Macaé Evaristo, ministra dos Direitos Humanos, é urgente a necessidade de iniciativas para a inclusão da história e da cultura afro-brasileira nas escolas. Para entender melhor tal posicionamento, é importante compreender que o atual ensino sobre os povos africanos é apenas relatado em aulas específicas de algumas disciplinas, como história e literatura, sem se aprofundar na grande influência cultural que a África possui no Brasil. Dessa forma, de acordo com Chico César, cantor e compositor de músicas afro-brasileiras, as crianças e os adolescentes necessitam ter uma formação ampla sobre a temática, com aulas multidisciplinares, por exemplo, de música e de capoeira, bem como as tradicionais aulas já existentes, porém integradas à herança africana presente na sociedade. Nesse sentido, é substancial modificar esse contexto e desenvolver uma forte política pública de ensino.

Ademais, é imperativo pontuar que atitude insuficiente do Poder Legislativo Federal em atuar no tema é um problema a ser combatido. Sob a ótica de Duda Salabert, deputada federal e professora de literatura, é imprescindível a alteração da lei que orienta a educação básica brasileira. Isso pode ser explicado pelo entendimento de que apenas com empenho legislativo é possível transformar o mecanismo legal que define as matrizes de referência do ensino nacional. Dessa maneira, com a união de parlamentares para o reconhecimento da importância da herança africana na formação educacional, poderá ocorrer a consolidação de políticas públicas, como o investimento da capacitação de professores e de profissionais especializados em cultura afro-brasileira. Assim, o crescimento do fomento estatal no setor, garantido por aparato legal, contribuirá para a efetivação de uma forte identidade nacional. Em suma, se o Congresso Nacional se omite de enfrentar tal cenário danoso, entende-se o porquê de sua perpetuação.

Portando, com o intuito de solucionar esses desafios, o Poder Executivo Federal, por meio do aumento de ações governamentais, deve estimular iniciativas educacionais relacionadas à herança africana, a fim de valorizar a temática. Além disso, o Poder Legislativo Federal, por intermédio da criação de um projeto de lei, necessita elaborar uma nova política nacional de ensino, com a obrigatoriedade de investimento público na área, com a definição de medidas de gestão pública capazes de instituir aulas multidisciplinares, como de música e de cultura afro-brasileira nas escolas, com o objetivo de reconhecer a importância do tema na formação da sociedade. Feito isso, o apagamento da influência africana abordado na obra da banda Baiana System será, enfim, combatido."

### POR QUE ESTA REDAÇÃO É NOTA 1000:
- C1 (200): Excelente domínio da norma culta, sem desvios significativos
- C2 (200): Repertório diversificado (Baiana System, Macaé Evaristo, Chico César, Duda Salabert)
- C3 (200): Argumentos bem desenvolvidos com progressão lógica e coerente
- C4 (200): Conectivos variados ("A princípio", "Sob a perspectiva", "Dessa forma", "Ademais", "Em suma")
- C5 (200): Proposta completa com todos os 5 elementos (Agente: Poder Executivo e Legislativo; Ação: estimular iniciativas e criar projeto de lei; Modo: aulas multidisciplinares; Efeito: valorizar o tema; Detalhamento: música e cultura afro-brasileira)

## EXEMPLO DE REDAÇÃO NOTA 600-700:
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
