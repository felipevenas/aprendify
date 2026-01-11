import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Target, TrendingUp, Trophy, Brain, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface QuickStatsProps {
  userId?: string;
}

interface Stats {
  questionsToday: number;
  currentStreak: number;
  streakCompletedToday: boolean;
  weeklyAccuracy: number;
  nextAchievement: {
    name: string;
    progress: number;
    total: number;
  } | null;
}

/**
 * Quick Stats Row - 4 mini-cards compactos no topo do dashboard
 * Mostra: Questões Hoje, Streak, Taxa de Acerto, Próxima Conquista
 */
const QuickStats = ({ userId }: QuickStatsProps) => {
  const [stats, setStats] = useState<Stats>({
    questionsToday: 0,
    currentStreak: 0,
    streakCompletedToday: false,
    weeklyAccuracy: 0,
    nextAchievement: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchStats = async () => {
      try {
        // Fetch streak data
        const { data: streakData } = await supabase
          .from("user_streaks")
          .select("current_streak, questions_today, streak_completed_today")
          .eq("user_id", userId)
          .maybeSingle();

        // Fetch weekly accuracy
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: attemptsData } = await supabase
          .from("question_attempts")
          .select("is_correct")
          .eq("user_id", userId)
          .gte("created_at", oneWeekAgo.toISOString());

        let weeklyAccuracy = 0;
        if (attemptsData && attemptsData.length > 0) {
          const correct = attemptsData.filter((a) => a.is_correct).length;
          weeklyAccuracy = Math.round((correct / attemptsData.length) * 100);
        }

        // Fetch total questions for achievements
        const { count: totalQuestions } = await supabase
          .from("question_attempts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        // Fetch unlocked achievements
        const { data: achievements } = await supabase
          .from("achievements")
          .select("achievement_type")
          .eq("user_id", userId);

        const unlockedTypes = new Set(achievements?.map(a => a.achievement_type) || []);

        // Calculate next achievement
        let nextAchievement = null;
        const total = totalQuestions || 0;
        const streak = streakData?.current_streak || 0;

        if (!unlockedTypes.has("first_question") && total < 1) {
          nextAchievement = { name: "Primeira Questão", progress: total, total: 1 };
        } else if (!unlockedTypes.has("dedicated_7_days") && streak < 7) {
          nextAchievement = { name: "7 dias seguidos", progress: streak, total: 7 };
        } else if (!unlockedTypes.has("century_100_questions") && total < 100) {
          nextAchievement = { name: "100 questões", progress: total, total: 100 };
        } else if (!unlockedTypes.has("dedicated_30_days") && streak < 30) {
          nextAchievement = { name: "30 dias seguidos", progress: streak, total: 30 };
        } else if (!unlockedTypes.has("master_500_questions") && total < 500) {
          nextAchievement = { name: "500 questões", progress: total, total: 500 };
        }

        setStats({
          questionsToday: streakData?.questions_today || 0,
          currentStreak: streakData?.current_streak || 0,
          streakCompletedToday: streakData?.streak_completed_today || false,
          weeklyAccuracy,
          nextAchievement,
        });
      } catch (error) {
        console.error("Error fetching quick stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1 },
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  const dailyGoal = 5;
  const dailyProgress = Math.min((stats.questionsToday / dailyGoal) * 100, 100);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
    >
      {/* Questões Hoje */}
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.02, y: -2 }}
        className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 group cursor-default"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10">
            <Brain className="h-4 w-4 text-blue-500" />
          </div>
          <span className="text-xs text-muted-foreground">Meta: {dailyGoal}</span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.questionsToday}</p>
            <p className="text-xs text-muted-foreground">Hoje</p>
          </div>
          <div className="w-12 h-12">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="4"
              />
              <motion.circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={125.6}
                initial={{ strokeDashoffset: 125.6 }}
                animate={{ strokeDashoffset: 125.6 - (125.6 * dailyProgress) / 100 }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </svg>
          </div>
        </div>
      </motion.div>

      {/* Streak Atual */}
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.02, y: -2 }}
        className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 group cursor-default"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 rounded-lg bg-orange-500/10">
            <motion.div
              animate={stats.streakCompletedToday ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              <Flame className={cn("h-4 w-4", stats.streakCompletedToday ? "text-orange-500" : "text-orange-400/70")} />
            </motion.div>
          </div>
          {stats.streakCompletedToday && (
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs font-medium text-green-500 flex items-center gap-1"
            >
              <Zap className="h-3 w-3" /> Ativo
            </motion.span>
          )}
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground flex items-center gap-1">
            {stats.currentStreak}
            {stats.currentStreak >= 7 && (
              <motion.span
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
              >
                🔥
              </motion.span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">Dias de streak</p>
        </div>
      </motion.div>

      {/* Taxa de Acerto */}
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.02, y: -2 }}
        className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 group cursor-default"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 rounded-lg bg-green-500/10">
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <span className="text-xs text-muted-foreground">Semana</span>
        </div>
        <div>
          <p className={cn(
            "text-2xl font-bold",
            stats.weeklyAccuracy >= 70 ? "text-green-500" : 
            stats.weeklyAccuracy >= 50 ? "text-yellow-500" : "text-foreground"
          )}>
            {stats.weeklyAccuracy}%
          </p>
          <p className="text-xs text-muted-foreground">Taxa de acerto</p>
        </div>
        {/* Mini progress bar */}
        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              stats.weeklyAccuracy >= 70 ? "bg-green-500" : 
              stats.weeklyAccuracy >= 50 ? "bg-yellow-500" : "bg-muted-foreground"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${stats.weeklyAccuracy}%` }}
            transition={{ duration: 1, delay: 0.7 }}
          />
        </div>
      </motion.div>

      {/* Próxima Conquista */}
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.02, y: -2 }}
        className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 group cursor-default"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 rounded-lg bg-purple-500/10">
            <Trophy className="h-4 w-4 text-purple-500" />
          </div>
        </div>
        {stats.nextAchievement ? (
          <div>
            <p className="text-sm font-semibold text-foreground truncate">
              {stats.nextAchievement.name}
            </p>
            <p className="text-xs text-muted-foreground mb-1.5">
              {stats.nextAchievement.progress}/{stats.nextAchievement.total}
            </p>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-purple-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(stats.nextAchievement.progress / stats.nextAchievement.total) * 100}%` }}
                transition={{ duration: 1, delay: 0.9 }}
              />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-foreground">🎉 Todas!</p>
            <p className="text-xs text-muted-foreground">Conquistas desbloqueadas</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default QuickStats;
