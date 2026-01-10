import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Sun, Moon, Coffee, Flame, Target, TrendingUp, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WelcomeBannerProps {
  userName: string;
  userId?: string;
}

interface UserStats {
  questionsToday: number;
  currentStreak: number;
  streakCompletedToday: boolean;
  weeklyAccuracy: number;
}

// Frases motivacionais que mudam a cada dia
const motivationalQuotes = [
  "A persistência é o caminho do êxito.",
  "Acredite em você e tudo será possível.",
  "Cada questão é um passo mais perto da aprovação.",
  "O sucesso é a soma de pequenos esforços repetidos.",
  "Hoje é o dia perfeito para superar seus limites.",
  "Sua dedicação de hoje é o resultado de amanhã.",
  "Grandes conquistas começam com pequenos passos.",
  "Não pare até se orgulhar.",
  "O conhecimento é a única coisa que ninguém pode tirar de você.",
  "Você está mais perto do que imagina.",
  "Cada erro é uma oportunidade de aprendizado.",
  "Consistência supera talento quando talento não é consistente.",
  "O futuro pertence àqueles que se preparam hoje.",
  "Sua única competição é quem você era ontem.",
];

const getTimeOfDay = (): "morning" | "afternoon" | "evening" | "night" => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
};

const getGreeting = (timeOfDay: string): { text: string; icon: typeof Sun } => {
  switch (timeOfDay) {
    case "morning":
      return { text: "Bom dia", icon: Sun };
    case "afternoon":
      return { text: "Boa tarde", icon: Coffee };
    case "evening":
      return { text: "Boa noite", icon: Moon };
    case "night":
      return { text: "Boa noite", icon: Moon };
    default:
      return { text: "Olá", icon: Sparkles };
  }
};

const getContextualMessage = (stats: UserStats, timeOfDay: string): string => {
  // Se não completou streak hoje
  if (!stats.streakCompletedToday && stats.questionsToday === 0) {
    if (timeOfDay === "morning") {
      return "Pronto para começar o dia com foco? 💪";
    } else if (timeOfDay === "afternoon") {
      return "Que tal algumas questões para manter o ritmo?";
    } else {
      return "Uma sessão rápida antes de descansar?";
    }
  }

  // Se já respondeu questões hoje mas não completou streak
  if (!stats.streakCompletedToday && stats.questionsToday > 0) {
    const remaining = 5 - stats.questionsToday;
    if (remaining > 0) {
      return `Faltam apenas ${remaining} questões para manter seu streak! 🔥`;
    }
  }

  // Se completou o streak
  if (stats.streakCompletedToday) {
    if (stats.currentStreak >= 7) {
      return `Incrível! ${stats.currentStreak} dias seguidos! Você é imparável! 🚀`;
    }
    return "Streak mantido! Continue assim! ⭐";
  }

  // Se tem boa precisão
  if (stats.weeklyAccuracy >= 80) {
    return "Sua performance está excelente! Continue assim!";
  }

  // Mensagem padrão
  return "Continue sua jornada de estudos e alcance seus objetivos!";
};

const getDailyQuote = (): string => {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  return motivationalQuotes[dayOfYear % motivationalQuotes.length];
};

export const WelcomeBanner = ({ userName, userId }: WelcomeBannerProps) => {
  const [stats, setStats] = useState<UserStats>({
    questionsToday: 0,
    currentStreak: 0,
    streakCompletedToday: false,
    weeklyAccuracy: 0,
  });
  const [showQuote, setShowQuote] = useState(false);

  const timeOfDay = getTimeOfDay();
  const greeting = getGreeting(timeOfDay);
  const GreetingIcon = greeting.icon;
  const contextualMessage = getContextualMessage(stats, timeOfDay);
  const dailyQuote = getDailyQuote();

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

        setStats({
          questionsToday: streakData?.questions_today || 0,
          currentStreak: streakData?.current_streak || 0,
          streakCompletedToday: streakData?.streak_completed_today || false,
          weeklyAccuracy,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();

    // Show quote after a short delay
    const timer = setTimeout(() => setShowQuote(true), 1500);
    return () => clearTimeout(timer);
  }, [userId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-10 sm:mb-14"
    >
      {/* Time-based greeting badge */}
      <motion.div
        className="flex items-center gap-2.5 mb-3"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <motion.div
          className="p-1.5 rounded-lg bg-primary/10"
          animate={{ 
            rotate: [0, 10, -10, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
        >
          <GreetingIcon className="h-4 w-4 text-primary" />
        </motion.div>
        <motion.span
          className="text-sm font-semibold text-primary tracking-wide"
          animate={{ opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {greeting.text}
        </motion.span>

        {/* Streak indicator inline */}
        {stats.currentStreak > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10"
          >
            <motion.div
              animate={{ 
                scale: stats.streakCompletedToday ? [1, 1.2, 1] : 1,
              }}
              transition={{ duration: 0.5, repeat: stats.streakCompletedToday ? Infinity : 0, repeatDelay: 2 }}
            >
              <Flame className={`h-3.5 w-3.5 ${stats.streakCompletedToday ? "text-orange-500" : "text-orange-400/70"}`} />
            </motion.div>
            <span className={`text-xs font-bold ${stats.streakCompletedToday ? "text-orange-500" : "text-orange-400/70"}`}>
              {stats.currentStreak}
            </span>
          </motion.div>
        )}
      </motion.div>

      {/* Main greeting */}
      <motion.h1 
        className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3 tracking-tight"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        Olá, <span className="text-gradient">{userName}</span>!
      </motion.h1>

      {/* Contextual message */}
      <motion.p 
        className="text-muted-foreground text-base sm:text-lg max-w-2xl leading-relaxed mb-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {contextualMessage}
      </motion.p>

      {/* Daily motivational quote */}
      <AnimatePresence>
        {showQuote && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2 text-sm text-muted-foreground/80 italic"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary/50 flex-shrink-0" />
            <span>"{dailyQuote}"</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick action suggestion based on context */}
      {!stats.streakCompletedToday && stats.questionsToday < 5 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-sm"
        >
          <Target className="h-3.5 w-3.5 text-primary" />
          <span className="text-muted-foreground">
            Meta diária: <span className="font-semibold text-foreground">{stats.questionsToday}/5</span> questões
          </span>
          {stats.questionsToday > 0 && (
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(stats.questionsToday / 5) * 100}%` }}
                transition={{ delay: 1, duration: 0.5 }}
              />
            </div>
          )}
        </motion.div>
      )}

      {/* Celebration for streak completion */}
      {stats.streakCompletedToday && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: "spring" }}
          className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-sm"
        >
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 0.5, repeat: 2 }}
          >
            <Zap className="h-3.5 w-3.5 text-green-500" />
          </motion.div>
          <span className="text-green-600 dark:text-green-400 font-medium">
            Meta diária concluída! 🎉
          </span>
        </motion.div>
      )}
    </motion.div>
  );
};

export default WelcomeBanner;
