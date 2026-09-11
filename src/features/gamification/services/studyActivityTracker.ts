import { supabase } from "@/integrations/supabase/client";

export interface DayStudyBreakdown {
  total: number;
  questions: number;
  essays: number;
  flashcards: number;
  simulados: number;
}

export type StudyActivityMap = Record<string, DayStudyBreakdown>;

const STORAGE_KEY_PREFIX = "aprendify_study_actions_";

export const studyActivityTracker = {
  /**
   * Registra uma ação de estudo localmente para efeito imediato
   */
  recordAction: (userId: string, type: "question" | "essay" | "flashcard" | "simulado") => {
    try {
      if (!userId) return;
      const today = new Date().toISOString().split("T")[0];
      const key = `${STORAGE_KEY_PREFIX}${userId}`;
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      
      if (!saved[today]) {
        saved[today] = { total: 0, questions: 0, essays: 0, flashcards: 0, simulados: 0 };
      }
      
      saved[today].total = (saved[today].total || 0) + 1;
      if (type === "question") saved[today].questions = (saved[today].questions || 0) + 1;
      if (type === "essay") saved[today].essays = (saved[today].essays || 0) + 1;
      if (type === "flashcard") saved[today].flashcards = (saved[today].flashcards || 0) + 1;
      if (type === "simulado") saved[today].simulados = (saved[today].simulados || 0) + 1;

      localStorage.setItem(key, JSON.stringify(saved));
    } catch (e) {
      console.warn("[StudyActivityTracker] Erro ao salvar atividade local:", e);
    }
  },

  /**
   * Consolida todas as atividades de estudo do usuário (questões, redações, simulados, flashcards)
   * Qualquer ação a partir de 1 já valida o dia como ativo!
   */
  fetchUserActivity: async (userId: string, daysCount: number = 365): Promise<StudyActivityMap> => {
    const activityMap: StudyActivityMap = {};

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount);
    startDate.setHours(0, 0, 0, 0);
    const startIso = startDate.toISOString();

    const ensureDay = (dateStr: string): DayStudyBreakdown => {
      if (!activityMap[dateStr]) {
        activityMap[dateStr] = {
          total: 0,
          questions: 0,
          essays: 0,
          flashcards: 0,
          simulados: 0,
        };
      }
      return activityMap[dateStr];
    };

    try {
      // 1. Buscar tentativas de questões no Supabase
      const [questionsRes, essaysRes, simuladosRes, flashcardsRes] = await Promise.all([
        supabase
          .from("question_attempts")
          .select("created_at")
          .eq("user_id", userId)
          .gte("created_at", startIso),
        supabase
          .from("essays")
          .select("created_at")
          .eq("user_id", userId)
          .gte("created_at", startIso),
        supabase
          .from("simulados")
          .select("created_at, completed_at")
          .eq("user_id", userId)
          .gte("created_at", startIso),
        supabase
          .from("flashcards")
          .select("created_at, updated_at")
          .eq("user_id", userId)
          .gte("created_at", startIso),
      ]);

      // Mapear questões
      (questionsRes.data || []).forEach((row) => {
        const d = new Date(row.created_at).toISOString().split("T")[0];
        const day = ensureDay(d);
        day.questions += 1;
        day.total += 1;
      });

      // Mapear redações
      (essaysRes.data || []).forEach((row) => {
        const d = new Date(row.created_at).toISOString().split("T")[0];
        const day = ensureDay(d);
        day.essays += 1;
        day.total += 1;
      });

      // Mapear simulados
      (simuladosRes.data || []).forEach((row) => {
        const targetDate = row.completed_at || row.created_at;
        const d = new Date(targetDate).toISOString().split("T")[0];
        const day = ensureDay(d);
        day.simulados += 1;
        day.total += 1;
      });

      // Mapear flashcards criados/atualizados
      (flashcardsRes.data || []).forEach((row) => {
        const d = new Date(row.created_at).toISOString().split("T")[0];
        const day = ensureDay(d);
        day.flashcards += 1;
        day.total += 1;
      });

      // 2. Mesclar com histórico local de leituras de flashcards e interações
      try {
        const key = `${STORAGE_KEY_PREFIX}${userId}`;
        const localSaved: StudyActivityMap = JSON.parse(localStorage.getItem(key) || "{}");
        Object.entries(localSaved).forEach(([dateStr, counts]) => {
          const day = ensureDay(dateStr);
          // Se o banco ainda não tinha registrado ou para flashcards lidos
          if (counts.flashcards && counts.flashcards > day.flashcards) {
            const diff = counts.flashcards - day.flashcards;
            day.flashcards += diff;
            day.total += diff;
          }
          if (counts.questions && counts.questions > day.questions) {
            const diff = counts.questions - day.questions;
            day.questions += diff;
            day.total += diff;
          }
        });
      } catch (storageErr) {
        console.warn("[StudyActivityTracker] Erro ao ler localStorage:", storageErr);
      }
    } catch (err) {
      console.error("[StudyActivityTracker] Erro ao consolidar atividades de estudo:", err);
    }

    return activityMap;
  },
};
