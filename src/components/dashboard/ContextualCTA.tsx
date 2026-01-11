import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Flame, BookOpen, AlertTriangle, Trophy, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ContextualCTAProps {
  userId?: string;
}

type CTAType = "streak_incomplete" | "not_studied" | "review_errors" | "essay_pending" | "keep_going";

interface CTAConfig {
  type: CTAType;
  title: string;
  description: string;
  buttonText: string;
  icon: typeof Flame;
  gradient: string;
  iconColor: string;
  path: string;
}

/**
 * Card de CTA Contextual que muda baseado no comportamento do usuário
 */
const ContextualCTA = ({ userId }: ContextualCTAProps) => {
  const navigate = useNavigate();
  const [ctaConfig, setCTAConfig] = useState<CTAConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const determineCTA = async () => {
      try {
        // Fetch user stats
        const { data: streakData } = await supabase
          .from("user_streaks")
          .select("current_streak, questions_today, streak_completed_today")
          .eq("user_id", userId)
          .maybeSingle();

        const questionsToday = streakData?.questions_today || 0;
        const streakCompletedToday = streakData?.streak_completed_today || false;
        const currentStreak = streakData?.current_streak || 0;

        // Check for recent errors (yesterday)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: recentErrors, count: errorCount } = await supabase
          .from("question_attempts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_correct", false)
          .gte("created_at", yesterday.toISOString())
          .lt("created_at", today.toISOString());

        // Determine the best CTA
        let config: CTAConfig;

        if (!streakCompletedToday && questionsToday > 0) {
          // Streak incompleto mas já começou
          const remaining = 5 - questionsToday;
          config = {
            type: "streak_incomplete",
            title: "Continue seu streak! 🔥",
            description: `Faltam apenas ${remaining} questões para manter sua sequência de ${currentStreak + 1} dias!`,
            buttonText: "Continuar praticando",
            icon: Flame,
            gradient: "from-orange-500/10 to-red-500/10",
            iconColor: "text-orange-500",
            path: "/questions",
          };
        } else if (questionsToday === 0) {
          // Não estudou hoje
          const hour = new Date().getHours();
          let timeMessage = "";
          if (hour < 12) {
            timeMessage = "Comece o dia com uma sessão de estudos!";
          } else if (hour < 18) {
            timeMessage = "Que tal aproveitar a tarde para estudar?";
          } else {
            timeMessage = "Uma sessão rápida antes de descansar?";
          }
          config = {
            type: "not_studied",
            title: "Hora de praticar! 📚",
            description: timeMessage,
            buttonText: "Começar sessão",
            icon: BookOpen,
            gradient: "from-blue-500/10 to-indigo-500/10",
            iconColor: "text-blue-500",
            path: "/questions",
          };
        } else if ((errorCount || 0) > 2) {
          // Teve erros recentes
          config = {
            type: "review_errors",
            title: "Revise seus erros! 📝",
            description: `Você errou ${errorCount} questões ontem. Revisar ajuda a fixar o conteúdo!`,
            buttonText: "Ver estatísticas",
            icon: AlertTriangle,
            gradient: "from-yellow-500/10 to-amber-500/10",
            iconColor: "text-yellow-500",
            path: "/statistics",
          };
        } else if (streakCompletedToday) {
          // Já completou streak, sugerir redação ou mais questões
          config = {
            type: "keep_going",
            title: "Excelente progresso! 🏆",
            description: "Seu streak está ativo! Que tal praticar uma redação?",
            buttonText: "Praticar redação",
            icon: PenLine,
            gradient: "from-green-500/10 to-emerald-500/10",
            iconColor: "text-green-500",
            path: "/essays",
          };
        } else {
          // Fallback
          config = {
            type: "keep_going",
            title: "Continue evoluindo! 💪",
            description: "Cada questão te aproxima da aprovação!",
            buttonText: "Praticar agora",
            icon: Trophy,
            gradient: "from-purple-500/10 to-pink-500/10",
            iconColor: "text-purple-500",
            path: "/questions",
          };
        }

        setCTAConfig(config);
      } catch (error) {
        console.error("Error determining CTA:", error);
      } finally {
        setLoading(false);
      }
    };

    determineCTA();
  }, [userId]);

  if (loading || !ctaConfig) {
    return null;
  }

  const Icon = ctaConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mb-6"
    >
      <motion.div
        whileHover={{ scale: 1.01 }}
        className={`relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-r ${ctaConfig.gradient} p-5`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <motion.div
              className={`p-3 rounded-xl bg-background/80 ${ctaConfig.iconColor}`}
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Icon className="h-6 w-6" />
            </motion.div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {ctaConfig.title}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {ctaConfig.description}
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate(ctaConfig.path)}
            className="gap-2 shrink-0"
          >
            {ctaConfig.buttonText}
            <motion.div
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowRight className="h-4 w-4" />
            </motion.div>
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ContextualCTA;
