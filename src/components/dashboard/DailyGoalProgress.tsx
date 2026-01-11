import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Check, Sparkles, Settings } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

interface DailyGoalProgressProps {
  userId?: string;
  compact?: boolean;
}

/**
 * Componente de progresso de meta diária com celebração
 */
const DailyGoalProgress = ({ userId, compact = false }: DailyGoalProgressProps) => {
  const [questionsToday, setQuestionsToday] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(10);
  const [tempGoal, setTempGoal] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasCompletedToday, setHasCompletedToday] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const progress = Math.min((questionsToday / dailyGoal) * 100, 100);
  const isCompleted = questionsToday >= dailyGoal;

  useEffect(() => {
    if (!userId) return;

    const fetchProgress = async () => {
      // Fetch streak data for today's count
      const { data: streakData } = await supabase
        .from("user_streaks")
        .select("questions_today")
        .eq("user_id", userId)
        .maybeSingle();

      const today = streakData?.questions_today || 0;
      
      // Check if we just completed the goal
      if (today >= dailyGoal && questionsToday < dailyGoal && questionsToday > 0) {
        setJustCompleted(true);
        celebrateGoalCompletion();
      }

      setQuestionsToday(today);
      setHasCompletedToday(today >= dailyGoal);
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
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#22c55e", "#10b981", "#34d399", "#6ee7b7"],
    });

    toast({
      title: "🎉 Meta diária alcançada!",
      description: "Parabéns! Você completou sua meta de hoje!",
    });
  };

  const handleSaveGoal = () => {
    setDailyGoal(tempGoal);
    setDialogOpen(false);
    toast({
      title: "Meta atualizada!",
      description: `Sua nova meta é ${tempGoal} questões por dia.`,
    });
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
      className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-5"
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
              <h3 className="font-semibold text-foreground">Meta Diária</h3>
              <p className="text-sm text-muted-foreground">
                {isCompleted ? "Concluída! 🎉" : `${questionsToday} de ${dailyGoal} questões`}
              </p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Definir Meta Diária</DialogTitle>
                <DialogDescription>
                  Escolha quantas questões você quer responder por dia.
                </DialogDescription>
              </DialogHeader>
              <div className="py-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">Questões por dia:</span>
                  <span className="text-2xl font-bold text-primary">{tempGoal}</span>
                </div>
                <Slider
                  value={[tempGoal]}
                  onValueChange={([value]) => setTempGoal(value)}
                  min={1}
                  max={50}
                  step={1}
                  className="mb-4"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>50</span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveGoal}>
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <Progress value={progress} className="h-3" />
          
          {/* Sparkle effect on completion */}
          <AnimatePresence>
            {justCompleted && (
              <motion.div
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity: 0, scale: 2 }}
                exit={{ opacity: 0 }}
                onAnimationComplete={() => setJustCompleted(false)}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Sparkles className="h-6 w-6 text-green-500" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Motivational text */}
        <motion.p
          key={isCompleted ? "completed" : "progress"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-muted-foreground mt-3 text-center"
        >
          {isCompleted
            ? "Incrível! Você pode continuar praticando ou descansar."
            : questionsToday === 0
            ? "Comece sua sessão de estudos!"
            : `Faltam apenas ${dailyGoal - questionsToday} questões!`}
        </motion.p>
      </div>
    </motion.div>
  );
};

export default DailyGoalProgress;
