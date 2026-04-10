import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

export type AchievementType =
  | "first_question"
  | "dedicated_7_days"
  | "century_100"
  | "expert_matematica"
  | "expert_linguagens"
  | "expert_ciencias_natureza"
  | "expert_ciencias_humanas"
  | "perfect_essay"
  | "streak_master_30"
  | "speed_demon"
  | "night_owl"
  | "early_bird"
  | "simulado_complete"
  | "flashcard_master";

export interface Achievement {
  id: string;
  type: AchievementType;
  name: string;
  description: string;
  icon: string;
  color: string;
  requirement: string;
  unlocked: boolean;
  unlockedAt?: string;
}

const ACHIEVEMENT_DEFINITIONS: Record<AchievementType, Omit<Achievement, "id" | "unlocked" | "unlockedAt">> = {
  first_question: {
    type: "first_question",
    name: "Primeiro Passo",
    description: "Respondeu sua primeira questão",
    icon: "🎯",
    color: "from-blue-400 to-blue-600",
    requirement: "Responder 1 questão",
  },
  dedicated_7_days: {
    type: "dedicated_7_days",
    name: "Dedicado",
    description: "7 dias consecutivos de estudo",
    icon: "🔥",
    color: "from-orange-400 to-red-500",
    requirement: "Manter streak de 7 dias",
  },
  century_100: {
    type: "century_100",
    name: "Centurião",
    description: "100 questões respondidas",
    icon: "💯",
    color: "from-purple-400 to-purple-600",
    requirement: "Responder 100 questões",
  },
  expert_matematica: {
    type: "expert_matematica",
    name: "Expert em Matemática",
    description: "50 acertos em Matemática",
    icon: "🧮",
    color: "from-emerald-400 to-emerald-600",
    requirement: "50 acertos em Matemática",
  },
  expert_linguagens: {
    type: "expert_linguagens",
    name: "Mestre das Palavras",
    description: "50 acertos em Linguagens",
    icon: "📚",
    color: "from-pink-400 to-pink-600",
    requirement: "50 acertos em Linguagens",
  },
  expert_ciencias_natureza: {
    type: "expert_ciencias_natureza",
    name: "Cientista Natural",
    description: "50 acertos em Ciências da Natureza",
    icon: "🔬",
    color: "from-cyan-400 to-cyan-600",
    requirement: "50 acertos em Ciências da Natureza",
  },
  expert_ciencias_humanas: {
    type: "expert_ciencias_humanas",
    name: "Historiador",
    description: "50 acertos em Ciências Humanas",
    icon: "🌍",
    color: "from-amber-400 to-amber-600",
    requirement: "50 acertos em Ciências Humanas",
  },
  perfect_essay: {
    type: "perfect_essay",
    name: "Redação Perfeita",
    description: "Nota 1000 na redação",
    icon: "✍️",
    color: "from-yellow-400 to-yellow-600",
    requirement: "Tirar 1000 em uma redação",
  },
  streak_master_30: {
    type: "streak_master_30",
    name: "Mestre do Streak",
    description: "30 dias consecutivos",
    icon: "👑",
    color: "from-yellow-500 to-amber-500",
    requirement: "Manter streak de 30 dias",
  },
  speed_demon: {
    type: "speed_demon",
    name: "Veloz",
    description: "Completou um simulado",
    icon: "⚡",
    color: "from-indigo-400 to-indigo-600",
    requirement: "Completar um simulado",
  },
  night_owl: {
    type: "night_owl",
    name: "Coruja Noturna",
    description: "Estudou após meia-noite",
    icon: "🦉",
    color: "from-slate-500 to-slate-700",
    requirement: "Responder questão após 00:00",
  },
  early_bird: {
    type: "early_bird",
    name: "Madrugador",
    description: "Estudou antes das 6h",
    icon: "🌅",
    color: "from-rose-400 to-orange-400",
    requirement: "Responder questão antes das 6h",
  },
  simulado_complete: {
    type: "simulado_complete",
    name: "Simulador",
    description: "Completou seu primeiro simulado",
    icon: "📝",
    color: "from-teal-400 to-teal-600",
    requirement: "Completar um simulado",
  },
  flashcard_master: {
    type: "flashcard_master",
    name: "Mestre dos Cards",
    description: "Criou 50 flashcards",
    icon: "🃏",
    color: "from-violet-400 to-violet-600",
    requirement: "Criar 50 flashcards",
  },
};

