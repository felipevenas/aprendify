import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SimuladoType } from "@/hooks/useSimulados";
import {
  CachedQuestion,
  getCachedQuestions,
  getCachedQuestionsMultiYear,
  cacheQuestions,
  updateCacheMetadata,
  isYearCached,
  ENEM_YEARS,
} from "@/lib/questionCache";

/**
 * Types for question data structure
 */
interface QuestionData {
  id: string;
  title: string;
  context: string | null;
  alternatives: Array<{ letter: string; text: string }>;
  alternatives_introduction: string | null;
  discipline: string;
  year: string;
  index: number;
  files: string[] | null;
  correct_alternative: string;
}

/**
 * Configuration for API rate limiting and retry
 * API limit: 1 request per second, window resets every 10 seconds
 */
const API_CONFIG = {
  rateLimitMs: 1100, // 1.1 seconds between requests (safety margin)
  maxRetries: 5, // Increased retries for reliability
  initialRetryDelayMs: 2000, // Wait 2s before first retry
  maxRetryDelayMs: 10000, // Max 10s delay between retries
  requestTimeoutMs: 45000, // 45s timeout per request
  pageSize: 50, // API max limit per page
};

/**
 * Preparation state tracking
 */
interface PreparationState {
  status: "idle" | "preparing" | "ready" | "error";
  progress: number;
  message: string;
  questions: QuestionData[];
  error: string | null;
  loadedCount: number;
  targetCount: number;
}

/**
 * Hook to prepare simulado with all questions loaded
 * Implements queue system with rate limiting for API compliance
 * Uses cache to avoid repeated API requests
 */
