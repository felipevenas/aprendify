import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SimuladoTimerProps {
  /** Total duration in minutes */
  durationMinutes: number;
  /** Start time of the simulado */
  startedAt: string;
  /** Called when time runs out */
  onTimeUp?: () => void;
}

/**
 * Collapsible timer component for simulados
 * Shows remaining time and can be minimized when not needed
 */
export const SimuladoTimer = ({ durationMinutes, startedAt, onTimeUp }: SimuladoTimerProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  /**
   * Calculate remaining time based on start time and duration
   */
  const calculateRemainingTime = useCallback(() => {
    const startTime = new Date(startedAt).getTime();
    const endTime = startTime + durationMinutes * 60 * 1000;
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
    return remaining;
  }, [durationMinutes, startedAt]);

  useEffect(() => {
    // Initialize remaining time
    setRemainingSeconds(calculateRemainingTime());

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateRemainingTime();
      setRemainingSeconds(remaining);

      if (remaining === 0 && onTimeUp) {
        onTimeUp();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemainingTime, onTimeUp]);

  /**
   * Format seconds to HH:MM:SS
   */
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Determine urgency level for styling
  const isUrgent = remainingSeconds < 1800; // Less than 30 minutes
  const isCritical = remainingSeconds < 600; // Less than 10 minutes

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "fixed top-20 right-4 z-50 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg transition-all",
        collapsed ? "p-2" : "p-4",
        isCritical && "border-red-500 bg-red-500/10",
        isUrgent && !isCritical && "border-yellow-500 bg-yellow-500/10"
      )}
    >
      <AnimatePresence mode="wait">
        {collapsed ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCollapsed(false)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <span className={cn(
              "font-mono text-sm font-medium",
              isCritical && "text-red-500",
              isUrgent && !isCritical && "text-yellow-600"
            )}>
              {formatTime(remainingSeconds)}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className={cn(
                  "h-4 w-4",
                  isCritical && "text-red-500",
                  isUrgent && !isCritical && "text-yellow-600"
                )} />
                <span className="text-sm font-medium">Tempo Restante</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setCollapsed(true)}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>

            <div className={cn(
              "font-mono text-2xl font-bold text-center",
              isCritical && "text-red-500",
              isUrgent && !isCritical && "text-yellow-600"
            )}>
              {formatTime(remainingSeconds)}
            </div>

            {isUrgent && (
              <div className={cn(
                "flex items-center gap-1 text-xs",
                isCritical ? "text-red-500" : "text-yellow-600"
              )}>
                <AlertTriangle className="h-3 w-3" />
                <span>{isCritical ? "Tempo quase esgotado!" : "Atenção ao tempo!"}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
