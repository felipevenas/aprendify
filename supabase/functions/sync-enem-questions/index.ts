import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge function to sync ENEM questions from external API
 * ADMIN ONLY - Requires admin role authentication
 * Rate limited to prevent abuse
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTERNAL_API_BASE = "https://api.enem.dev/v1";

// Rate limit configuration (admin-only, but still limited)
const RATE_LIMIT_MAX_CALLS = 5; // 5 sync operations per hour
const RATE_LIMIT_WINDOW_MINUTES = 60;

// Mapeia número da questão para disciplina (baseado na estrutura do ENEM)
function getDisciplineFromNumber(questionNumber: number): string {
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
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes("inglês") || lowerContent.includes("english")) {
      return "ingles";
    }
    if (lowerContent.includes("espanhol") || lowerContent.includes("español")) {
      return "espanhol";
    }
    return "ingles";
  }
  return null;
}

// Transforma questão do formato da API externa para o formato do banco
function transformQuestion(raw: any, year: string): any {
  const questionNumber = raw.index || raw.number || 1;
  const context = raw.context || "";
  const discipline = raw.discipline || getDisciplineFromNumber(questionNumber);
  const language = getLanguageFromQuestion(questionNumber, context);
  
  // Alternativas podem vir em diferentes formatos
  let alternativesArray = raw.alternatives;
  if (!Array.isArray(alternativesArray)) {
    alternativesArray = Object.values(alternativesArray || {});
  }
  
  // Normaliza alternativas
  const normalizedAlternatives = alternativesArray.map((alt: any, idx: number) => ({
    letter: alt.letter || String.fromCharCode(65 + idx),
    text: alt.text || alt.content || "",
    files: alt.files || alt.file ? [alt.file] : undefined
  }));
  
  return {
    year: year.toString(),
    index: questionNumber,
    title: raw.title || `Questão ${questionNumber}`,
    discipline: discipline,
    language: language,
    context: context,
    files: raw.files || null,
    alternatives_introduction: raw.alternativesIntroduction || null,
    alternatives: normalizedAlternatives,
    correct_alternative: raw.correctAlternative || "A",
    origin: 'enem_api',
    classification_status: 'pending_classification',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[sync-enem-questions] No authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with user token to verify authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error("[sync-enem-questions] Auth failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[sync-enem-questions] Authenticated user:", user.id);

    // Use service role for admin check and database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      console.error("[sync-enem-questions] Admin check failed:", roleError?.message || "Not admin");
      return new Response(
        JSON.stringify({ error: "Acesso restrito a administradores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[sync-enem-questions] Admin verified:", user.id);

    // Check rate limit
    const { data: rateLimitAllowed, error: rateLimitError } = await supabase
      .rpc("check_rate_limit", {
        _user_id: user.id,
        _function_name: "sync-enem-questions",
        _max_calls: RATE_LIMIT_MAX_CALLS,
        _window_minutes: RATE_LIMIT_WINDOW_MINUTES,
      });

    if (rateLimitError) {
      console.error("[sync-enem-questions] Rate limit check error:", rateLimitError);
      return new Response(
        JSON.stringify({ error: "Controle de uso temporariamente indisponível" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else if (!rateLimitAllowed) {
      console.log("[sync-enem-questions] Rate limit exceeded for admin:", user.id);
      return new Response(
        JSON.stringify({ 
          error: "Limite de sincronizações atingido. Tente novamente em 1 hora.",
          rateLimited: true 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    let years: string[] = [];
    
    try {
      const body = await req.json();
      if (body.years && Array.isArray(body.years)) {
        years = body.years;
      } else if (body.year) {
        years = [body.year];
      }
    } catch {
      years = ["2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009"];
    }

    if (years.length === 0) {
      years = ["2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009"];
    }

    // Sort years in descending order (newest first)
    years.sort((a, b) => parseInt(b) - parseInt(a));

    console.log(`🔄 Syncing ENEM questions for years: ${years.join(", ")}`);

    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const results: any[] = [];

    for (const year of years) {
      console.log(`📥 Fetching year ${year}...`);
      
      try {
        // Check which questions we already have for this year
        const { data: existingQuestions } = await supabase
          .from('enem_questions')
          .select('index, language')
          .eq('year', year);
        
        // Create a Set of existing (index, language) pairs to handle duplicates
        const existingKeys = new Set(
          (existingQuestions || []).map(q => `${q.index}:${q.language || 'null'}`)
        );
        console.log(`  Already have ${existingKeys.size} questions for ${year}`);

        // Fetch questions from external API - paginate to get all
        let allQuestions: any[] = [];
        let offset = 0;
        const pageSize = 50;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (true) {
          const url = `${EXTERNAL_API_BASE}/exams/${year}/questions?limit=${pageSize}&offset=${offset}`;
          console.log(`  Fetching: ${url}`);
          
          const response = await fetch(url);
          
          if (!response.ok) {
            if (response.status === 429) {
              // Rate limited - wait and retry
              retryCount++;
              if (retryCount > maxRetries) {
                console.error(`  ❌ Max retries reached for ${year}`);
                results.push({ year, success: false, error: `Rate limited after ${maxRetries} retries` });
                totalErrors++;
                break;
              }
              const waitTime = Math.min(5000 * retryCount, 15000);
              console.log(`  ⏳ Rate limited, waiting ${waitTime/1000}s (retry ${retryCount}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            console.error(`  ❌ Failed to fetch ${year}: ${response.status}`);
            results.push({ year, success: false, error: `API returned ${response.status}` });
            totalErrors++;
            break;
          }

          retryCount = 0; // Reset retry count on success
          const data = await response.json();
          const questions = data?.questions || [];
          
          if (questions.length === 0) {
            break;
          }
          
          allQuestions = allQuestions.concat(questions);
          console.log(`  Fetched ${questions.length} questions, total: ${allQuestions.length}`);
          
          // Check if we have more pages
          const total = data?.metadata?.total || 0;
          if (allQuestions.length >= total || questions.length < pageSize) {
            break;
          }
          
          offset += pageSize;
          
          // Rate limiting between pages
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        if (allQuestions.length === 0) {
          continue; // Error was already logged
        }
        
        console.log(`  Found ${allQuestions.length} questions from API`);

        // Transform all questions first
        const transformedQuestions = allQuestions.map((q: any) => transformQuestion(q, year));

        // Filter out questions we already have (by index + language pair)
        const newQuestions = transformedQuestions.filter((q: any) => {
          const key = `${q.index}:${q.language || 'null'}`;
          return !existingKeys.has(key);
        });

        // Also deduplicate within the batch (API might return duplicates)
        const seenKeys = new Set<string>();
        const uniqueNewQuestions = newQuestions.filter((q: any) => {
          const key = `${q.index}:${q.language || 'null'}`;
          if (seenKeys.has(key)) {
            return false;
          }
          seenKeys.add(key);
          return true;
        });

        if (uniqueNewQuestions.length === 0) {
          console.log(`  ✅ All questions for ${year} already exist`);
          results.push({ year, success: true, inserted: 0, skipped: allQuestions.length });
          totalSkipped += allQuestions.length;
          continue;
        }

        console.log(`  📝 Inserting ${uniqueNewQuestions.length} new questions (filtered from ${allQuestions.length})...`);

        // Insert in smaller batches to avoid issues
        const batchSize = 20;
        let yearInserted = 0;
        let yearErrors = 0;

        for (let i = 0; i < uniqueNewQuestions.length; i += batchSize) {
          const batch = uniqueNewQuestions.slice(i, i + batchSize);
          
          const { data: inserted, error: insertError } = await supabase
            .from('enem_questions')
            .upsert(batch, { 
              onConflict: 'year,index',
              ignoreDuplicates: true 
            })
            .select('id');

          if (insertError) {
            console.error(`  ❌ Batch insert error:`, insertError.message);
            yearErrors++;
          } else {
            yearInserted += inserted?.length || 0;
          }
          
          // Small delay between batches
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`  ✅ Inserted ${yearInserted} questions for ${year}${yearErrors > 0 ? ` (${yearErrors} batch errors)` : ''}`);
        results.push({ 
          year, 
          success: yearErrors === 0, 
          inserted: yearInserted, 
          skipped: allQuestions.length - uniqueNewQuestions.length,
          errors: yearErrors 
        });
        totalInserted += yearInserted;
        totalSkipped += allQuestions.length - uniqueNewQuestions.length;
        if (yearErrors > 0) totalErrors++;
        
      } catch (error) {
        console.error(`  ❌ Error processing ${year}:`, error);
        results.push({ year, success: false, error: String(error) });
        totalErrors++;
      }

      // Rate limiting between years - longer delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const summary = {
      success: true,
      totalInserted,
      totalSkipped,
      totalErrors,
      results,
    };

    console.log(`📊 Sync complete:`, summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
