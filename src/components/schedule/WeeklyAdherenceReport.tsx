import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ScheduleItem {
  id: string;
  title: string;
  scheduled_date: string;
  completed?: boolean;
  completed_at?: string;
  is_ai_generated?: boolean;
  priority?: string;
}

interface WeeklyAdherenceReportProps {
  items: ScheduleItem[];
}

const WeeklyAdherenceReport = ({ items }: WeeklyAdherenceReportProps) => {
  const weekStats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const weekItems = items.filter((item) => {
      const itemDate = parseISO(item.scheduled_date);
      return isWithinInterval(itemDate, { start: weekStart, end: weekEnd });
    });

    const pastItems = weekItems.filter((item) => {
      const itemDate = parseISO(item.scheduled_date);
      return itemDate <= now;
    });

    const completed = pastItems.filter((item) => item.completed).length;
    const missed = pastItems.filter((item) => !item.completed).length;
    const upcoming = weekItems.length - pastItems.length;
    const total = pastItems.length;
    const adherenceRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // High priority tracking
    const highPriorityItems = pastItems.filter((item) => item.priority === "alta");
    const highPriorityCompleted = highPriorityItems.filter((item) => item.completed).length;

    return {
      weekStart,
      weekEnd,
      completed,
      missed,
      upcoming,
      total,
      adherenceRate,
      highPriorityItems: highPriorityItems.length,
      highPriorityCompleted,
    };
  }, [items]);

  const getSuggestion = () => {
    const { adherenceRate, missed, highPriorityItems, highPriorityCompleted } = weekStats;

    if (adherenceRate >= 90) {
      return {
        icon: TrendingUp,
        color: "text-green-500",
        text: "Excelente! Continue mantendo essa consistência.",
      };
    } else if (adherenceRate >= 70) {
      return {
        icon: TrendingUp,
        color: "text-primary",
        text: "Bom progresso! Tente completar as sessões de alta prioridade.",
      };
    } else if (adherenceRate >= 50) {
      return {
        icon: Minus,
        color: "text-amber-500",
        text: `${missed} sessões perdidas. Considere ajustar o cronograma para sua rotina.`,
      };
    } else {
      return {
        icon: TrendingDown,
        color: "text-destructive",
        text: "Taxa de aderência baixa. Recomendamos regenerar o cronograma com a IA.",
      };
    }
  };

  const suggestion = getSuggestion();
  const SuggestionIcon = suggestion.icon;

  if (weekStats.total === 0 && weekStats.upcoming === 0) {
    return (
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Relatório Semanal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma sessão agendada para esta semana.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Relatório Semanal
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {format(weekStats.weekStart, "dd/MM", { locale: ptBR })} -{" "}
            {format(weekStats.weekEnd, "dd/MM", { locale: ptBR })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Adherence Progress */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Taxa de Aderência</span>
            <span className="font-semibold">{weekStats.adherenceRate}%</span>
          </div>
          <Progress value={weekStats.adherenceRate} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-green-500/10 rounded-lg p-2">
            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-green-500">{weekStats.completed}</p>
            <p className="text-xs text-muted-foreground">Concluídas</p>
          </div>
          <div className="bg-destructive/10 rounded-lg p-2">
            <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className="text-lg font-bold text-destructive">{weekStats.missed}</p>
            <p className="text-xs text-muted-foreground">Perdidas</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-2">
            <BarChart3 className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-primary">{weekStats.upcoming}</p>
            <p className="text-xs text-muted-foreground">Restantes</p>
          </div>
        </div>

        {/* High Priority */}
        {weekStats.highPriorityItems > 0 && (
          <div className="flex items-center justify-between text-sm p-2 bg-destructive/5 rounded-lg">
            <span className="text-muted-foreground">Alta Prioridade</span>
            <Badge variant="destructive" className="text-xs">
              {weekStats.highPriorityCompleted}/{weekStats.highPriorityItems} concluídas
            </Badge>
          </div>
        )}

        {/* Suggestion */}
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
          <SuggestionIcon className={`h-5 w-5 mt-0.5 shrink-0 ${suggestion.color}`} />
          <p className="text-sm text-muted-foreground">{suggestion.text}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyAdherenceReport;
