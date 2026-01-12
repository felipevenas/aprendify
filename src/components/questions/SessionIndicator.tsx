import { motion } from "framer-motion";
import { Flame, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionIndicatorProps {
  sessionCount: number;
  currentStreak: number;
  streakCompletedToday: boolean;
}

/**
 * Indicador de sessão atual e mini-streak para a tela de questões
 * Mostra quantas questões foram respondidas na sessão atual e o streak
 */
const SessionIndicator = ({
  sessionCount,
  currentStreak,
  streakCompletedToday,
}: SessionIndicatorProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 bg-card/80 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 shadow-sm"
    >
      {/* Contador de sessão */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-full bg-primary/10">
          <Target className="h-4 w-4 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground leading-none">Sessão</span>
          <span className="text-sm font-bold text-foreground">{sessionCount}</span>
        </div>
      </div>

      {/* Divisor */}
      <div className="h-8 w-px bg-border/50" />

      {/* Mini streak */}
      <div className="flex items-center gap-2">
        <motion.div
          animate={streakCompletedToday ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          className={cn(
            "p-1.5 rounded-full",
            streakCompletedToday ? "bg-orange-500/10" : "bg-muted"
          )}
        >
          <Flame
            className={cn(
              "h-4 w-4",
              streakCompletedToday ? "text-orange-500" : "text-muted-foreground"
            )}
          />
        </motion.div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground leading-none">Streak</span>
            {streakCompletedToday && (
              <Zap className="h-3 w-3 text-green-500" />
            )}
          </div>
          <span className="text-sm font-bold text-foreground flex items-center gap-1">
            {currentStreak}
            {currentStreak >= 7 && <span className="text-xs">🔥</span>}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default SessionIndicator;
