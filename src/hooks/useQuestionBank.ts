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


const EXTERNAL_API_BASE = "https://api.enem.dev/v1";

// Cache simples em memória
const externalExamTotalsCache = new Map<string, number>();

const canonicalizeDiscipline = (discipline: string) => {
  const d = discipline.toLowerCase();
  if (d === "ciencias-humanas") return "humanas";
  if (d === "ciencias-natureza" || d === "ciencias-da-natureza") return "natureza";
  return d;
};

const disciplineMatchesFilter = (questionDiscipline: unknown, selectedDiscipline: string) => {
  if (selectedDiscipline === "all") return true;
  if (typeof questionDiscipline !== "string") return false;
  return canonicalizeDiscipline(questionDiscipline) === canonicalizeDiscipline(selectedDiscipline);
};

const getExternalExamTotal = async (year: string, language: string): Promise<number> => {
  const key = `${year}:${language}`;
  const cached = externalExamTotalsCache.get(key);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({ limit: "1", offset: "0" });
    if (language !== "all") params.append("language", language);

    const url = `${EXTERNAL_API_BASE}/exams/${year}/questions?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("API error");

    const data = await response.json();
    const total =
      typeof data?.metadata?.total === "number" && data.metadata.total > 0 ? data.metadata.total : 180;

    externalExamTotalsCache.set(key, total);
    return total;
  } catch {
    externalExamTotalsCache.set(key, 180);
    return 180;
  }
};

/**
 * Hook otimizado para gerenciar banco de questões
 * Suporta filtros por ano, disciplina, idioma, dificuldade, tópico, status e busca
 */
export const useQuestionBank = () => {
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<QuestionCache | null>(null);

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
      .eq('classification_status', 'ready');
    
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

    return questionIds;
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

  // Busca questão da API externa
  const fetchFromExternalAPI = useCallback(async (
    year: string,
    discipline: string,
    language: string,
    random: boolean
  ): Promise<QuestionData | null> => {
    const total = await getExternalExamTotal(year, language);

    const attempts = discipline === "all" ? 1 : 12;

    for (let i = 0; i < attempts; i++) {
      const offset = random
        ? Math.floor(Math.random() * total)
        : discipline === "all"
          ? 0
          : Math.floor(Math.random() * total);

      const params = new URLSearchParams({ limit: "1", offset: offset.toString() });
      if (language !== "all") params.append("language", language);

      const url = `${EXTERNAL_API_BASE}/exams/${year}/questions?${params.toString()}`;

      try {
        const response = await fetch(url);
        if (!response.ok) continue;

        const data = await response.json();
        const q = data?.questions?.[0];
        if (!q) continue;

        if (!disciplineMatchesFilter(q.discipline, discipline)) continue;

        return { ...q, year: year.toString(), difficulty: null };
      } catch {
        // ignora e tenta novamente
      }
    }

    return null;
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
    setLoading(true);
    
    try {
      const yearNum = year === "all" ? 0 : parseInt(year);
      
      // Anos 2024+ usam banco local com cache
      if (yearNum >= 2024) {
        if (!isCacheValid(year, discipline, language, difficulty, mainTopic, status, keyword)) {
          const ids = await loadQuestionIds(year, discipline, language, difficulty, mainTopic, status, keyword, userId);
          cacheRef.current = {
            key: { year, discipline, language, difficulty, mainTopic, status, keyword },
            questionIds: ids,
            usedIds: new Set(),
          };
        }

        const cache = cacheRef.current!;
        
        if (cache.questionIds.length === 0) {
          setCurrentQuestion(null);
          setLoading(false);
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
        
        if (question) {
          setCurrentQuestion(question);
          setLoading(false);
          return { success: true };
        } else {
          setCurrentQuestion(null);
          setLoading(false);
          return { success: false, message: "Erro ao carregar questão" };
        }
      } else if (year === "all") {
        // "Todos os anos" - busca do banco local primeiro, depois API
        if (!isCacheValid("all", discipline, language, difficulty, mainTopic, status, keyword)) {
          const ids = await loadQuestionIds("all", discipline, language, difficulty, mainTopic, status, keyword, userId);
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
          if (question) {
            setCurrentQuestion(question);
            setLoading(false);
            return { success: true };
          }
        }
        
        // Fallback: API externa (sem filtros avançados)
        if (status === "all" && keyword === "") {
          const years = ["2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015"];
          const randomYear = years[Math.floor(Math.random() * years.length)];
          const question = await fetchFromExternalAPI(randomYear, discipline, language, random);
          
          if (question) {
            setCurrentQuestion(question);
            setLoading(false);
            return { success: true };
          }
        }
        
        setCurrentQuestion(null);
        setLoading(false);
        return { success: false, message: "Nenhuma questão encontrada" };
      } else {
        // Anos 2009-2023 usam API externa (sem filtros avançados)
        if (status !== "all" || keyword !== "" || mainTopic !== "all") {
          setCurrentQuestion(null);
          setLoading(false);
          return { success: false, message: "Filtros avançados disponíveis apenas para questões do banco local (2024+)" };
        }
        
        const question = await fetchFromExternalAPI(year, discipline, language, random);
        
        if (question) {
          setCurrentQuestion(question);
          setLoading(false);
          return { success: true };
        } else {
          setCurrentQuestion(null);
          setLoading(false);
          return { success: false, message: "Nenhuma questão encontrada" };
        }
      }
    } catch {
      setCurrentQuestion(null);
      setLoading(false);
      return { success: false, message: "Erro ao carregar questão" };
    }
  }, [isCacheValid, loadQuestionIds, fetchQuestionById, fetchFromExternalAPI]);

  const clearCache = useCallback(() => {
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
