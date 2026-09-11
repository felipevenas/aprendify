import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

interface ClassificationResult {
  materia: string;
  assunto_principal: string;
  subassuntos: string[];
  confidence: number;
}

async function classifyQuestion(
  groqApiKey: string,
  title: string,
  context: string | null,
  alternatives: any[],
  discipline: string
): Promise<ClassificationResult | null> {
  const alternativesText = alternatives
    .map((alt: any) => `${alt.letter}: ${alt.text}`)
    .join("\n");

  const prompt = `Você é um classificador educacional especializado em questões do ENEM. Sua função é identificar o TÓPICO DE ESTUDO que um vestibulando precisaria dominar para resolver esta questão.

Classifique a seguinte questão:

MATÉRIA ATUAL: ${discipline}

ENUNCIADO:
${title}
${context || ""}

ALTERNATIVAS:
${alternativesText}

Responda APENAS com um JSON válido no seguinte formato (sem explicações):
{
  "materia": "Ciências Humanas | Ciências da Natureza | Matemática | Linguagens",
  "assunto_principal": "tópico de estudo para vestibular",
  "subassuntos": ["subtópico 1", "subtópico 2"],
  "confidence": number entre 0 e 1
}

REGRAS CRÍTICAS para assunto_principal:
- Use APENAS tópicos que aparecem em materiais de estudo para vestibular/ENEM
- NÃO use temas abstratos como "Amizade", "Amor", "Natureza", "Vida"
- NÃO use o assunto do texto, mas sim a COMPETÊNCIA/HABILIDADE testada

EXEMPLOS CORRETOS por área:
- Linguagens: "Interpretação de Texto", "Figuras de Linguagem", "Variação Linguística", "Gêneros Textuais", "Funções da Linguagem", "Intertextualidade", "Modernismo Brasileiro", "Literatura Contemporânea"
- Ciências Humanas: "Guerra Fria", "Revolução Industrial", "Era Vargas", "Globalização", "Urbanização", "Movimentos Sociais", "Iluminismo", "Imperialismo"
- Ciências da Natureza: "Ciclos Biogeoquímicos", "Genética Mendeliana", "Termodinâmica", "Eletromagnetismo", "Reações Orgânicas", "Ecologia", "Citologia", "Ondas"
- Matemática: "Geometria Plana", "Funções", "Probabilidade", "Estatística", "Porcentagem", "Razão e Proporção", "Geometria Espacial", "Análise Combinatória"

Regras adicionais:
- Use português do Brasil
- Seja específico mas usando termos de estudo tradicionais
- Subassuntos devem ser tópicos relacionados do currículo escolar`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Você é um classificador educacional. Responda apenas com JSON válido." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in Groq response");
      return null;
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", content);
      return null;
    }

    const result = JSON.parse(jsonMatch[0]) as ClassificationResult;
    
    // Validate result
    if (!result.materia || !result.assunto_principal || typeof result.confidence !== 'number') {
      console.error("Invalid classification result:", result);
      return null;
    }

    return result;
  } catch (error) {
    console.error("Error classifying question:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      throw new Error("GROQ_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional parameters
    // Limites Groq meta-llama/llama-4-scout-17b-16e-instruct: 30 RPM, 1K TPM, 30K RPD, 500K TPD
    let batchSize = 1;
    let year: string | null = null;
    
    try {
      const body = await req.json();
      if (body.batchSize) batchSize = Math.min(body.batchSize, 3); // Máximo 3 por chamada
      if (body.year) year = body.year;
    } catch {
      // Use defaults if no body
    }

    console.log(`🔄 Starting classification job (batch: ${batchSize}, year: ${year || 'all'})`);

    // Fetch pending questions
    let query = supabase
      .from('enem_questions')
      .select('id, title, context, alternatives, discipline')
      .eq('classification_status', 'pending_classification');
    
    // Filter by year if specified
    if (year) {
      query = query.eq('year', year);
    }
    
    const { data: questions, error: fetchError } = await query.limit(batchSize);

    if (fetchError) {
      throw new Error(`Error fetching questions: ${fetchError.message}`);
    }

    if (!questions || questions.length === 0) {
      console.log("✅ No pending questions to classify");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No pending questions" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${questions.length} questions to classify`);

    let processed = 0;
    let ready = 0;
    let needsReview = 0;
    let failed = 0;

    for (const question of questions) {
      console.log(`🔍 Classifying question: ${question.id}`);

      const alternatives = Array.isArray(question.alternatives) 
        ? question.alternatives 
        : [];

      const result = await classifyQuestion(
        groqApiKey,
        question.title,
        question.context,
        alternatives,
        question.discipline
      );

      if (result) {
        const newStatus = result.confidence >= 0.7 ? 'ready' : 'needs_review';
        
        // Mapeia a matéria para o formato padrão do banco
        const disciplineMap: Record<string, string> = {
          'ciências humanas': 'ciencias-humanas',
          'ciências da natureza': 'ciencias-natureza',
          'matemática': 'matematica',
          'linguagens': 'linguagens',
        };
        const normalizedDiscipline = disciplineMap[result.materia.toLowerCase()] || question.discipline;
        
        const { error: updateError } = await supabase
          .from('enem_questions')
          .update({
            discipline: normalizedDiscipline,
            main_topic: result.assunto_principal,
            subtopics: result.subassuntos,
            confidence: result.confidence,
            classification_status: newStatus,
          })
          .eq('id', question.id);

        if (updateError) {
          console.error(`❌ Error updating question ${question.id}:`, updateError);
          failed++;
        } else {
          processed++;
          if (newStatus === 'ready') ready++;
          else needsReview++;
          console.log(`✅ Question ${question.id} classified as ${newStatus} (confidence: ${result.confidence})`);
        }
      } else {
        failed++;
        console.error(`❌ Failed to classify question ${question.id}`);
      }

      // Rate limiting: 30 RPM = 2s entre requisições
      if (questions.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2100));
      }
    }

    const summary = {
      success: true,
      processed,
      ready,
      needsReview,
      failed,
      total: questions.length,
    };

    console.log(`📊 Classification complete:`, summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Classification error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Retorna código 429 se for erro de rate limit
    const isRateLimit = errorMessage.includes('rate') || errorMessage.includes('429');
    
    return new Response(
      JSON.stringify({ error: errorMessage, isRateLimit }),
      { status: isRateLimit ? 429 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
