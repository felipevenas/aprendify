import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Check, Sparkles, Sliders, Edit3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface DailyGoalProgressProps {
  userId?: string;
  compact?: boolean;
}

const PRESET_GOALS = [5, 10, 15, 20, 30, 45];

/**
 * Componente de progresso de meta diária com personalização e persistência
 */
const DailyGoalProgress = ({ userId, compact = false }: DailyGoalProgressProps) => {
  const [questionsToday, setQuestionsToday] = useState(0);
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    if (userId) {
      const saved = localStorage.getItem(`aprendify_daily_goal_${userId}`);
      if (saved) return parseInt(saved, 10);
    }
    return 10;
  });
  const [tempGoal, setTempGoal] = useState<number>(dailyGoal);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const progress = Math.min((questionsToday / dailyGoal) * 100, 100);
  const isCompleted = questionsToday >= dailyGoal;

  useEffect(() => {
    if (!userId) return;

    // Carrega meta salva caso o userId mude
    const saved = localStorage.getItem(`aprendify_daily_goal_${userId}`);
    if (saved) {
      const parsed = parseInt(saved, 10);
      setDailyGoal(parsed);
      setTempGoal(parsed);
    } else {
      // Tenta buscar do metadata do Supabase
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.user_metadata?.daily_goal) {
          const metaGoal = parseInt(user.user_metadata.daily_goal, 10);
          setDailyGoal(metaGoal);
          setTempGoal(metaGoal);
          localStorage.setItem(`aprendify_daily_goal_${userId}`, String(metaGoal));
        }
      });
    }

    const fetchProgress = async () => {
      const { data: streakData } = await supabase
        .from("user_streaks")
        .select("questions_today")
        .eq("user_id", userId)
        .maybeSingle();

      const today = streakData?.questions_today || 0;
      
      if (today >= dailyGoal && questionsToday < dailyGoal && questionsToday > 0) {
        setJustCompleted(true);
        celebrateGoalCompletion();
      }

      setQuestionsToday(today);
    };

    fetchProgress();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("daily_goal_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_streaks",
        },
        () => {
          fetchProgress();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, dailyGoal, questionsToday]);

  const celebrateGoalCompletion = () => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      colors: ["#22c55e", "#10b981", "#34d399", "#6ee7b7"],
    });

    toast.success("🎉 Meta diária alcançada! Parabéns pelo foco hoje!");
  };

  const handleSaveGoal = async () => {
    setDailyGoal(tempGoal);
    setDialogOpen(false);

    if (userId) {
      localStorage.setItem(`aprendify_daily_goal_${userId}`, String(tempGoal));
      // Tenta persistir no Supabase auth metadata silenciosamente
      try {
        await supabase.auth.updateUser({
          data: { daily_goal: tempGoal }
        });
      } catch (err) {
        console.warn("Não foi possível salvar meta no user_metadata:", err);
      }
    }

    toast.success(`Meta diária atualizada para ${tempGoal} questões/dia!`);
  };

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2"
      >
        <Target className="h-4 w-4 text-primary" />
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
          <motion.div
            className={`h-full rounded-full ${isCompleted ? "bg-green-500" : "bg-primary"}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {questionsToday}/{dailyGoal}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 shadow-sm"
    >
      {/* Background glow when completed */}
      <AnimatePresence>
        {isCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-500/5"
          />
        )}
      </AnimatePresence>

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isCompleted ? "bg-green-500/10" : "bg-primary/10"}`}>
              {isCompleted ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                >
                  <Check className="h-5 w-5 text-green-500" />
                </motion.div>
              ) : (
                <Target className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Meta Diária</h3>
              <p className="text-xs text-muted-foreground">
                {isCompleted ? "Concluída com sucesso! 🎉" : `${questionsToday} de ${dailyGoal} questões resolvidas`}
              </p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (open) setTempGoal(dailyGoal);
            setDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                title="Ajustar Meta Diária"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ajustar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Target className="w-5 h-5 text-primary" />
                  Personalizar Meta Diária
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Defina quantas questões do ENEM você deseja resolver todos os dias para manter seu ritmo de estudos.
                </DialogDescription>
              </DialogHeader>

              <div className="py-5 space-y-5">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
                  <span className="text-xs font-semibold text-muted-foreground">Sua meta diária:</span>
                  <div className="text-right">
                    <span className="text-2xl font-bold font-mono text-primary">{tempGoal}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">questões/dia</span>
                  </div>
                </div>

                {/* Slider */}
                <div className="space-y-2">
                  <Slider
                    value={[tempGoal]}
                    onValueChange={([value]) => setTempGoal(value)}
                    min={1}
                    max={60}
                    step={1}
                    className="py-1"
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                    <span>1 questão</span>
                    <span>30 questões</span>
                    <span>60 questões</span>
                  </div>
                </div>

                {/* Presets Rápidos */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Sugestões Rápidas:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_GOALS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTempGoal(preset)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                          tempGoal === preset
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background hover:bg-muted text-muted-foreground border-border/60"
                        }`}
                      >
                        {preset} questões
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveGoal}>
                  Salvar Meta
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Barra de Progresso */}
        <div className="relative">
          <Progress value={progress} className="h-2.5 rounded-full" />
          
          {/* Sparkle effect on completion */}
          <AnimatePresence>
            {justCompleted && (
              <motion.div
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 0, scale: 2 }}
                exit={{ opacity: 0 }}
                onAnimationComplete={() => setJustCompleted(false)}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Sparkles className="h-6 w-6 text-green-500" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Texto Motivacional */}
        <motion.p
          key={isCompleted ? "completed" : "progress"}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-muted-foreground mt-3 text-center"
        >
          {isCompleted
            ? "Excelente! Meta batida. Quer continuar ou fazer uma pausa?"
            : questionsToday === 0
            ? "Inicie sua sessão e atinja a meta hoje!"
            : `Faltam ${dailyGoal - questionsToday} questão${dailyGoal - questionsToday > 1 ? "ões" : ""} para atingir a meta.`}
        </motion.p>
      </div>
    </motion.div>
  );
};

export default DailyGoalProgress;
