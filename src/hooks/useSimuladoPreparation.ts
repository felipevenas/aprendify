import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SimuladoType } from "@/hooks/useSimulados";

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
 * Configuration for retry mechanism
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  timeoutMs: 30000, // 30 seconds timeout per request
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
}

/**
 * Hook to prepare simulado with all questions loaded
 * Ensures complete data before allowing navigation
 */
export const useSimuladoPreparation = () => {
  const [state, setState] = useState<PreparationState>({
    status: "idle",
    progress: 0,
    message: "",
    questions: [],
    error: null,
  });

  /**
   * Reset preparation state
   */
  const reset = useCallback(() => {
    setState({
      status: "idle",
      progress: 0,
      message: "",
      questions: [],
      error: null,
    });
  }, []);

  /**
   * Fetch with timeout wrapper
   */
  const fetchWithTimeout = async (
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  /**
   * Retry mechanism with exponential backoff
   */
  const retryWithBackoff = async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[Retry] ${operationName} attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries} failed:`,
          error
        );

        if (attempt < RETRY_CONFIG.maxRetries - 1) {
          const delay = Math.min(
            RETRY_CONFIG.initialDelayMs * Math.pow(2, attempt),
            RETRY_CONFIG.maxDelayMs
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`${operationName} failed after retries`);
  };

  /**
   * Map local discipline names to API format
   */
  const mapLocalDisciplineToAPI = (localDiscipline: string): string => {
    const mapping: Record<string, string> = {
      humanas: "ciencias-humanas",
      natureza: "ciencias-natureza",
      matematica: "matematica",
      linguagens: "linguagens",
    };
    return mapping[localDiscipline] || localDiscipline;
  };

  /**
   * Map API discipline names to local format
   */
  const mapAPIDisciplineToLocal = (apiDiscipline: string): string => {
    const mapping: Record<string, string> = {
      "ciencias-humanas": "humanas",
      "ciencias-natureza": "natureza",
      matematica: "matematica",
      linguagens: "linguagens",
    };
    return mapping[apiDiscipline] || apiDiscipline;
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
   * Fetch questions from external ENEM API with retry and timeout
   */
  const fetchQuestionsFromAPI = async (
    year: string,
    disciplines: string[],
    limit: number
  ): Promise<QuestionData[]> => {
    const apiDisciplines = disciplines.map((d) => mapLocalDisciplineToAPI(d));
    console.log(`[API] Fetching year=${year}, disciplines=${apiDisciplines.join(",")}, limit=${limit}`);

    const API_PAGE_LIMIT = 50;
    let allQuestions: any[] = [];
    let offset = 0;
    let hasMore = true;

    // Fetch all pages with retry for each page
    while (hasMore) {
      const url = `https://api.enem.dev/v1/exams/${year}/questions?limit=${API_PAGE_LIMIT}&offset=${offset}`;

      try {
        const response = await retryWithBackoff(async () => {
          const resp = await fetchWithTimeout(
            url,
            { method: "GET", headers: { Accept: "application/json" } },
            RETRY_CONFIG.timeoutMs
          );

          if (!resp.ok) {
            throw new Error(`API returned ${resp.status}`);
          }

          return resp;
        }, `Fetch API page offset=${offset}`);

        const data = await response.json();

        if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
          hasMore = false;
          break;
        }

        allQuestions = [...allQuestions, ...data.questions];
        console.log(`[API] Page fetched: ${data.questions.length} questions, total: ${allQuestions.length}`);

        hasMore = data.questions.length >= API_PAGE_LIMIT && offset < 500;
        offset += API_PAGE_LIMIT;
      } catch (error) {
        console.error(`[API] Failed to fetch page at offset ${offset}:`, error);
        hasMore = false;
      }
    }

    if (allQuestions.length === 0) {
      console.warn("[API] No questions fetched");
      return [];
    }

    // Filter by disciplines
    const filteredQuestions = allQuestions.filter((q: any) =>
      apiDisciplines.includes(q.discipline)
    );

    console.log(`[API] Filtered ${filteredQuestions.length} questions`);

    // Map to our format
    const mappedQuestions: QuestionData[] = filteredQuestions.map((q: any, idx: number) => ({
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

    // Shuffle and limit
    return mappedQuestions.sort(() => Math.random() - 0.5).slice(0, limit);
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

    const { data, error } = await retryWithBackoff(async () => {
      const result = await supabase
        .from("enem_questions")
        .select("*")
        .eq("year", year)
        .in("discipline", disciplines)
        .limit(limit * 2);

      if (result.error) throw result.error;
      return result;
    }, "Fetch local DB by year");

    if (error || !data) {
      console.error("[LOCAL] Error:", error);
      return [];
    }

    console.log(`[LOCAL] Found ${data.length} questions`);

    const shuffled = data.sort(() => Math.random() - 0.5).slice(0, limit);

    return shuffled.map((q) => ({
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

    const { data, error } = await retryWithBackoff(async () => {
      const result = await supabase
        .from("enem_questions")
        .select("*")
        .in("discipline", disciplines)
        .limit(limit * 2);

      if (result.error) throw result.error;
      return result;
    }, "Fetch local DB");

    if (error || !data) {
      console.error("[LOCAL] Error:", error);
      return [];
    }

    console.log(`[LOCAL] Found ${data.length} questions`);

    const shuffled = data.sort(() => Math.random() - 0.5).slice(0, limit);

    return shuffled.map((q) => ({
      ...q,
      alternatives: Array.isArray(q.alternatives)
        ? (q.alternatives as unknown as Array<{ letter: string; text: string }>)
        : [],
    })) as unknown as QuestionData[];
  };

  /**
   * Prepare simulado - ensures all questions are loaded before returning
   * Returns simuladoId only when ready, or null if failed
   */
  const prepareSimulado = async (
    simuladoId: string,
    type: SimuladoType,
    year: string | null,
    totalQuestions: number
  ): Promise<{ success: boolean; questions: QuestionData[] }> => {
    setState({
      status: "preparing",
      progress: 10,
      message: "Iniciando preparação do simulado...",
      questions: [],
      error: null,
    });

    try {
      const disciplines = getDisciplinesForType(type);
      let fetchedQuestions: QuestionData[] = [];
      const yearNum = year ? parseInt(year) : 0;

      setState((prev) => ({
        ...prev,
        progress: 20,
        message: "Buscando questões...",
      }));

      // Fetch questions based on year/type
      if (year && yearNum >= 2024) {
        // Anos 2024+ usam banco local
        setState((prev) => ({
          ...prev,
          progress: 30,
          message: "Carregando questões do banco de dados...",
        }));
        fetchedQuestions = await fetchLocalQuestionsByYear(year, disciplines, totalQuestions);
      } else if (year && yearNum >= 2009 && yearNum < 2024) {
        // Anos 2009-2023 usam API externa
        setState((prev) => ({
          ...prev,
          progress: 30,
          message: "Conectando à API do ENEM...",
        }));
        fetchedQuestions = await fetchQuestionsFromAPI(year, disciplines, totalQuestions);

        // Fallback para banco local se API não retornar questões suficientes
        if (fetchedQuestions.length < totalQuestions * 0.5) {
          setState((prev) => ({
            ...prev,
            progress: 50,
            message: "Complementando com banco local...",
          }));
          const localQuestions = await fetchLocalQuestions(disciplines, totalQuestions - fetchedQuestions.length);
          fetchedQuestions = [...fetchedQuestions, ...localQuestions];
        }
      } else {
        // Simulado personalizado sem ano específico
        setState((prev) => ({
          ...prev,
          progress: 30,
          message: "Buscando questões de múltiplas fontes...",
        }));

        const apiQuestions = await fetchQuestionsFromAPI("2023", disciplines, Math.ceil(totalQuestions / 2));
        
        setState((prev) => ({
          ...prev,
          progress: 50,
          message: "Carregando questões adicionais...",
        }));
        
        const localQuestions = await fetchLocalQuestions(disciplines, Math.ceil(totalQuestions / 2));

        fetchedQuestions = [...apiQuestions, ...localQuestions]
          .sort(() => Math.random() - 0.5)
          .slice(0, totalQuestions);
      }

      setState((prev) => ({
        ...prev,
        progress: 70,
        message: "Validando questões...",
      }));

      // Validação: garantir que temos questões suficientes
      if (fetchedQuestions.length === 0) {
        throw new Error("Não foi possível carregar nenhuma questão. Por favor, tente novamente.");
      }

      // Aviso se houver menos questões que o esperado
      if (fetchedQuestions.length < totalQuestions * 0.8) {
        console.warn(
          `[Preparation] Loaded ${fetchedQuestions.length}/${totalQuestions} questions (below 80% threshold)`
        );
      }

      setState((prev) => ({
        ...prev,
        progress: 80,
        message: "Inicializando respostas...",
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

      const { error: insertError } = await retryWithBackoff(async () => {
        const result = await supabase.from("simulado_answers").insert(answers);
        if (result.error) throw result.error;
        return result;
      }, "Initialize answers");

      if (insertError) {
        throw new Error("Erro ao preparar respostas do simulado");
      }

      setState({
        status: "ready",
        progress: 100,
        message: `Simulado pronto! ${fetchedQuestions.length} questões carregadas.`,
        questions: fetchedQuestions,
        error: null,
      });

      console.log(`[Preparation] SUCCESS: ${fetchedQuestions.length} questions ready`);

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
