import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeia número da questão para disciplina (baseado na estrutura do ENEM)
function getDisciplineFromNumber(questionNumber: number): string {
  // Dia 1: Linguagens (1-45) + Ciências Humanas (46-90)
  // Dia 2: Ciências da Natureza (91-135) + Matemática (136-180)
  if (questionNumber >= 1 && questionNumber <= 45) {
    return "linguagens";
  } else if (questionNumber >= 46 && questionNumber <= 90) {
    return "humanas";
  } else if (questionNumber >= 91 && questionNumber <= 135) {
    return "natureza";
  } else if (questionNumber >= 136 && questionNumber <= 180) {
    return "matematica";
  }
  return "outros";
}

// Detecta idioma para questões de língua estrangeira (1-5)
function getLanguageFromQuestion(questionNumber: number, content: string): string | null {
  if (questionNumber >= 1 && questionNumber <= 5) {
    // Tenta detectar pelo conteúdo
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes("inglês") || lowerContent.includes("english")) {
      return "ingles";
    }
    if (lowerContent.includes("espanhol") || lowerContent.includes("español")) {
      return "espanhol";
    }
    // Default para inglês se não conseguir detectar
    return "ingles";
  }
  return null;
}

// Extrai texto de um array de content
function extractText(contentArray: any[]): string {
  if (!contentArray || !Array.isArray(contentArray)) return "";
  
  return contentArray
    .filter((item: any) => item.type === "text")
    .map((item: any) => item.content)
    .join(" ")
    .trim();
}

// Extrai URLs de imagens de um array de content
function extractImages(contentArray: any[], questionNumber: number, baseUrl: string): string[] {
  if (!contentArray || !Array.isArray(contentArray)) return [];
  
  const images: string[] = [];
  contentArray.forEach((item: any) => {
    if (item.type === "image") {
      // Converte path local para URL do bucket
      // Formato esperado: question-{number}.png
      const imageName = `question-${questionNumber}.png`;
      images.push(`${baseUrl}/storage/v1/object/public/enem-images/${imageName}`);
    }
  });
  
  return images;
}

// Transforma questão do formato do scraper para o formato do banco
function transformQuestion(raw: any, year: string, supabaseUrl: string): any {
  const questionNumber = raw.number;
  const context = extractText(raw.content);
  const files = extractImages(raw.content, questionNumber, supabaseUrl);
  const discipline = getDisciplineFromNumber(questionNumber);
  const language = getLanguageFromQuestion(questionNumber, context);
  
  // Transforma alternatives de objeto para array
  const alternativesArray: any[] = [];
  let correctAlternative = "A";
  
  const altKeys = Object.keys(raw.alternatives || {}).sort((a, b) => parseInt(a) - parseInt(b));
  
  for (const key of altKeys) {
    const alt = raw.alternatives[key];
    const letter = alt.alternative || String.fromCharCode(65 + parseInt(key));
    const text = extractText(alt.content);
    const altFiles = extractImages(alt.content, questionNumber, supabaseUrl);
    
    alternativesArray.push({
      letter,
      text,
      files: altFiles.length > 0 ? altFiles : undefined
    });
    
    if (alt.correct === true) {
      correctAlternative = letter;
    }
  }
  
  return {
    year,
    index: questionNumber,
    title: `Questão ${questionNumber}`,
    discipline,
    language,
    context,
    files: files.length > 0 ? files : null,
    alternatives_introduction: null,
    alternatives: alternativesArray,
    correct_alternative: correctAlternative
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verifica autenticação admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Cliente com service role para inserir dados
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Cliente com token do usuário para verificar admin
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verifica se usuário é admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    const body = await req.json();
    const { year, questions } = body;

    if (!year || !questions || !Array.isArray(questions)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload. Expected { year: string, questions: array }' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Importando ${questions.length} questões do ENEM ${year}`);

    // Transforma e insere questões
    const transformedQuestions = questions.map((q: any) => transformQuestion(q, year, supabaseUrl));
    
    let inserted = 0;
    let errors: any[] = [];

    // Insere em batches de 50
    const batchSize = 50;
    for (let i = 0; i < transformedQuestions.length; i += batchSize) {
      const batch = transformedQuestions.slice(i, i + batchSize);
      
      const { data, error } = await supabaseAdmin
        .from('enem_questions')
        .upsert(batch, { 
          onConflict: 'year,index',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error(`❌ Erro no batch ${i}-${i + batchSize}:`, error);
        errors.push({ batch: i, error: error.message });
      } else {
        inserted += data?.length || 0;
        console.log(`✅ Batch ${i}-${i + batchSize}: ${data?.length} questões inseridas`);
      }
    }

    const result = {
      success: true,
      year,
      total: questions.length,
      inserted,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`📊 Resultado final:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na importação:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
