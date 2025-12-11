import { Progress } from "@/components/ui/progress";
import { CheckCircle2 } from "lucide-react";

interface SimuladoProgressProps {
  /** Current question index (0-based) */
  currentIndex: number;
  /** Total number of questions */
  totalQuestions: number;
  /** Number of answered questions */
  answeredCount: number;
}

/**
 * Progress bar component for simulados
 * Shows current position and answered questions count
 */
export const SimuladoProgress = ({ 
  currentIndex, 
  totalQuestions, 
  answeredCount 
}: SimuladoProgressProps) => {
  const progressPercentage = totalQuestions > 0 
    ? Math.round((answeredCount / totalQuestions) * 100) 
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Questão {currentIndex + 1} de {totalQuestions}
        </span>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="font-medium">{answeredCount} respondidas</span>
          <span className="text-muted-foreground">({progressPercentage}%)</span>
        </div>
      </div>
      <Progress value={progressPercentage} className="h-2" />
    </div>
  );
};
