import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, BookOpen, Lightbulb, Trash2, Pencil, Sparkles } from "lucide-react";
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
}

const DayScheduleDetail = ({ date, items, onEdit, onDelete }: DayScheduleDetailProps) => {
  const sortedItems = [...items].sort((a, b) => a.start_time.localeCompare(b.start_time));

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
          <Badge variant="outline" className="text-xs">
            {items.length} {items.length === 1 ? "sessão" : "sessões"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedItems.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "rounded-lg border bg-background p-4 transition-all hover:shadow-md group",
              item.priority === "alta" && "border-l-4 border-l-destructive",
              item.priority === "média" && "border-l-4 border-l-amber-500",
              (!item.priority || item.priority === "normal") && "border-l-4 border-l-primary"
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  {item.is_ai_generated && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Sparkles className="h-3 w-3" />
                      IA
                    </Badge>
                  )}
                  {getPriorityBadge(item.priority)}
                </div>
                {item.topic && item.topic !== item.title && (
                  <p className="text-sm text-muted-foreground mt-1">{item.topic}</p>
                )}
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
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
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
            {item.activities && (
              <div className="mb-3">
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
            {item.study_tips && (
              <div className="bg-primary/5 rounded-lg p-3 mt-3">
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
        </div>
      </CardContent>
    </Card>
  );
};

export default DayScheduleDetail;
