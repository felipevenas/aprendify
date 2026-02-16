import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Coffee, Flame, Target, Zap, Sparkles, ArrowRight, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  userName: string;
  userId?: string;
}

interface UserStats {
  questionsToday: number;
  currentStreak: number;
  streakCompletedToday: boolean;
  weeklyAccuracy: number;
  totalQuestions: number;
}

const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
};

const getGreeting = (time: string) => {
  switch (time) {
    case "morning": return { text: "Bom dia", icon: Sun };
    case "afternoon": return { text: "Boa tarde", icon: Coffee };
    default: return { text: "Boa noite", icon: Moon };
  }
};

const DashboardHeader = ({ userName, userId }: DashboardHeaderProps) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats>({
    questionsToday: 0,
    currentStreak: 0,
    streakCompletedToday: false,
    weeklyAccuracy: 0,
    totalQuestions: 0,
  });

  const greeting = getGreeting(getTimeOfDay());
  const GreetingIcon = greeting.icon;

  useEffect(() => {
    if (!userId) return;
    const fetchStats = async () => {
      const [streakRes, attemptsRes, totalRes] = await Promise.all([
        supabase.from("user_streaks").select("current_streak, questions_today, streak_completed_today").eq("user_id", userId).maybeSingle(),
        supabase.from("question_attempts").select("is_correct").eq("user_id", userId).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from("question_attempts").select("*", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      const attempts = attemptsRes.data || [];
      const correct = attempts.filter(a => a.is_correct).length;

      setStats({
        questionsToday: streakRes.data?.questions_today || 0,
        currentStreak: streakRes.data?.current_streak || 0,
        streakCompletedToday: streakRes.data?.streak_completed_today || false,
        weeklyAccuracy: attempts.length > 0 ? Math.round((correct / attempts.length) * 100) : 0,
        totalQuestions: totalRes.count || 0,
      });
    };
    fetchStats();
  }, [userId]);

  return (
    <div className="mb-8">
      {/* Top row: greeting + CTA */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 mb-2"
          >
            <div className="p-1 rounded-md bg-primary/10">
              <GreetingIcon className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs font-medium text-primary uppercase tracking-wider">
              {greeting.text}
            </span>
            {stats.currentStreak > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 ml-1">
                <Flame className={`h-3 w-3 ${stats.streakCompletedToday ? "text-orange-500" : "text-orange-400/60"}`} />
                <span className={`text-[11px] font-bold ${stats.streakCompletedToday ? "text-orange-500" : "text-orange-400/60"}`}>
                  {stats.currentStreak} dias
                </span>
              </div>
            )}
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight"
          >
            Olá, <span className="text-gradient">{userName}</span>
          </motion.h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Button
            onClick={() => navigate("/questions")}
            size="lg"
            className="gap-2 shadow-lg shadow-primary/20 group"
          >
            <Brain className="h-4 w-4" />
            <span>Praticar Questões</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </motion.div>
      </div>

      {/* Stats chips */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap items-center gap-2"
      >
        <StatChip
          icon={<Target className="h-3.5 w-3.5 text-primary" />}
          label="Hoje"
          value={`${stats.questionsToday}`}
          sub="questões"
          completed={stats.streakCompletedToday}
        />
        <StatChip
          icon={<Sparkles className="h-3.5 w-3.5 text-green-500" />}
          label="Acerto"
          value={`${stats.weeklyAccuracy}%`}
          sub="semana"
          highlight={stats.weeklyAccuracy >= 70}
        />
        <StatChip
          icon={<Zap className="h-3.5 w-3.5 text-purple-500" />}
          label="Total"
          value={stats.totalQuestions.toLocaleString()}
          sub="resolvidas"
        />
      </motion.div>
    </div>
  );
};

const StatChip = ({
  icon,
  label,
  value,
  sub,
  completed,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  completed?: boolean;
  highlight?: boolean;
}) => (
  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border/50 shadow-sm">
    {icon}
    <div className="flex items-baseline gap-1">
      <span className={`text-sm font-bold ${highlight ? "text-green-500" : "text-foreground"}`}>{value}</span>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </div>
    {completed && (
      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
    )}
  </div>
);

export default DashboardHeader;
