import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ComparisonData {
  currentWeek: {
    questions: number;
    correct: number;
    accuracy: number;
  };
  previousWeek: {
    questions: number;
    correct: number;
    accuracy: number;
  };
}

interface WeeklyComparisonProps {
  data: ComparisonData;
}

/**
 * Card de comparação semanal para a tela de estatísticas
 * Mostra evolução em relação à semana anterior
 */
const WeeklyComparison = ({ data }: WeeklyComparisonProps) => {
  const { currentWeek, previousWeek } = data;

  const questionsChange = previousWeek.questions > 0
    ? ((currentWeek.questions - previousWeek.questions) / previousWeek.questions) * 100
    : currentWeek.questions > 0 ? 100 : 0;

  const accuracyChange = currentWeek.accuracy - previousWeek.accuracy;

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUpRight className="h-4 w-4" />;
    if (change < 0) return <ArrowDownRight className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getChangeColor = (change: number, inverse = false) => {
    const positive = inverse ? change < 0 : change > 0;
    const negative = inverse ? change > 0 : change < 0;
    
    if (positive) return "text-green-500 bg-green-500/10";
    if (negative) return "text-red-500 bg-red-500/10";
    return "text-muted-foreground bg-muted";
  };

  const metrics = [
    {
      label: "Questões Respondidas",
      current: currentWeek.questions,
      previous: previousWeek.questions,
      change: questionsChange,
      suffix: "",
      format: (n: number) => n.toString(),
    },
    {
      label: "Taxa de Acerto",
      current: currentWeek.accuracy,
      previous: previousWeek.accuracy,
      change: accuracyChange,
      suffix: "%",
      format: (n: number) => n.toFixed(1),
    },
    {
      label: "Questões Corretas",
      current: currentWeek.correct,
      previous: previousWeek.correct,
      change: previousWeek.correct > 0 
        ? ((currentWeek.correct - previousWeek.correct) / previousWeek.correct) * 100 
        : currentWeek.correct > 0 ? 100 : 0,
      suffix: "",
      format: (n: number) => n.toString(),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle>Evolução Semanal</CardTitle>
        </div>
        <CardDescription>Comparação com a semana anterior</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{metric.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">
                    {metric.format(metric.current)}{metric.suffix}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    vs {metric.format(metric.previous)}{metric.suffix}
                  </span>
                </div>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium",
                  getChangeColor(metric.change)
                )}
              >
                {getChangeIcon(metric.change)}
                <span>
                  {metric.change > 0 ? "+" : ""}
                  {metric.change.toFixed(1)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Destaque automático de melhoria */}
        {accuracyChange > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20"
          >
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">
                Sua taxa de acerto melhorou {accuracyChange.toFixed(1)} pontos percentuais!
              </span>
            </div>
          </motion.div>
        )}

        {accuracyChange < -5 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
          >
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm font-medium">
                Sua taxa de acerto caiu. Foque nas disciplinas com mais erros!
              </span>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyComparison;
