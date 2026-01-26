import { motion } from "framer-motion";
import { TrendingUp, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { calculateTRI, TRIScore, getTRIClassification } from "@/lib/calculateTRI";

interface TRIScoreDisplayProps {
  answers: Array<{
    is_correct: boolean | null;
    difficulty?: string;
  }>;
  showDetails?: boolean;
}

/**
 * Componente que exibe a nota TRI estimada do simulado
 * Usa o algoritmo simplificado de Teoria de Resposta ao Item
 */
const TRIScoreDisplay = ({ answers, showDetails = true }: TRIScoreDisplayProps) => {
  // Mapear respostas para o formato esperado pelo cálculo TRI
  const mappedAnswers = answers.map(a => ({
    isCorrect: a.is_correct ?? false,
    difficulty: (a.difficulty as "easy" | "medium" | "hard") || "medium"
  }));

  const triResult: TRIScore = calculateTRI(mappedAnswers);
  const classification = getTRIClassification(triResult.score);

  // Cor baseada na classificação
  const getScoreColor = () => {
    if (triResult.score >= 800) return "text-green-500";
    if (triResult.score >= 700) return "text-emerald-500";
    if (triResult.score >= 600) return "text-blue-500";
    if (triResult.score >= 500) return "text-amber-500";
    return "text-red-500";
  };

  const getBadgeVariant = () => {
    if (triResult.score >= 700) return "bg-green-500/10 text-green-600 dark:text-green-400";
    if (triResult.score >= 600) return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    if (triResult.score >= 500) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    return "bg-red-500/10 text-red-600 dark:text-red-400";
  };

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-semibold">Nota TRI Estimada</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    A nota TRI (Teoria de Resposta ao Item) considera a dificuldade 
                    das questões e a consistência das respostas. Errar questões fáceis 
                    penaliza mais do que errar difíceis.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Badge className={getBadgeVariant()}>
            {classification.label}
          </Badge>
        </div>

        <div className="text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className={`text-5xl font-bold ${getScoreColor()}`}
          >
            {triResult.score}
          </motion.div>
          <p className="text-sm text-muted-foreground mt-1">
            Escala de 300 a 900 pontos
          </p>
        </div>

        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 pt-4 border-t border-border/50 space-y-3"
          >
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground">Fáceis</p>
                <p className="font-semibold text-sm">
                  {triResult.breakdown.easy.correct}/{triResult.breakdown.easy.total}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground">Médias</p>
                <p className="font-semibold text-sm">
                  {triResult.breakdown.medium.correct}/{triResult.breakdown.medium.total}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground">Difíceis</p>
                <p className="font-semibold text-sm">
                  {triResult.breakdown.hard.correct}/{triResult.breakdown.hard.total}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Fator de consistência</span>
              <span className={`font-medium ${triResult.consistencyFactor >= 0.9 ? 'text-green-500' : triResult.consistencyFactor >= 0.7 ? 'text-amber-500' : 'text-red-500'}`}>
                {Math.round(triResult.consistencyFactor * 100)}%
              </span>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default TRIScoreDisplay;