export const useSimuladoPreparation = () => {
  const [state, setState] = useState<PreparationState>({
    status: "idle",
    progress: 0,
    message: "",
    questions: [],
    error: null,
    loadedCount: 0,
    targetCount: 0,
  });

  // Track last API request time for rate limiting
  const lastRequestTimeRef = useRef<number>(0);
  // Abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Reset preparation state
   */
  const reset = useCallback(() => {
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setState({
      status: "idle",
      progress: 0,
      message: "",
      questions: [],
      error: null,
      loadedCount: 0,
      targetCount: 0,
    });
  }, []);

  /**
   * Wait for rate limit compliance
   * Ensures minimum delay between API requests
   */
  const waitForRateLimit = async (): Promise<void> => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    
    if (timeSinceLastRequest < API_CONFIG.rateLimitMs) {
      const waitTime = API_CONFIG.rateLimitMs - timeSinceLastRequest;
      console.log(`[RateLimit] Waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastRequestTimeRef.current = Date.now();
  };

  /**
   * Fetch with timeout and abort support
   */
  const fetchWithTimeout = async (
    url: string,
    signal: AbortSignal
  ): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.requestTimeoutMs);

    const combinedSignal = signal;
    
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: combinedSignal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  /**
   * Fetch a single page from API with retry and rate limit handling
   */
  const fetchAPIPageWithRetry = async (
    url: string,
    signal: AbortSignal
  ): Promise<{ questions: any[]; hasMore: boolean }> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < API_CONFIG.maxRetries; attempt++) {
      if (signal.aborted) {
        throw new Error("Request cancelled");
      }

      try {
        // Wait for rate limit before making request
        await waitForRateLimit();

        console.log(`[API] Fetching: ${url} (attempt ${attempt + 1})`);
        const response = await fetchWithTimeout(url, signal);

        // Handle rate limit response (429)
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const waitMs = retryAfter ? parseInt(retryAfter) : 10000;
          console.warn(`[API] Rate limited, waiting ${waitMs}ms`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue; // Retry this request
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.questions || !Array.isArray(data.questions)) {
          return { questions: [], hasMore: false };
        }

        return {
          questions: data.questions,
          hasMore: data.questions.length >= API_CONFIG.pageSize,
        };
      } catch (error) {
        lastError = error as Error;
        
        if ((error as Error).name === "AbortError" || signal.aborted) {
          throw new Error("Request cancelled");
        }

        console.warn(`[API] Attempt ${attempt + 1} failed:`, error);

        if (attempt < API_CONFIG.maxRetries - 1) {
          const delay = Math.min(
            API_CONFIG.initialRetryDelayMs * Math.pow(2, attempt),
            API_CONFIG.maxRetryDelayMs
          );
          console.log(`[API] Waiting ${delay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Failed after all retries");
  };

  /**
   * Map discipline names between API and local formats
   */
  const mapLocalDisciplineToAPI = (local: string): string => {
    const mapping: Record<string, string> = {
      humanas: "ciencias-humanas",
      natureza: "ciencias-natureza",
      matematica: "matematica",
      linguagens: "linguagens",
    };
    return mapping[local] || local;
  };

  const mapAPIDisciplineToLocal = (api: string): string => {
    const mapping: Record<string, string> = {
      "ciencias-humanas": "humanas",
      "ciencias-natureza": "natureza",
      matematica: "matematica",
      linguagens: "linguagens",
    };
    return mapping[api] || api;
  };

  /**
   * Get disciplines based on simulado type
   */
  const getDisciplinesForType = (type: SimuladoType): string[] => {
    switch (type) {
      case "official_day1":
        return ["humanas"];
      case "official_day2":
        return ["matematica", "natureza"];
      case "custom_naturezas":
        return ["natureza"];
      case "custom_humanas":
        return ["humanas"];
      case "custom_matematica":
        return ["matematica"];
      case "custom_mixed":
      default:
        return ["humanas", "matematica", "natureza"];
    }
  };

  /**
   * Fetch ALL questions from API for a specific year
   * Uses queue system with rate limiting
   */
  const fetchAllQuestionsFromAPIByYear = async (
    year: string,
    disciplines: string[],
    signal: AbortSignal,
    onProgress: (loaded: number, message: string) => void
  ): Promise<QuestionData[]> => {
    const apiDisciplines = disciplines.map(d => mapLocalDisciplineToAPI(d));
    console.log(`[API] Fetching year=${year}, disciplines=${apiDisciplines.join(",")}`);

    const allQuestions: any[] = [];
    let offset = 0;
    let hasMore = true;
    let pageCount = 0;

    // Fetch all pages sequentially with rate limiting
    while (hasMore && !signal.aborted) {
      const url = `https://api.enem.dev/v1/exams/${year}/questions?limit=${API_CONFIG.pageSize}&offset=${offset}`;
      
      onProgress(
        allQuestions.length,
        `Carregando ${year}: página ${pageCount + 1}... (${allQuestions.length} questões)`
      );

      try {
        const result = await fetchAPIPageWithRetry(url, signal);
        
        if (result.questions.length > 0) {
          allQuestions.push(...result.questions);
          pageCount++;
          console.log(`[API] Year ${year} page ${pageCount}: ${result.questions.length} questions, total: ${allQuestions.length}`);
        }

        hasMore = result.hasMore;
        offset += API_CONFIG.pageSize;

        // Safety limit to prevent infinite loops
        if (offset > 500) {
          console.warn("[API] Reached safety limit of 500 offset");
          hasMore = false;
        }
      } catch (error) {
        if ((error as Error).message === "Request cancelled") {
          throw error;
        }
        console.error(`[API] Failed to fetch page at offset ${offset}:`, error);
        // Continue with what we have
        hasMore = false;
      }
    }

    if (signal.aborted) {
      throw new Error("Request cancelled");
    }

    console.log(`[API] Year ${year}: Total fetched ${allQuestions.length} questions from ${pageCount} pages`);

    // Filter by requested disciplines
    const filteredQuestions = allQuestions.filter(q =>
      apiDisciplines.includes(q.discipline)
    );

    console.log(`[API] Year ${year}: After discipline filter: ${filteredQuestions.length} questions`);

    // Map to our format
    const mappedQuestions: QuestionData[] = filteredQuestions.map((q, idx) => ({
      id: `api-${year}-${q.discipline}-${q.index || idx}`,
      title: q.title || "",
      context: q.context || null,
      alternatives: Array.isArray(q.alternatives)
        ? q.alternatives.map((alt: any) => ({
            letter: alt.letter || "",
            text: alt.text || "",
          }))
        : [],
      alternatives_introduction: q.alternativesIntroduction || null,
      discipline: mapAPIDisciplineToLocal(q.discipline),
      year: String(q.year || year),
      index: q.index || idx,
      files: Array.isArray(q.files) && q.files.length > 0 ? q.files : null,
      correct_alternative: q.correctAlternative || "",
    }));

    // Cache the questions for future use
    if (mappedQuestions.length > 0) {
      await cacheQuestions(mappedQuestions as unknown as CachedQuestion[]);
      await updateCacheMetadata(year, mappedQuestions.length, true);
    }

    return mappedQuestions;
  };

  /**
   * Fetch questions from multiple years until we have enough
   * Uses cache first, then API for missing years
   */
  const fetchQuestionsFromMultipleYears = async (
    years: string[],
    disciplines: string[],
    targetCount: number,
    signal: AbortSignal,
    onProgress: (loaded: number, message: string) => void
  ): Promise<QuestionData[]> => {
    const allQuestions: QuestionData[] = [];
    const usedIds = new Set<string>();

    // First, try to get questions from cache
    onProgress(0, "Verificando cache local...");
    const cachedQuestions = await getCachedQuestionsMultiYear(years, disciplines);
    
    if (cachedQuestions.length > 0) {
      console.log(`[Cache] Found ${cachedQuestions.length} cached questions`);
      for (const q of cachedQuestions) {
        if (!usedIds.has(q.id)) {
          allQuestions.push(q as unknown as QuestionData);
          usedIds.add(q.id);
        }
      }
      onProgress(allQuestions.length, `Cache: ${allQuestions.length} questões encontradas`);
    }

    // If we have enough from cache, return
    if (allQuestions.length >= targetCount) {
      console.log(`[Cache] Sufficient questions from cache: ${allQuestions.length}/${targetCount}`);
      return allQuestions.sort(() => Math.random() - 0.5).slice(0, targetCount);
    }

    // Fetch from API for each year until we have enough
    for (const year of years) {
      if (signal.aborted) {
        throw new Error("Request cancelled");
      }

      if (allQuestions.length >= targetCount) {
        break;
      }

      // Check if this year is cached
      const cacheStatus = await isYearCached(year);
      if (cacheStatus.cached) {
        console.log(`[Cache] Year ${year} already cached with ${cacheStatus.count} questions`);
        continue;
      }

      const remaining = targetCount - allQuestions.length;
      onProgress(
        allQuestions.length,
        `Buscando questões de ${year}... (${allQuestions.length}/${targetCount})`
      );

      try {
        const yearQuestions = await fetchAllQuestionsFromAPIByYear(
          year,
          disciplines,
          signal,
          (loaded, msg) => onProgress(allQuestions.length + loaded, msg)
        );

        // Add unique questions
        for (const q of yearQuestions) {
          if (!usedIds.has(q.id) && allQuestions.length < targetCount) {
            allQuestions.push(q);
            usedIds.add(q.id);
          }
        }

        console.log(`[API] After year ${year}: total ${allQuestions.length}/${targetCount}`);
      } catch (error) {
        console.error(`[API] Failed to fetch year ${year}:`, error);
        // Continue with next year
      }
    }

    return allQuestions;
  };

  /**
   * Fetch questions from local database for specific year
   */
  const fetchLocalQuestionsByYear = async (
    year: string,
    disciplines: string[],
    limit: number
  ): Promise<QuestionData[]> => {
    console.log(`[LOCAL] Fetching year=${year}, disciplines=${disciplines.join(",")}, limit=${limit}`);

    const { data, error } = await supabase
      .from("enem_questions")
      .select("*")
      .eq("year", year)
      .in("discipline", disciplines)
      .limit(limit * 2);

    if (error) {
      console.error("[LOCAL] Error:", error);
      return [];
    }

    console.log(`[LOCAL] Found ${data?.length || 0} questions`);

    const shuffled = (data || []).sort(() => Math.random() - 0.5).slice(0, limit);

    return shuffled.map(q => ({
      ...q,
      alternatives: Array.isArray(q.alternatives)
        ? (q.alternatives as unknown as Array<{ letter: string; text: string }>)
        : [],
    })) as unknown as QuestionData[];
  };

  /**
   * Fetch questions from local database (any year)
   */
  const fetchLocalQuestions = async (
    disciplines: string[],
    limit: number
  ): Promise<QuestionData[]> => {
    console.log(`[LOCAL] Fetching any year, disciplines=${disciplines.join(",")}, limit=${limit}`);

    const { data, error } = await supabase
      .from("enem_questions")
      .select("*")
      .in("discipline", disciplines)
      .limit(limit * 2);

    if (error) {
      console.error("[LOCAL] Error:", error);
      return [];
    }

    console.log(`[LOCAL] Found ${data?.length || 0} questions`);

    const shuffled = (data || []).sort(() => Math.random() - 0.5).slice(0, limit);

    return shuffled.map(q => ({
      ...q,
      alternatives: Array.isArray(q.alternatives)
        ? (q.alternatives as unknown as Array<{ letter: string; text: string }>)
        : [],
    })) as unknown as QuestionData[];
  };

  /**
   * Prepare simulado - ensures ALL questions are loaded before returning
   * Uses cache to avoid repeated API requests
   * Fetches from multiple years (2009-2024) when needed
   */
  const prepareSimulado = async (
    simuladoId: string,
    type: SimuladoType,
    year: string | null,
    totalQuestions: number
  ): Promise<{ success: boolean; questions: QuestionData[] }> => {
    // Create abort controller for this preparation
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState({
      status: "preparing",
      progress: 5,
      message: "Iniciando preparação do simulado...",
      questions: [],
      error: null,
      loadedCount: 0,
      targetCount: totalQuestions,
    });

    try {
      const disciplines = getDisciplinesForType(type);
      let fetchedQuestions: QuestionData[] = [];

      // Progress callback for real-time updates
      const updateProgress = (loaded: number, message: string) => {
        const progressPercent = Math.min(10 + (loaded / totalQuestions) * 60, 70);
        setState(prev => ({
          ...prev,
          progress: progressPercent,
          message,
          loadedCount: loaded,
        }));
      };

      if (year) {
        // Specific year selected - try cache first, then API, then fallback to all years
        const yearNum = parseInt(year);
        
        setState(prev => ({
          ...prev,
          progress: 10,
          message: `Verificando cache para ENEM ${year}...`,
        }));

        // Check cache first
        const cachedQuestions = await getCachedQuestions(year, disciplines);
        if (cachedQuestions.length >= totalQuestions) {
          console.log(`[Cache] Using ${cachedQuestions.length} cached questions for year ${year}`);
          fetchedQuestions = cachedQuestions.sort(() => Math.random() - 0.5).slice(0, totalQuestions) as unknown as QuestionData[];
        } else {
          // Try local database first
          const localQuestions = await fetchLocalQuestionsByYear(year, disciplines, totalQuestions);
          if (localQuestions.length >= totalQuestions) {
            fetchedQuestions = localQuestions;
          } else if (yearNum >= 2009 && yearNum <= 2024) {
            // Fetch from API for this specific year
            setState(prev => ({
              ...prev,
              progress: 15,
              message: `Carregando questões do ENEM ${year}...`,
            }));

            const apiQuestions = await fetchAllQuestionsFromAPIByYear(
              year,
              disciplines,
              signal,
              updateProgress
            );

            // Combine with local questions if needed
            fetchedQuestions = [...apiQuestions, ...localQuestions];
            
            // If still not enough, fetch from other years
            if (fetchedQuestions.length < totalQuestions) {
              const otherYears = ENEM_YEARS.filter(y => y !== year);
              const moreQuestions = await fetchQuestionsFromMultipleYears(
                otherYears,
                disciplines,
                totalQuestions - fetchedQuestions.length,
                signal,
                updateProgress
              );
              fetchedQuestions = [...fetchedQuestions, ...moreQuestions];
            }
          }
        }
      } else {
        // Custom simulado: fetch from ALL years (2009-2024)
        setState(prev => ({
          ...prev,
          progress: 10,
          message: "Buscando questões de 2009 a 2024...",
        }));

        fetchedQuestions = await fetchQuestionsFromMultipleYears(
          ENEM_YEARS,
          disciplines,
          totalQuestions,
          signal,
          updateProgress
        );

        // If not enough from API, complement with local database
        if (fetchedQuestions.length < totalQuestions) {
          const missing = totalQuestions - fetchedQuestions.length;
          console.log(`[Preparation] Need ${missing} more questions from local DB`);
          
          setState(prev => ({
            ...prev,
            progress: 75,
            message: `Complementando com ${missing} questões do banco local...`,
          }));

          const localQuestions = await fetchLocalQuestions(disciplines, missing);
          fetchedQuestions = [...fetchedQuestions, ...localQuestions];
        }
      }

      // Shuffle and limit to target count
      fetchedQuestions = fetchedQuestions.sort(() => Math.random() - 0.5).slice(0, totalQuestions);

      setState(prev => ({
        ...prev,
        progress: 80,
        message: "Validando questões carregadas...",
        loadedCount: fetchedQuestions.length,
      }));

      // VALIDAÇÃO RIGOROSA: Exigir quantidade mínima de questões
      if (fetchedQuestions.length === 0) {
        throw new Error(
          "Não foi possível carregar nenhuma questão. Verifique sua conexão e tente novamente."
        );
      }

      // Verificar se temos pelo menos 90% das questões solicitadas
      const minimumRequired = Math.floor(totalQuestions * 0.9);
      if (fetchedQuestions.length < minimumRequired) {
        throw new Error(
          `Foram carregadas apenas ${fetchedQuestions.length} de ${totalQuestions} questões necessárias. ` +
          `Tente novamente ou escolha um ano diferente.`
        );
      }

      setState(prev => ({
        ...prev,
        progress: 85,
        message: "Salvando configuração do simulado...",
      }));

      // Initialize answers in database
      const answers = fetchedQuestions.map((q, index) => ({
        simulado_id: simuladoId,
        question_id: q.id,
        question_index: index,
        discipline: q.discipline,
        correct_answer: q.correct_alternative,
        selected_answer: null,
        is_correct: null,
      }));

      const { error: insertError } = await supabase
        .from("simulado_answers")
        .insert(answers);

      if (insertError) {
        console.error("[Preparation] Insert error:", insertError);
        throw new Error("Erro ao salvar configuração do simulado. Tente novamente.");
      }

      setState({
        status: "ready",
        progress: 100,
        message: `Simulado pronto! ${fetchedQuestions.length} questões carregadas com sucesso.`,
        questions: fetchedQuestions,
        error: null,
        loadedCount: fetchedQuestions.length,
        targetCount: totalQuestions,
      });

      console.log(`[Preparation] SUCCESS: ${fetchedQuestions.length}/${totalQuestions} questions ready`);

      return { success: true, questions: fetchedQuestions };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("[Preparation] FAILED:", error);

      setState({
        status: "error",
        progress: 0,
        message: "",
        questions: [],
        error: errorMessage,
        loadedCount: 0,
        targetCount: totalQuestions,
      });

      return { success: false, questions: [] };
    }
  };

  return {
    ...state,
    prepareSimulado,
    reset,
  };
};
