import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface QuestionData {
  id?: string;
  index: number;
  title: string;
  discipline: string;
  language: string | null;
  context: string | null;
  files: string[] | null;
  alternativesIntroduction: string | null;
  alternatives: any;
  correctAlternative: string;
  year: string;
  difficulty: "easy" | "medium" | "hard" | null;
  mainTopic?: string | null;
  subtopics?: string[] | null;
}

interface CacheKey {
  year: string;
  discipline: string;
  language: string;
  difficulty: string;
  mainTopic: string;
  status: string;
  keyword: string;
}

interface QuestionCache {
  key: CacheKey;
  questionIds: string[];
  usedIds: Set<string>;
}

/**
 * Hook otimizado para gerenciar banco de questões
 * Suporta filtros por ano, disciplina, idioma, dificuldade, tópico, status e busca
 */
export const useQuestionBank = () => {
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<QuestionCache | null>(null);
  const requestIdRef = useRef(0);

  // Verifica se o cache é válido
  const isCacheValid = useCallback((
    year: string, 
    discipline: string, 
    language: string, 
    difficulty: string, 
    mainTopic: string = "all",
    status: string = "all",
    keyword: string = ""
  ) => {
    if (!cacheRef.current) return false;
    const { key } = cacheRef.current;
    return (
      key.year === year && 
      key.discipline === discipline && 
      key.language === language && 
      key.difficulty === difficulty && 
      key.mainTopic === mainTopic &&
      key.status === status &&
      key.keyword === keyword
    );
  }, []);

  // Carrega IDs das questões para o cache
  const loadQuestionIds = useCallback(async (
    year: string, 
    discipline: string, 
    language: string, 
    difficulty: string, 
    mainTopic: string = "all",
    status: string = "all",
    keyword: string = "",
    userId: string | null = null
  ) => {
    let query = supabase
      .from('enem_questions')
      .select('id, title, context')
      .eq('classification_status', 'ready')
      .eq('is_active', true);
    
    if (year !== "all") {
      query = query.eq('year', year);
    }
    if (discipline !== "all") {
      query = query.eq('discipline', discipline);
    }
    if (language !== "all") {
      query = query.eq('language', language);
    }
    if (difficulty !== "all") {
      query = query.eq('difficulty', difficulty);
    }
    if (mainTopic !== "all") {
      query = query.eq('main_topic', mainTopic);
    }

    // Busca por palavra-chave
    if (keyword && keyword.trim().length > 0) {
      const searchTerm = `%${keyword.trim()}%`;
      query = query.or(`title.ilike.${searchTerm},context.ilike.${searchTerm}`);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("Erro ao carregar questões:", error);
      return [];
    }

    let questionIds = data?.map(q => q.id) || [];

    // Busca questões que o usuário teve dúvida (para dar 10% mais chance)
    let doubtQuestionIds: string[] = [];
    if (userId) {
      const { data: doubtAttempts } = await supabase
        .from('question_attempts')
        .select('question_id')
        .eq('user_id', userId)
        .eq('had_doubt', true);
      
      if (doubtAttempts) {
        doubtQuestionIds = doubtAttempts.map(a => a.question_id);
      }
    }

    // Filtra por status (requer busca de tentativas do usuário)
    if (status !== "all" && userId) {
      const { data: attempts, error: attemptsError } = await supabase
        .from('question_attempts')
        .select('question_id, is_correct')
        .eq('user_id', userId);

      if (!attemptsError && attempts) {
        const attemptedQuestions = new Map<string, boolean>();
        attempts.forEach(a => {
          // Marca como correto se alguma vez acertou
          if (!attemptedQuestions.has(a.question_id) || a.is_correct) {
            attemptedQuestions.set(a.question_id, a.is_correct);
          }
        });

        switch (status) {
          case "unanswered":
            questionIds = questionIds.filter(id => !attemptedQuestions.has(id));
            break;
          case "answered":
            questionIds = questionIds.filter(id => attemptedQuestions.has(id));
            break;
          case "correct":
            questionIds = questionIds.filter(id => attemptedQuestions.get(id) === true);
            break;
          case "incorrect":
            questionIds = questionIds.filter(id => {
              const result = attemptedQuestions.get(id);
              return result === false;
            });
            break;
        }
      }
    }

    // Adiciona 10% extra de chance para questões com dúvida
    // Fazemos isso adicionando IDs duplicados (aproximadamente 10% extras)
    const idsWithDoubtBoost: string[] = [...questionIds];
    doubtQuestionIds.forEach(doubtId => {
      if (questionIds.includes(doubtId)) {
        // Adiciona o ID mais uma vez (aproximadamente 10% de boost = 1 extra a cada ~10)
        const extraChances = Math.ceil(questionIds.length * 0.1 / Math.max(1, doubtQuestionIds.length));
        for (let i = 0; i < Math.min(extraChances, 2); i++) {
          idsWithDoubtBoost.push(doubtId);
        }
      }
    });

    return idsWithDoubtBoost;
  }, []);

  // Busca uma questão específica por ID
  const fetchQuestionById = useCallback(async (id: string): Promise<QuestionData | null> => {
    const { data, error } = await supabase
      .from('enem_questions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      index: data.index,
      title: data.title,
      discipline: data.discipline,
      language: data.language,
      context: data.context,
      files: data.files,
      alternativesIntroduction: data.alternatives_introduction,
      alternatives: data.alternatives,
      correctAlternative: data.correct_alternative,
      year: data.year,
      difficulty: data.difficulty as "easy" | "medium" | "hard" | null,
      mainTopic: (data as any).main_topic,
      subtopics: (data as any).subtopics,
    };
  }, []);


  // Função principal para buscar questão
  const fetchQuestion = useCallback(async (
    year: string,
    discipline: string,
    language: string,
    difficulty: string = "all",
    random: boolean = true,
    mainTopic: string = "all",
    status: string = "all",
    keyword: string = "",
    userId: string | null = null
  ) => {
    const requestId = ++requestIdRef.current;
    const isCurrentRequest = () => requestId === requestIdRef.current;
    const finishLoading = () => {
      if (isCurrentRequest()) setLoading(false);
    };
    setLoading(true);
    
    try {
      const yearNum = year === "all" ? 0 : parseInt(year);
      
      // Anos 2024+ usam banco local com cache
      if (yearNum >= 2024) {
        if (!isCacheValid(year, discipline, language, difficulty, mainTopic, status, keyword)) {
          const ids = await loadQuestionIds(year, discipline, language, difficulty, mainTopic, status, keyword, userId);
          if (!isCurrentRequest()) return { success: false };
          cacheRef.current = {
            key: { year, discipline, language, difficulty, mainTopic, status, keyword },
            questionIds: ids,
            usedIds: new Set(),
          };
        }

        const cache = cacheRef.current!;
        
        if (cache.questionIds.length === 0) {
          setCurrentQuestion(null);
          finishLoading();
          return { success: false, message: "Nenhuma questão encontrada com esses filtros" };
        }

        let availableIds = cache.questionIds.filter(id => !cache.usedIds.has(id));
        
        if (availableIds.length === 0) {
          cache.usedIds.clear();
          availableIds = cache.questionIds;
        }

        const randomIndex = random 
          ? Math.floor(Math.random() * availableIds.length) 
          : 0;
        const selectedId = availableIds[randomIndex];
        
        cache.usedIds.add(selectedId);

        const question = await fetchQuestionById(selectedId);
        if (!isCurrentRequest()) return { success: false };
        
        if (question) {
          setCurrentQuestion(question);
          finishLoading();
          return { success: true };
        } else {
          setCurrentQuestion(null);
          finishLoading();
          return { success: false, message: "Erro ao carregar questão" };
        }
      } else if (year === "all") {
        // "Todos os anos" - busca apenas do banco local
        if (!isCacheValid("all", discipline, language, difficulty, mainTopic, status, keyword)) {
          const ids = await loadQuestionIds("all", discipline, language, difficulty, mainTopic, status, keyword, userId);
          if (!isCurrentRequest()) return { success: false };
          cacheRef.current = {
            key: { year: "all", discipline, language, difficulty, mainTopic, status, keyword },
            questionIds: ids,
            usedIds: new Set(),
          };
        }
        
        const cache = cacheRef.current;
        if (cache && cache.questionIds.length > 0) {
          let availableIds = cache.questionIds.filter(id => !cache.usedIds.has(id));
          if (availableIds.length === 0) {
            cache.usedIds.clear();
            availableIds = cache.questionIds;
          }
          const randomIndex = Math.floor(Math.random() * availableIds.length);
          const selectedId = availableIds[randomIndex];
          cache.usedIds.add(selectedId);
          
          const question = await fetchQuestionById(selectedId);
          if (!isCurrentRequest()) return { success: false };
          if (question) {
            setCurrentQuestion(question);
            finishLoading();
            return { success: true };
          }
        }
        
        setCurrentQuestion(null);
        finishLoading();
        return { success: false, message: "Nenhuma questão encontrada" };
      } else {
        // Anos específicos (2009-2023) - busca do banco local
        if (!isCacheValid(year, discipline, language, difficulty, mainTopic, status, keyword)) {
          const ids = await loadQuestionIds(year, discipline, language, difficulty, mainTopic, status, keyword, userId);
          if (!isCurrentRequest()) return { success: false };
          cacheRef.current = {
            key: { year, discipline, language, difficulty, mainTopic, status, keyword },
            questionIds: ids,
            usedIds: new Set(),
          };
        }

        const cache = cacheRef.current!;
        
        if (cache.questionIds.length === 0) {
          setCurrentQuestion(null);
          finishLoading();
          return { success: false, message: "Nenhuma questão encontrada com esses filtros" };
        }

        let availableIds = cache.questionIds.filter(id => !cache.usedIds.has(id));
        
        if (availableIds.length === 0) {
          cache.usedIds.clear();
          availableIds = cache.questionIds;
        }

        const randomIndex = random 
          ? Math.floor(Math.random() * availableIds.length) 
          : 0;
        const selectedId = availableIds[randomIndex];
        
        cache.usedIds.add(selectedId);

        const question = await fetchQuestionById(selectedId);
        if (!isCurrentRequest()) return { success: false };
        
        if (question) {
          setCurrentQuestion(question);
          finishLoading();
          return { success: true };
        } else {
          setCurrentQuestion(null);
          finishLoading();
          return { success: false, message: "Erro ao carregar questão" };
        }
      }
    } catch {
      setCurrentQuestion(null);
      finishLoading();
      return { success: false, message: "Erro ao carregar questão" };
    }
  }, [isCacheValid, loadQuestionIds, fetchQuestionById]);

  const clearCache = useCallback(() => {
    requestIdRef.current += 1;
    cacheRef.current = null;
  }, []);

  const getAvailableCount = useCallback(() => {
    if (!cacheRef.current) return 0;
    return cacheRef.current.questionIds.length;
  }, []);

  return {
    currentQuestion,
    loading,
    fetchQuestion,
    clearCache,
    getAvailableCount,
  };
};

export default useQuestionBank;
