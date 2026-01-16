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
 * Configuration for API rate limiting with retry support
 */
const API_CONFIG = {
  rateLimitMs: 1500,      // 1.5s entre requisições (mais seguro)
  pageSize: 50,
  maxOffset: 500,
  maxRetries: 3,          // Tentar até 3 vezes em caso de rate limit
  retryDelayMs: 5000,     // Esperar 5s antes de retry
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
 * Dia 1 ENEM: Linguagens (45) + Humanas (45) = 90 questões
 * Dia 2 ENEM: Natureza (45) + Matemática (45) = 90 questões
 */
const getDisciplinesForType = (type: SimuladoType): string[] => {
  switch (type) {
    case "official_day1":
      return ["linguagens", "humanas"]; // Corrigido: Dia 1 = Linguagens + Humanas
    case "official_day2":
      return ["natureza", "matematica"]; // Dia 2 = Natureza + Matemática
    case "custom_naturezas":
      return ["natureza"];
    case "custom_humanas":
      return ["humanas"];
    case "custom_matematica":
      return ["matematica"];
    case "custom_mixed":
    default:
      return ["linguagens", "humanas", "natureza", "matematica"];
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
   * Returns questions filtered by discipline
   */
  const fetchQuestionsFromAPI = async (
    year: string,
    disciplines: string[],
    signal: AbortSignal,
    onProgress?: (loaded: number) => void
  ): Promise<QuestionData[]> => {
    const apiDisciplines = disciplines.map(mapLocalToAPI);
    const allQuestions: any[] = [];
    let offset = 0;
    let hasMore = true;
    let retryCount = 0;

    console.log(`[API] Fetching year ${year} for disciplines:`, apiDisciplines);

    while (hasMore && !signal.aborted) {
      await waitForRateLimit();
      
      const url = `https://api.enem.dev/v1/exams/${year}/questions?limit=${API_CONFIG.pageSize}&offset=${offset}`;
      
      try {
        const response = await fetch(url, { signal });
        
        if (response.status === 429) {
          retryCount++;
          if (retryCount > API_CONFIG.maxRetries) {
            console.warn(`[API] Max retries reached for year ${year}, moving on with ${allQuestions.length} questions`);
            break;
          }
          
          const retryAfter = response.headers.get("Retry-After");
          const waitTime = parseInt(retryAfter || "5") * 1000;
          console.log(`[API] Rate limited, waiting ${waitTime}ms (retry ${retryCount}/${API_CONFIG.maxRetries})`);
          
          setState(prev => ({
            ...prev,
            message: `Aguardando API... (${Math.ceil(waitTime/1000)}s)`,
          }));
          
          await new Promise(resolve => setTimeout(resolve, Math.max(waitTime, API_CONFIG.retryDelayMs)));
          continue; // Retry same offset
        }
        
        // Reset retry count on success
        retryCount = 0;
        
        if (response.status === 404) {
          console.log(`[API] Year ${year} not found (404)`);
          break;
        }
        
        if (!response.ok) {
          console.error(`[API] Error ${response.status} for year ${year}`);
          break;
        }

        const data = await response.json();
        
        if (!data.questions || data.questions.length === 0) {
          hasMore = false;
          break;
        }

        allQuestions.push(...data.questions);
        console.log(`[API] Year ${year}: fetched ${data.questions.length} questions (total: ${allQuestions.length})`);
        
        // Report progress
        if (onProgress) {
          onProgress(allQuestions.filter(q => apiDisciplines.includes(q.discipline)).length);
        }
        
        hasMore = data.questions.length >= API_CONFIG.pageSize;
        offset += API_CONFIG.pageSize;

        if (offset > API_CONFIG.maxOffset) hasMore = false;
      } catch (error) {
        if (signal.aborted) throw error;
        console.error(`[API] Error fetching year ${year} offset ${offset}:`, error);
        
        // Retry on network errors
        retryCount++;
        if (retryCount <= API_CONFIG.maxRetries) {
          console.log(`[API] Network error, retrying (${retryCount}/${API_CONFIG.maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.retryDelayMs));
          continue;
        }
        break;
      }
    }

    // Filtrar por disciplinas solicitadas
    const filtered = allQuestions.filter(q => apiDisciplines.includes(q.discipline));
    console.log(`[API] Year ${year}: ${filtered.length} questions after filtering for ${apiDisciplines.join(', ')}`);

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
    disciplines: string[]
  ): Promise<QuestionData[]> => {
    let query = supabase
      .from("enem_questions")
      .select("*")
      .in("discipline", disciplines)
      .eq("is_active", true);

    if (year) {
      query = query.eq("year", year);
    }

    const { data, error } = await query;
    
    if (error || !data) {
      return [];
    }

    return data.map(q => ({
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

      // CASO 1: Ano específico selecionado (Simulado Oficial)
      if (year) {
        const yearNum = parseInt(year);
        console.log(`[Simulado] Starting for year ${year}, disciplines: ${disciplines.join(', ')}, target: ${totalQuestions}`);
        updateProgress(`Carregando ${disciplines.join(' + ')} do ENEM ${year}...`);

        // Determinar fonte baseado no ano
        if (yearNum >= 2024) {
          // Anos 2024+: buscar do banco local
          const localQuestions = await fetchLocalQuestions(year, disciplines);
          console.log(`[Simulado] Local DB returned ${localQuestions.length} questions for ${year}`);
          
          // Embaralhar e adicionar
          const shuffled = localQuestions.sort(() => Math.random() - 0.5);
          addUniqueQuestions(shuffled);
          
          updateProgress(`${collectedQuestions.length}/${totalQuestions} questões do ENEM ${year}`);
        } else {
          // Anos 2009-2023: buscar da API com progresso detalhado
          const apiQuestions = await fetchQuestionsFromAPI(
            year, 
            disciplines, 
            signal,
            (loaded) => {
              updateProgress(`Carregando ENEM ${year}... (${loaded} questões encontradas)`);
            }
          );
          
          console.log(`[Simulado] API returned ${apiQuestions.length} questions for ${year}`);
          
          // Embaralhar e adicionar
          const shuffled = apiQuestions.sort(() => Math.random() - 0.5);
          addUniqueQuestions(shuffled);
          
          updateProgress(`${collectedQuestions.length}/${totalQuestions} questões do ENEM ${year}`);
        }

        // Se não conseguiu questões suficientes do ano selecionado, buscar de anos adjacentes
        if (collectedQuestions.length < totalQuestions) {
          console.log(`[Simulado] Need more questions: ${collectedQuestions.length}/${totalQuestions}`);
          
          const adjacentYears = [
            yearNum - 1, yearNum + 1, 
            yearNum - 2, yearNum + 2,
            yearNum - 3, yearNum + 3
          ]
            .filter(y => y >= 2009 && y <= 2024 && y !== yearNum)
            .map(String);

          for (const adjYear of adjacentYears) {
            if (signal.aborted) throw new Error("Cancelado");
            if (collectedQuestions.length >= totalQuestions) break;

            updateProgress(`Complementando com ENEM ${adjYear}... (${collectedQuestions.length}/${totalQuestions})`);
            
            const adjYearNum = parseInt(adjYear);
            let moreQuestions: QuestionData[];
            
            if (adjYearNum >= 2024) {
              moreQuestions = await fetchLocalQuestions(adjYear, disciplines);
            } else {
              moreQuestions = await fetchQuestionsFromAPI(adjYear, disciplines, signal);
            }
            
            const shuffled = moreQuestions.sort(() => Math.random() - 0.5);
            addUniqueQuestions(shuffled);
            
            console.log(`[Simulado] After ${adjYear}: ${collectedQuestions.length}/${totalQuestions}`);
          }
        }

        // Validar se conseguimos questões suficientes
        if (collectedQuestions.length < totalQuestions) {
          throw new Error(
            `Foram encontradas apenas ${collectedQuestions.length} de ${totalQuestions} questões necessárias. ` +
            `Tente novamente ou escolha outro tipo de simulado.`
          );
        }
      } 
      // CASO 2: Simulado personalizado (sem ano específico)
      else {
        updateProgress("Buscando questões de múltiplos anos...");

        // Primeiro: banco local (questões mais recentes, 2024+)
        const localQuestions = await fetchLocalQuestions(null, disciplines);
        const shuffledLocal = localQuestions.sort(() => Math.random() - 0.5);
        addUniqueQuestions(shuffledLocal);
        
        console.log(`[Simulado] Local DB: ${collectedQuestions.length}/${totalQuestions}`);
        updateProgress(`${collectedQuestions.length}/${totalQuestions} do banco local`);

        // Se ainda precisar de mais questões, buscar da API por ano
        if (collectedQuestions.length < totalQuestions) {
          // Anos disponíveis na API (2009-2023)
          const apiYears = ["2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009"];
          
          // Embaralhar anos para variedade
          const shuffledYears = apiYears.sort(() => Math.random() - 0.5);
          
          for (const y of shuffledYears) {
            if (signal.aborted) throw new Error("Cancelado");
            if (collectedQuestions.length >= totalQuestions) break;

            updateProgress(`Carregando ENEM ${y}... (${collectedQuestions.length}/${totalQuestions})`);
            
            const apiQuestions = await fetchQuestionsFromAPI(y, disciplines, signal);
            const shuffled = apiQuestions.sort(() => Math.random() - 0.5);
            addUniqueQuestions(shuffled);
            
            console.log(`[Simulado] After ${y}: ${collectedQuestions.length}/${totalQuestions}`);
          }
        }

        // Validar quantidade final
        if (collectedQuestions.length < totalQuestions) {
          throw new Error(
            `Foram encontradas apenas ${collectedQuestions.length} de ${totalQuestions} questões necessárias. ` +
            `Tente novamente ou escolha outro tipo de simulado.`
          );
        }
      }

      // Embaralhar ordem final das questões
      const finalQuestions = collectedQuestions
        .sort(() => Math.random() - 0.5)
        .slice(0, totalQuestions);

      // VALIDAÇÃO FINAL RIGOROSA
      if (finalQuestions.length !== totalQuestions) {
        throw new Error(
          `Erro de validação: esperadas ${totalQuestions} questões, obtidas ${finalQuestions.length}. ` +
          `Por favor, tente novamente.`
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

      return { success: true, questions: finalQuestions };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";

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
