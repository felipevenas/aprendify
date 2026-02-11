import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, BookOpen, Lightbulb, Trash2, Pencil, Sparkles, CheckCircle2, Circle, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
  const dayProgress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "alta":
        return "border-l-destructive";
      case "média":
        return "border-l-amber-500";
      default:
        return "border-l-primary";
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case "alta":
        return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Urgente</Badge>;
      case "média":
        return <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" variant="outline">Média</Badge>;
      default:
        return null;
    }
  };

  if (items.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg capitalize">
            {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10 text-muted-foreground">
            <CalendarOff className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium text-sm">Nenhuma sessão agendada</p>
            <p className="text-xs mt-1">Gere um plano com IA ou adicione manualmente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg capitalize">
            {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            {items.length > 0 && (
              <Badge variant="outline" className="text-[10px] sm:text-xs gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {completedCount}/{items.length}
              </Badge>
            )}
          </div>
        </div>
        {items.length > 1 && (
          <Progress value={dayProgress} className="h-1.5 mt-2" />
        )}
      </CardHeader>

      <CardContent className="space-y-3 pt-2">
        <AnimatePresence>
          {sortedItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "rounded-lg border bg-background p-3 sm:p-4 transition-all hover:shadow-sm group border-l-[3px]",
                item.completed && "bg-green-500/5 border-green-500/30 border-l-green-500",
                !item.completed && getPriorityColor(item.priority),
              )}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <button
                    onClick={() => onToggleComplete(item.id, !item.completed)}
                    className={cn(
                      "mt-0.5 shrink-0 transition-all hover:scale-110",
                      item.completed ? "text-green-500" : "text-muted-foreground hover:text-primary",
                    )}
                  >
                    {item.completed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3
                        className={cn(
                          "font-semibold text-sm sm:text-base text-foreground truncate",
                          item.completed && "line-through text-muted-foreground",
                        )}
                      >
                        {item.title}
                      </h3>
                      {item.is_ai_generated && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 gap-0.5 shrink-0">
                          <Sparkles className="h-2.5 w-2.5" />
                          IA
                        </Badge>
                      )}
                      {!item.completed && getPriorityBadge(item.priority)}
                    </div>

                    {/* Time + topic inline */}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {item.start_time.substring(0, 5)} – {item.end_time.substring(0, 5)}
                        </span>
                      </div>
                      {item.estimated_duration && (
                        <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{item.estimated_duration}min</span>
                      )}
                    </div>

                    {item.topic && item.topic !== item.title && (
                      <p
                        className={cn(
                          "text-xs text-muted-foreground mt-1",
                          item.completed && "line-through",
                        )}
                      >
                        {item.topic}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Expandable content (only if not completed) */}
              {!item.completed && (item.activities || item.study_tips) && (
                <div className="mt-3 ml-7 space-y-2">
                  {item.activities && (
                    <div className="flex items-start gap-1.5 text-xs">
                      <BookOpen className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="text-muted-foreground">{item.activities}</p>
                    </div>
                  )}
                  {item.study_tips && (
                    <div className="bg-primary/5 rounded-md p-2.5">
                      <div className="flex items-start gap-1.5 text-xs">
                        <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <p className="text-muted-foreground">{item.study_tips}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Day summary */}
        <div className="border-t border-border/50 pt-3 mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tempo total</span>
            <span className="font-medium text-foreground">
              {Math.floor(items.reduce((acc, item) => acc + (item.estimated_duration || 60), 0) / 60)}h{" "}
              {items.reduce((acc, item) => acc + (item.estimated_duration || 60), 0) % 60}min
            </span>
          </div>
          {dateIsPast && completedCount < items.length && (
            <p className="text-[10px] text-amber-500 mt-1.5">
              {items.length - completedCount} sessão(ões) não concluída(s)
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DayScheduleDetail;
