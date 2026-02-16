import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Flame, TrendingUp, Trophy, Target, Clock, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface TodayOverviewProps {
  userId?: string;
}

interface TodayData {
  questionsToday: number;
  correctToday: number;
  currentStreak: number;
  streakCompleted: boolean;
  weeklyAccuracy: number;
  studyMinutes: number;
  nextAchievement: { name: string; progress: number; total: number } | null;
}

const TodayOverview = ({ userId }: TodayOverviewProps) => {
  const [data, setData] = useState<TodayData>({
    questionsToday: 0,
    correctToday: 0,
    currentStreak: 0,
    streakCompleted: false,
    weeklyAccuracy: 0,
    studyMinutes: 0,
    nextAchievement: null,
  });
  const [loading, setLoading] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(5);
  const [tempGoal, setTempGoal] = useState(5);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("dailyQuestionGoal");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) {
        setDailyGoal(parsed);
        setTempGoal(parsed);
      }
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    const fetch = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const oneWeekAgo = new Date(Date.now() - 7 * 86400000);

      const [streakRes, todayRes, weeklyRes, totalRes, achieveRes] = await Promise.all([
        supabase.from("user_streaks").select("current_streak, questions_today, streak_completed_today").eq("user_id", userId).maybeSingle(),
        supabase.from("question_attempts").select("is_correct").eq("user_id", userId).gte("created_at", todayStart.toISOString()),
        supabase.from("question_attempts").select("is_correct").eq("user_id", userId).gte("created_at", oneWeekAgo.toISOString()),
        supabase.from("question_attempts").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("achievements").select("achievement_type").eq("user_id", userId),
      ]);

      const todayAttempts = todayRes.data || [];
      const weeklyAttempts = weeklyRes.data || [];
      const correctWeekly = weeklyAttempts.filter((a) => a.is_correct).length;
      const correctToday = todayAttempts.filter((a) => a.is_correct).length;

      const totalQ = totalRes.count || 0;
      const streak = streakRes.data?.current_streak || 0;
      const unlockedTypes = new Set((achieveRes.data || []).map((a) => a.achievement_type));

      let nextAchievement = null;
      if (!unlockedTypes.has("first_question") && totalQ < 1) {
        nextAchievement = { name: "Primeira Questão", progress: totalQ, total: 1 };
      } else if (!unlockedTypes.has("dedicated_7_days") && streak < 7) {
        nextAchievement = { name: "7 dias seguidos", progress: streak, total: 7 };
      } else if (!unlockedTypes.has("century_100_questions") && totalQ < 100) {
        nextAchievement = { name: "100 questões", progress: totalQ, total: 100 };
      } else if (!unlockedTypes.has("dedicated_30_days") && streak < 30) {
        nextAchievement = { name: "30 dias seguidos", progress: streak, total: 30 };
      } else if (!unlockedTypes.has("master_500_questions") && totalQ < 500) {
        nextAchievement = { name: "500 questões", progress: totalQ, total: 500 };
      }

      setData({
        questionsToday: streakRes.data?.questions_today || 0,
        correctToday,
        currentStreak: streak,
        streakCompleted: streakRes.data?.streak_completed_today || false,
        weeklyAccuracy: weeklyAttempts.length > 0 ? Math.round((correctWeekly / weeklyAttempts.length) * 100) : 0,
        studyMinutes: Math.round(todayAttempts.length * 2),
        nextAchievement,
      });
      setLoading(false);
    };
    fetch();
  }, [userId]);

  const handleSaveGoal = () => {
    setDailyGoal(tempGoal);
    localStorage.setItem("dailyQuestionGoal", tempGoal.toString());
    setGoalDialogOpen(false);
    toast.success(`Meta atualizada para ${tempGoal} questões!`);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-muted/50 animate-pulse rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const dailyProgress = Math.min((data.questionsToday / dailyGoal) * 100, 100);
  const todayAccuracy = data.questionsToday > 0 ? Math.round((data.correctToday / data.questionsToday) * 100) : 0;

  const metrics = [
    {
      icon: Brain,
      label: "Hoje",
      value: data.questionsToday.toString(),
      sub: (
        <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
          <DialogTrigger asChild>
            <button className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5" onClick={() => setTempGoal(dailyGoal)}>
              Meta: {dailyGoal} <Settings2 className="h-2.5 w-2.5" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Meta Diária</DialogTitle></DialogHeader>
            <div className="space-y-6 py-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">{tempGoal}</p>
                <p className="text-sm text-muted-foreground">questões por dia</p>
              </div>
              <Slider value={[tempGoal]} onValueChange={(v) => setTempGoal(v[0])} min={1} max={50} step={1} />
              <Button onClick={handleSaveGoal} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      ),
      color: "text-primary",
      bgColor: "bg-primary/10",
      progress: dailyProgress,
      progressColor: "bg-primary",
    },
    {
      icon: Flame,
      label: "Streak",
      value: data.currentStreak.toString(),
      sub: <span className="text-[11px] text-muted-foreground">{data.streakCompleted ? "✅ Ativo" : "dias seguidos"}</span>,
      color: data.streakCompleted ? "text-orange-500" : "text-orange-400/70",
      bgColor: "bg-orange-500/10",
    },
    {
      icon: TrendingUp,
      label: "Precisão",
      value: `${data.weeklyAccuracy}%`,
      sub: <span className="text-[11px] text-muted-foreground">semana</span>,
      color: data.weeklyAccuracy >= 70 ? "text-green-500" : data.weeklyAccuracy >= 50 ? "text-warning" : "text-foreground",
      bgColor: "bg-green-500/10",
      progress: data.weeklyAccuracy,
      progressColor: data.weeklyAccuracy >= 70 ? "bg-green-500" : data.weeklyAccuracy >= 50 ? "bg-warning" : "bg-muted-foreground",
    },
    {
      icon: Trophy,
      label: data.nextAchievement?.name || "Conquistas",
      value: data.nextAchievement ? `${data.nextAchievement.progress}/${data.nextAchievement.total}` : "🎉",
      sub: <span className="text-[11px] text-muted-foreground">{data.nextAchievement ? "próxima" : "Todas!"}</span>,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      progress: data.nextAchievement ? (data.nextAchievement.progress / data.nextAchievement.total) * 100 : 100,
      progressColor: "bg-purple-500",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-5">
        <CardTitle className="text-base font-semibold">Visão Geral</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div className="grid grid-cols-2 gap-2.5">
          {metrics.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative overflow-hidden rounded-xl border border-border/50 p-3 group hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn("p-1 rounded-md", m.bgColor)}>
                  <m.icon className={cn("h-3.5 w-3.5", m.color)} />
                </div>
                <span className="text-[11px] text-muted-foreground font-medium truncate">{m.label}</span>
              </div>
              <p className={cn("text-xl font-bold", m.color)}>{m.value}</p>
              {m.sub}
              {m.progress !== undefined && (
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={cn("h-full rounded-full", m.progressColor)}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(m.progress, 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TodayOverview;
