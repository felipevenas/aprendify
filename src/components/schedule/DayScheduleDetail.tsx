import { format, isPast, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, BookOpen, Lightbulb, Trash2, Pencil, Sparkles, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScheduleItem {
  id: string;
  title: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  topic?: string;
  activities?: string;
  study_tips?: string;
  priority?: string;
  estimated_duration?: number;
  is_ai_generated?: boolean;
  completed?: boolean;
  completed_at?: string;
  subjects?: {
    name: string;
    color: string;
  };
}

interface DayScheduleDetailProps {
  date: Date;
  items: ScheduleItem[];
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
}

const DayScheduleDetail = ({ date, items, onEdit, onDelete, onToggleComplete }: DayScheduleDetailProps) => {
  const sortedItems = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const completedCount = items.filter((i) => i.completed).length;
  const dateIsPast = isPast(date) && !isToday(date);

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case "alta":
        return <Badge variant="destructive" className="text-xs">Alta Prioridade</Badge>;
      case "média":
        return <Badge className="text-xs bg-amber-500/80 hover:bg-amber-500">Média Prioridade</Badge>;
      default:
        return null;
    }
  };

  if (items.length === 0) {
    return (
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg capitalize">
            {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma sessão de estudo agendada para este dia.</p>
            <p className="text-sm mt-1">Gere um cronograma com IA ou adicione manualmente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg capitalize">
            {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </CardTitle>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <Badge variant="secondary" className="text-xs gap-1 bg-green-500/10 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                {completedCount}/{items.length}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {items.length} {items.length === 1 ? "sessão" : "sessões"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedItems.map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-lg border bg-background p-4 transition-all hover:shadow-md group",
              item.completed && "bg-green-500/5 border-green-500/30",
              !item.completed && item.priority === "alta" && "border-l-4 border-l-destructive",
              !item.completed && item.priority === "média" && "border-l-4 border-l-amber-500",
              !item.completed && (!item.priority || item.priority === "normal") && "border-l-4 border-l-primary"
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                {/* Check-in Button */}
                <button
                  onClick={() => onToggleComplete(item.id, !item.completed)}
                  className={cn(
                    "mt-0.5 shrink-0 transition-all hover:scale-110",
                    item.completed ? "text-green-500" : "text-muted-foreground hover:text-primary"
                  )}
                  title={item.completed ? "Marcar como não concluída" : "Marcar como concluída"}
                >
                  {item.completed ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={cn(
                      "font-semibold text-foreground",
                      item.completed && "line-through text-muted-foreground"
                    )}>
                      {item.title}
                    </h3>
                    {item.is_ai_generated && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Sparkles className="h-3 w-3" />
                        IA
                      </Badge>
                    )}
                    {item.completed && (
                      <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                        Concluída
                      </Badge>
                    )}
                    {!item.completed && getPriorityBadge(item.priority)}
                  </div>
                  {item.topic && item.topic !== item.title && (
                    <p className={cn(
                      "text-sm text-muted-foreground mt-1",
                      item.completed && "line-through"
                    )}>
                      {item.topic}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onEdit(item)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Horário e duração */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3 pl-8">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>
                  {item.start_time.substring(0, 5)} - {item.end_time.substring(0, 5)}
                </span>
              </div>
              {item.estimated_duration && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded">
                  {item.estimated_duration} min
                </span>
              )}
            </div>

            {/* Atividades */}
            {item.activities && !item.completed && (
              <div className="mb-3 pl-8">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-1">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span>Atividades</span>
                </div>
                <p className="text-sm text-muted-foreground pl-5">
                  {item.activities}
                </p>
              </div>
            )}

            {/* Dicas de estudo */}
            {item.study_tips && !item.completed && (
              <div className="bg-primary/5 rounded-lg p-3 mt-3 ml-8">
                <div className="flex items-center gap-1.5 text-sm font-medium text-primary mb-1">
                  <Lightbulb className="h-4 w-4" />
                  <span>Dica</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.study_tips}
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Resumo do dia */}
        <div className="border-t border-border pt-4 mt-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Tempo total de estudo:</span>
            <span className="font-medium text-foreground">
              {Math.floor(items.reduce((acc, item) => acc + (item.estimated_duration || 60), 0) / 60)}h{" "}
              {items.reduce((acc, item) => acc + (item.estimated_duration || 60), 0) % 60}min
            </span>
          </div>
          {dateIsPast && completedCount < items.length && (
            <p className="text-xs text-amber-500 mt-2">
              {items.length - completedCount} sessão(ões) não concluída(s) neste dia.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DayScheduleDetail;
