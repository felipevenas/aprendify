import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Types for Simulado feature
 */
export interface Simulado {
  id: string;
  user_id: string;
  type: string;
  year: string | null;
  total_questions: number;
  duration_minutes: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  essay_topic: string | null;
  created_at: string;
}

export interface SimuladoAnswer {
  id: string;
  simulado_id: string;
  question_id: string;
  question_index: number;
  discipline: string;
  selected_answer: string | null;
  correct_answer: string;
  is_correct: boolean | null;
  answered_at: string | null;
}

export interface SimuladoResult {
  id: string;
  simulado_id: string;
  total_correct: number;
  total_incorrect: number;
  total_unanswered: number;
  strengths: Array<{ discipline: string; percentage: number }> | null;
  weaknesses: Array<{ discipline: string; percentage: number }> | null;
  tips: string | null;
}

export type SimuladoType = 
  | "official_day1" 
  | "official_day2" 
  | "custom_naturezas" 
  | "custom_humanas"
  | "custom_matematica"
  | "custom_mixed";

interface SimuladoConfig {
  type: SimuladoType;
  year?: string;
  questionCount: 45 | 90;
}

/**
 * Hook to manage simulados (mock exams)
 */
export const useSimulados = () => {
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSimulado, setActiveSimulado] = useState<Simulado | null>(null);

  /**
   * Fetch user's simulado history
   */
  const fetchSimulados = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("simulados")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Type assertion since we know the structure matches
      setSimulados((data as unknown as Simulado[]) || []);
    } catch (error) {
      console.error("Error fetching simulados:", error);
      toast.error("Erro ao carregar histórico de simulados");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new simulado
   */
  const createSimulado = async (config: SimuladoConfig): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return null;
      }

      // Determine duration based on type (day 1 = 330min, day 2 = 300min)
      const isDay1 = config.type === "official_day1" || 
                     config.type === "custom_humanas";
      const durationMinutes = isDay1 ? 330 : 300;

      // Generate essay topic for day 1 simulados
      let essayTopic = null;
      if (isDay1 && config.questionCount === 90) {
        try {
          const { data: topicData, error: topicError } = await supabase.functions.invoke("generate-essay-topic");
          if (!topicError && topicData) {
            essayTopic = JSON.stringify(topicData);
          }
        } catch (e) {
          console.error("Error generating essay topic:", e);
        }
      }

      const { data, error } = await supabase
        .from("simulados")
        .insert({
          user_id: user.id,
          type: config.type,
          year: config.year || null,
          total_questions: config.questionCount,
          duration_minutes: durationMinutes,
          status: "in_progress",
          essay_topic: essayTopic
        })
        .select()
        .single();

      if (error) throw error;

      return data?.id || null;
    } catch (error) {
      console.error("Error creating simulado:", error);
      toast.error("Erro ao criar simulado");
      return null;
    }
  };

  /**
   * Get a specific simulado by ID
   */
  const getSimulado = async (simuladoId: string): Promise<Simulado | null> => {
    try {
      const { data, error } = await supabase
        .from("simulados")
        .select("*")
        .eq("id", simuladoId)
        .single();

      if (error) throw error;
      return data as unknown as Simulado;
    } catch (error) {
      console.error("Error fetching simulado:", error);
      return null;
    }
  };

  /**
   * Get simulado answers
   */
  const getSimuladoAnswers = async (simuladoId: string): Promise<SimuladoAnswer[]> => {
    try {
      const { data, error } = await supabase
        .from("simulado_answers")
        .select("*")
        .eq("simulado_id", simuladoId)
        .order("question_index", { ascending: true });

      if (error) throw error;
      return (data as unknown as SimuladoAnswer[]) || [];
    } catch (error) {
      console.error("Error fetching simulado answers:", error);
      return [];
    }
  };

  /**
   * Save an answer to a question
   */
  const saveAnswer = async (
    simuladoId: string,
    questionId: string,
    questionIndex: number,
    discipline: string,
    selectedAnswer: string,
    correctAnswer: string
  ): Promise<boolean> => {
    try {
      const isCorrect = selectedAnswer === correctAnswer;

      const { error } = await supabase
        .from("simulado_answers")
        .upsert({
          simulado_id: simuladoId,
          question_id: questionId,
          question_index: questionIndex,
          discipline: discipline,
          selected_answer: selectedAnswer,
          correct_answer: correctAnswer,
          is_correct: isCorrect,
          answered_at: new Date().toISOString()
        }, { 
          onConflict: "simulado_id,question_index",
          ignoreDuplicates: false
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error saving answer:", error);
      return false;
    }
  };

  /**
   * Initialize questions for a simulado
   */
  const initializeQuestions = async (
    simuladoId: string,
    questions: Array<{ id: string; discipline: string; correct_alternative: string }>
  ): Promise<boolean> => {
    try {
      const answers = questions.map((q, index) => ({
        simulado_id: simuladoId,
        question_id: q.id,
        question_index: index,
        discipline: q.discipline,
        correct_answer: q.correct_alternative,
        selected_answer: null,
        is_correct: null
      }));

      const { error } = await supabase
        .from("simulado_answers")
        .insert(answers);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error initializing questions:", error);
      return false;
    }
  };

  /**
   * Finish a simulado
   */
  const finishSimulado = async (simuladoId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("simulados")
        .update({
          status: "completed",
          finished_at: new Date().toISOString()
        })
        .eq("id", simuladoId);

      if (error) throw error;

      // Trigger analysis
      await supabase.functions.invoke("analyze-simulado", {
        body: { simuladoId }
      });

      return true;
    } catch (error) {
      console.error("Error finishing simulado:", error);
      return false;
    }
  };

  /**
   * Abandon a simulado
   */
  const abandonSimulado = async (simuladoId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("simulados")
        .update({
          status: "abandoned",
          finished_at: new Date().toISOString()
        })
        .eq("id", simuladoId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error abandoning simulado:", error);
      return false;
    }
  };

  /**
   * Get simulado results
   */
  const getSimuladoResults = async (simuladoId: string): Promise<SimuladoResult | null> => {
    try {
      const { data, error } = await supabase
        .from("simulado_results")
        .select("*")
        .eq("simulado_id", simuladoId)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as SimuladoResult;
    } catch (error) {
      console.error("Error fetching simulado results:", error);
      return null;
    }
  };

  useEffect(() => {
    fetchSimulados();
  }, [fetchSimulados]);

  return {
    simulados,
    loading,
    activeSimulado,
    setActiveSimulado,
    fetchSimulados,
    createSimulado,
    getSimulado,
    getSimuladoAnswers,
    saveAnswer,
    initializeQuestions,
    finishSimulado,
    abandonSimulado,
    getSimuladoResults
  };
};