export const useAchievements = (userId?: string) => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement | null>(null);

  const fetchAchievements = useCallback(async () => {
    if (!userId) return;

    try {
      const { data: unlockedData, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;

      const unlockedTypes = new Set(unlockedData?.map((a) => a.achievement_type) || []);

      const allAchievements: Achievement[] = Object.values(ACHIEVEMENT_DEFINITIONS).map((def) => ({
        ...def,
        id: def.type,
        unlocked: unlockedTypes.has(def.type),
        unlockedAt: unlockedData?.find((a) => a.achievement_type === def.type)?.unlocked_at,
      }));

      setAchievements(allAchievements);
    } catch (error) {
      console.error("Error fetching achievements:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const unlockAchievement = useCallback(
    async (type: AchievementType) => {
      if (!userId) return false;

      // Check if already unlocked
      const existing = achievements.find((a) => a.type === type);
      if (existing?.unlocked) return false;

      try {
        const { data: unlocked, error } = await supabase.rpc("unlock_achievement", {
          _user_id: userId,
          _achievement_type: type,
        });

        if (error) {
          console.error("Error unlocking achievement:", error);
          return false;
        }

        if (!unlocked) return false;

        const achievement = ACHIEVEMENT_DEFINITIONS[type];

        // Celebrate!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#FFD700", "#FFA500", "#FF6347"],
        });

        toast({
          title: `🏆 Conquista Desbloqueada!`,
          description: `${achievement.icon} ${achievement.name}`,
        });

        const unlockedAchievement: Achievement = {
          ...achievement,
          id: type,
          unlocked: true,
          unlockedAt: new Date().toISOString(),
        };

        setNewlyUnlocked(unlockedAchievement);
        setTimeout(() => setNewlyUnlocked(null), 5000);

        // Refresh achievements
        await fetchAchievements();

        return true;
      } catch (error) {
        console.error("Error unlocking achievement:", error);
        return false;
      }
    },
    [userId, achievements, fetchAchievements]
  );

  const checkAndUnlockAchievements = useCallback(async () => {
    if (!userId) return;

    try {
      // Check total questions answered
      const { count: totalQuestions } = await supabase
        .from("question_attempts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (totalQuestions && totalQuestions >= 1) {
        await unlockAchievement("first_question");
      }

      if (totalQuestions && totalQuestions >= 100) {
        await unlockAchievement("century_100");
      }

      // Check streak
      const { data: streakData } = await supabase
        .from("user_streaks")
        .select("current_streak, longest_streak")
        .eq("user_id", userId)
        .maybeSingle();

      if (streakData) {
        if (streakData.longest_streak >= 7 || streakData.current_streak >= 7) {
          await unlockAchievement("dedicated_7_days");
        }
        if (streakData.longest_streak >= 30 || streakData.current_streak >= 30) {
          await unlockAchievement("streak_master_30");
        }
      }

      // Check discipline experts
      const disciplines = [
        { name: "Matemática", type: "expert_matematica" as AchievementType },
        { name: "Linguagens", type: "expert_linguagens" as AchievementType },
        { name: "Ciências da Natureza", type: "expert_ciencias_natureza" as AchievementType },
        { name: "Ciências Humanas", type: "expert_ciencias_humanas" as AchievementType },
      ];

      for (const disc of disciplines) {
        const { count } = await supabase
          .from("question_attempts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_correct", true)
          .ilike("discipline", `%${disc.name}%`);

        if (count && count >= 50) {
          await unlockAchievement(disc.type);
        }
      }

      // Check perfect essay
      const { data: essays } = await supabase
        .from("essays")
        .select("score_total")
        .eq("user_id", userId)
        .eq("score_total", 1000)
        .limit(1);

      if (essays && essays.length > 0) {
        await unlockAchievement("perfect_essay");
      }

      // Check simulado complete
      const { data: simulados } = await supabase
        .from("simulados")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "completed")
        .limit(1);

      if (simulados && simulados.length > 0) {
        await unlockAchievement("simulado_complete");
      }

      // Check flashcard master
      const { count: flashcardCount } = await supabase
        .from("flashcards")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (flashcardCount && flashcardCount >= 50) {
        await unlockAchievement("flashcard_master");
      }

      // Check time-based achievements
      const currentHour = new Date().getHours();
      const { count: recentQuestions } = await supabase
        .from("question_attempts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 60000).toISOString()); // Last minute

      if (recentQuestions && recentQuestions > 0) {
        if (currentHour >= 0 && currentHour < 5) {
          await unlockAchievement("night_owl");
        }
        if (currentHour >= 4 && currentHour < 6) {
          await unlockAchievement("early_bird");
        }
      }
    } catch (error) {
      console.error("Error checking achievements:", error);
    }
  }, [userId, unlockAchievement]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  // Check achievements on mount and periodically
  useEffect(() => {
    if (!loading && userId) {
      checkAndUnlockAchievements();
    }
  }, [loading, userId, checkAndUnlockAchievements]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  return {
    achievements,
    loading,
    unlockedCount,
    totalCount,
    newlyUnlocked,
    unlockAchievement,
    checkAndUnlockAchievements,
    refreshAchievements: fetchAchievements,
  };
};

export default useAchievements;
