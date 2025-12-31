import { useState, useCallback, useRef } from "react";
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
 * Configuration for API rate limiting and retry
 */
const API_CONFIG = {
  rateLimitMs: 1100,
  maxRetries: 5,
  initialRetryDelayMs: 2000,
  maxRetryDelayMs: 10000,
  requestTimeoutMs: 45000,
  pageSize: 50,
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

const ENEM_YEARS = [
  "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016",
  "2015", "2014", "2013", "2012", "2011", "2010", "2009"
];

/**
 * Mapeia disciplinas locais para API e vice-versa
 */
const mapLocalToAPI = (d: string): string => {
  if (d === "humanas") return "ciencias-humanas";
  if (d === "natureza") return "ciencias-natureza";
  return d;
};

const mapAPIToLocal = (d: string): string => {
  if (d === "ciencias-humanas") return "humanas";
  if (d === "ciencias-natureza") return "natureza";
  return d;
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
 * Hook to prepare simulado with guaranteed question count
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

  const lastRequestTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
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

  const waitForRateLimit = async (): Promise<void> => {
    const now = Date.now();
    const timeSince = now - lastRequestTimeRef.current;
    if (timeSince < API_CONFIG.rateLimitMs) {
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.rateLimitMs - timeSince));
    }
    lastRequestTimeRef.current = Date.now();
  };

  /**
   * Fetch ALL questions from API for a specific year (with pagination)
   */
  const fetchAllQuestionsFromYear = async (
    year: string,
    disciplines: string[],
    signal: AbortSignal
  ): Promise<QuestionData[]> => {
    const apiDisciplines = disciplines.map(mapLocalToAPI);
    const allQuestions: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore && !signal.aborted) {
      await waitForRateLimit();
      
      const url = `https://api.enem.dev/v1/exams/${year}/questions?limit=${API_CONFIG.pageSize}&offset=${offset}`;
      
      try {
        const response = await fetch(url, { signal });
        
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter || "10000")));
          continue;
        }
        
        if (response.status === 404) {
          break;
        }
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.questions || data.questions.length === 0) {
          hasMore = false;
          break;
        }

        allQuestions.push(...data.questions);
        hasMore = data.questions.length >= API_CONFIG.pageSize;
        offset += API_CONFIG.pageSize;

        if (offset > 500) hasMore = false;
      } catch (error) {
        if (signal.aborted) throw error;
        console.error(`[API] Error fetching year ${year} offset ${offset}:`, error);
        break;
      }
    }

    // Filtrar por disciplinas
    const filtered = allQuestions.filter(q => apiDisciplines.includes(q.discipline));

    // Mapear para formato local
    return filtered.map((q, idx) => ({
      id: `api-${year}-${q.discipline}-${q.index || idx}`,
      title: q.title || "",
      context: q.context || null,
      alternatives: Array.isArray(q.alternatives)
        ? q.alternatives.map((alt: any) => ({ letter: alt.letter || "", text: alt.text || "" }))
        : [],
      alternatives_introduction: q.alternativesIntroduction || null,
      discipline: mapAPIToLocal(q.discipline),
      year: String(q.year || year),
      index: q.index || idx,
      files: Array.isArray(q.files) && q.files.length > 0 ? q.files : null,
      correct_alternative: q.correctAlternative || "",
    }));
  };

  /**
   * Fetch questions from local database
   */
  const fetchLocalQuestions = async (
    year: string | null,
    disciplines: string[],
    limit: number
  ): Promise<QuestionData[]> => {
    let query = supabase
      .from("enem_questions")
      .select("*")
      .in("discipline", disciplines)
      .limit(limit * 2);

    if (year) {
      query = query.eq("year", year);
    }

    const { data, error } = await query;
    
    if (error || !data) {
      console.error("[LOCAL] Error:", error);
      return [];
    }

    return data
      .sort(() => Math.random() - 0.5)
      .slice(0, limit)
      .map(q => ({
        ...q,
        alternatives: Array.isArray(q.alternatives)
          ? (q.alternatives as unknown as Array<{ letter: string; text: string }>)
          : [],
      })) as unknown as QuestionData[];
  };

  /**
   * Prepare simulado - GARANTE a quantidade exata de questões
   */
  const prepareSimulado = async (
    simuladoId: string,
    type: SimuladoType,
    year: string | null,
    totalQuestions: number
  ): Promise<{ success: boolean; questions: QuestionData[] }> => {
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
      const collectedQuestions: QuestionData[] = [];
      const usedIds = new Set<string>();

      const addUniqueQuestions = (questions: QuestionData[]) => {
        for (const q of questions) {
          if (!usedIds.has(q.id) && collectedQuestions.length < totalQuestions) {
            usedIds.add(q.id);
            collectedQuestions.push(q);
          }
        }
      };

      const updateProgress = (message: string) => {
        const progressPercent = Math.min(10 + (collectedQuestions.length / totalQuestions) * 80, 90);
        setState(prev => ({
          ...prev,
          progress: progressPercent,
          message,
          loadedCount: collectedQuestions.length,
        }));
      };

      // ESTRATÉGIA 1: Ano específico selecionado
      if (year) {
        const yearNum = parseInt(year);

        updateProgress(`Buscando questões do ENEM ${year}...`);

        // 1a. Tentar banco local primeiro (anos 2024+)
        if (yearNum >= 2024) {
          const local = await fetchLocalQuestions(year, disciplines, totalQuestions);
          addUniqueQuestions(local);
          updateProgress(`${collectedQuestions.length}/${totalQuestions} questões do banco local`);
        }

        // 1b. Se não tem o suficiente e é um ano da API (2009-2023)
        if (collectedQuestions.length < totalQuestions && yearNum >= 2009 && yearNum <= 2023) {
          updateProgress(`Carregando do ENEM ${year} via API...`);
          const apiQuestions = await fetchAllQuestionsFromYear(year, disciplines, signal);
          addUniqueQuestions(apiQuestions);
          updateProgress(`${collectedQuestions.length}/${totalQuestions} questões carregadas`);
        }

        // 1c. Se ainda não tem o suficiente, busca de outros anos
        if (collectedQuestions.length < totalQuestions) {
          const otherYears = ENEM_YEARS.filter(y => y !== year);
          
          for (const y of otherYears) {
            if (signal.aborted) throw new Error("Cancelado");
            if (collectedQuestions.length >= totalQuestions) break;

            updateProgress(`Complementando com ENEM ${y}... (${collectedQuestions.length}/${totalQuestions})`);

            const yNum = parseInt(y);
            if (yNum >= 2024) {
              const local = await fetchLocalQuestions(y, disciplines, totalQuestions - collectedQuestions.length);
              addUniqueQuestions(local);
            } else {
              const api = await fetchAllQuestionsFromYear(y, disciplines, signal);
              addUniqueQuestions(api);
            }
          }
        }
      } else {
        // ESTRATÉGIA 2: Simulado personalizado (sem ano específico)
        updateProgress("Buscando questões de múltiplos anos...");

        // 2a. Primeiro busca do banco local
        const local = await fetchLocalQuestions(null, disciplines, totalQuestions);
        addUniqueQuestions(local);
        updateProgress(`${collectedQuestions.length}/${totalQuestions} do banco local`);

        // 2b. Complementa com API se necessário
        if (collectedQuestions.length < totalQuestions) {
          const apiYears = ENEM_YEARS.filter(y => parseInt(y) < 2024);
          
          for (const y of apiYears) {
            if (signal.aborted) throw new Error("Cancelado");
            if (collectedQuestions.length >= totalQuestions) break;

            updateProgress(`Buscando ENEM ${y}... (${collectedQuestions.length}/${totalQuestions})`);
            const api = await fetchAllQuestionsFromYear(y, disciplines, signal);
            addUniqueQuestions(api);
          }
        }
      }

      // Shuffle final
      const finalQuestions = collectedQuestions
        .sort(() => Math.random() - 0.5)
        .slice(0, totalQuestions);

      // VALIDAÇÃO RIGOROSA: Exigir EXATAMENTE a quantidade solicitada
      if (finalQuestions.length < totalQuestions) {
        throw new Error(
          `Foram encontradas apenas ${finalQuestions.length} de ${totalQuestions} questões necessárias. ` +
          `Tente novamente ou escolha outro tipo de simulado.`
        );
      }

      setState(prev => ({
        ...prev,
        progress: 92,
        message: "Salvando configuração do simulado...",
        loadedCount: finalQuestions.length,
      }));

      // Inicializar respostas no banco
      const answers = finalQuestions.map((q, index) => ({
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
        throw new Error("Erro ao salvar configuração. Tente novamente.");
      }

      setState({
        status: "ready",
        progress: 100,
        message: `Simulado pronto! ${finalQuestions.length} questões carregadas.`,
        questions: finalQuestions,
        error: null,
        loadedCount: finalQuestions.length,
        targetCount: totalQuestions,
      });

      console.log(`[Preparation] SUCCESS: ${finalQuestions.length}/${totalQuestions} questões prontas`);
      return { success: true, questions: finalQuestions };

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
