import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface QuestionData {
  id?: string; // ID da questão no banco (para atualizar dificuldade)
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
  difficulty: "easy" | "medium" | "hard" | null; // Nível de dificuldade
}

interface CacheKey {
  year: string;
  discipline: string;
  language: string;
  difficulty: string;
}

interface QuestionCache {
  key: CacheKey;
  questionIds: string[];
  usedIds: Set<string>;
}


/**
 * Mapeia disciplina do filtro interno para o valor esperado pela API externa.
 */
const mapDisciplineForExternalAPI = (discipline: string) => {
  // Banco local usa: humanas | natureza | matematica | linguagens
  // API externa usa: ciencias-humanas | ciencias-natureza | matematica | linguagens
  if (discipline === "humanas") return "ciencias-humanas";
  if (discipline === "natureza") return "ciencias-natureza";
  return discipline;
};

/**
 * Hook otimizado para gerenciar banco de questões
 * Cacheia IDs das questões para navegação instantânea
 */
export const useQuestionBank = () => {
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<QuestionCache | null>(null);

  // Verifica se o cache é válido para os filtros atuais
  const isCacheValid = useCallback((year: string, discipline: string, language: string, difficulty: string) => {
    if (!cacheRef.current) return false;
    const { key } = cacheRef.current;
    return key.year === year && key.discipline === discipline && key.language === language && key.difficulty === difficulty;
  }, []);

  // Carrega IDs das questões para o cache (banco local)
  const loadQuestionIds = useCallback(async (year: string, discipline: string, language: string, difficulty: string) => {
    let query = supabase
      .from('enem_questions')
      .select('id');
    
    // Filtra por ano apenas se não for "all"
    if (year !== "all") {
      query = query.eq('year', year);
    }
    if (discipline !== "all") {
      query = query.eq('discipline', discipline);
    }
    if (language !== "all") {
      query = query.eq('language', language);
    }
    // Filtra por dificuldade apenas se não for "all"
    if (difficulty !== "all") {
      query = query.eq('difficulty', difficulty);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("Erro ao carregar IDs:", error);
      return [];
    }

    return data?.map(q => q.id) || [];
  }, []);

  // Busca uma questão específica por ID (banco local)
  const fetchQuestionById = useCallback(async (id: string): Promise<QuestionData | null> => {
    const { data, error } = await supabase
      .from('enem_questions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      console.error("Erro ao buscar questão:", error);
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
    };
  }, []);


  // Busca questão da API externa (anos 2009-2023)
  const fetchFromExternalAPI = useCallback(async (
    year: string, 
    discipline: string, 
    language: string,
    random: boolean
  ): Promise<QuestionData | null> => {
    const params = new URLSearchParams();

    if (discipline !== "all") {
      params.append("discipline", mapDisciplineForExternalAPI(discipline));
    }
    if (language !== "all") {
      params.append("language", language);
    }

    params.append("limit", "1");
    if (random) {
      const randomOffset = Math.floor(Math.random() * 100);
      params.append("offset", randomOffset.toString());
    } else {
      params.append("offset", "0");
    }

    const url = `https://api.enem.dev/v1/exams/${year}/questions?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("API error");

      const data = await response.json();

      if (data.questions && data.questions.length > 0) {
        return { ...data.questions[0], year, difficulty: null }; // API externa não tem dificuldade
      }
    } catch (error) {
      console.error("Erro API externa:", error);
    }

    return null;
  }, []);

  // Função principal para buscar questão
  const fetchQuestion = useCallback(async (
    year: string,
    discipline: string,
    language: string,
    difficulty: string = "all",
    random: boolean = true
  ) => {
    setLoading(true);
    
    try {
      const yearNum = year === "all" ? 0 : parseInt(year);
      
      // Anos 2024+ usam banco local com cache
      if (yearNum >= 2024) {
        // Carrega cache se necessário
        if (!isCacheValid(year, discipline, language, difficulty)) {
          const ids = await loadQuestionIds(year, discipline, language, difficulty);
          cacheRef.current = {
            key: { year, discipline, language, difficulty },
            questionIds: ids,
            usedIds: new Set(),
          };
        }

        const cache = cacheRef.current!;
        
        if (cache.questionIds.length === 0) {
          setCurrentQuestion(null);
          setLoading(false);
          return { success: false, message: "Nenhuma questão encontrada" };
        }

        // Seleciona ID aleatório não usado
        let availableIds = cache.questionIds.filter(id => !cache.usedIds.has(id));
        
        // Se todas foram usadas, reseta
        if (availableIds.length === 0) {
          cache.usedIds.clear();
          availableIds = cache.questionIds;
        }

        const randomIndex = random 
          ? Math.floor(Math.random() * availableIds.length) 
          : 0;
        const selectedId = availableIds[randomIndex];
        
        // Marca como usada
        cache.usedIds.add(selectedId);

        // Busca a questão
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
        // "Todos os anos" - busca aleatoriamente do banco local OU API externa
        const useLocalDB = Math.random() > 0.5;
        
        if (useLocalDB) {
          // Busca do banco local (2024)
          if (!isCacheValid("2024", discipline, language, difficulty)) {
            const ids = await loadQuestionIds("2024", discipline, language, difficulty);
            cacheRef.current = {
              key: { year: "2024", discipline, language, difficulty },
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
        }
        
        // Busca da API externa (anos aleatórios 2009-2023)
        const years = ["2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015"];
        const randomYear = years[Math.floor(Math.random() * years.length)];
        const question = await fetchFromExternalAPI(randomYear, discipline, language, random);
        
        if (question) {
          setCurrentQuestion(question);
          setLoading(false);
          return { success: true };
        } else {
          setCurrentQuestion(null);
          setLoading(false);
          return { success: false, message: "Nenhuma questão encontrada" };
        }
      } else {
        // Anos 2009-2023 usam API externa
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
    } catch (error) {
      console.error("Erro ao buscar questão:", error);
      setCurrentQuestion(null);
      setLoading(false);
      return { success: false, message: "Erro ao carregar questão" };
    }
  }, [isCacheValid, loadQuestionIds, fetchQuestionById, fetchFromExternalAPI]);

  // Limpa o cache (útil quando filtros mudam)
  const clearCache = useCallback(() => {
    cacheRef.current = null;
  }, []);

  // Retorna quantidade de questões disponíveis
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
