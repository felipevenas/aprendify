import { useMemo } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isToday,
  isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, CheckCircle2, Circle, Sparkles, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getSubjectById } from "@/lib/subjects";
import { motion } from "framer-motion";

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
  subject_id?: string | null;
}

interface WeeklyAgendaViewProps {
  items: ScheduleItem[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  weekStart: Date;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6); // 6h to 20h

const WeeklyAgendaView = ({
  items,
  selectedDate,
  onSelectDate,
  onEdit,
  onDelete,
  onToggleComplete,
  weekStart,
}: WeeklyAgendaViewProps) => {
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    weekDays.forEach((day) => {
      const key = format(day, "yyyy-MM-dd");
      map[key] = items
        .filter((item) => item.scheduled_date === key)
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
    });
    return map;
  }, [items, weekDays]);

  const getItemPosition = (item: ScheduleItem) => {
    const [startH, startM] = item.start_time.split(":").map(Number);
    const [endH, endM] = item.end_time.split(":").map(Number);
    const top = ((startH - 6) * 60 + startM) * (48 / 60); // 48px per hour
    const height = Math.max(((endH - startH) * 60 + (endM - startM)) * (48 / 60), 24);
    return { top, height };
  };

  const getPriorityBorder = (priority?: string) => {
    switch (priority) {
      case "alta": return "border-l-destructive";
      case "média": return "border-l-amber-500";
      default: return "border-l-primary";
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border/50 sticky top-0 bg-card z-10">
        <div className="p-2" />
        {weekDays.map((day) => {
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dayKey = format(day, "yyyy-MM-dd");
          const dayItems = itemsByDay[dayKey] || [];
          const completedCount = dayItems.filter((i) => i.completed).length;

          return (
            <button
              key={dayKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                "p-2 text-center transition-colors border-l border-border/30",
                "hover:bg-accent/50",
                isSelected && "bg-primary/10",
                isToday(day) && "bg-primary/5"
              )}
            >
              <p className="text-[10px] uppercase text-muted-foreground font-medium">
                {format(day, "EEE", { locale: ptBR })}
              </p>
              <p
                className={cn(
                  "text-lg font-bold leading-tight",
                  isToday(day) && "text-primary",
                  isSelected && "text-primary"
                )}
              >
                {format(day, "d")}
              </p>
              {dayItems.length > 0 && (
                <div className="flex items-center justify-center gap-0.5 mt-0.5">
                  <span className="text-[9px] text-muted-foreground">
                    {completedCount}/{dayItems.length}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="overflow-y-auto max-h-[520px]">
        <div className="grid grid-cols-[48px_repeat(7,1fr)] relative">
          {/* Hour labels */}
          <div className="relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-12 border-b border-border/20 flex items-start justify-end pr-1.5 pt-0.5"
              >
                <span className="text-[10px] text-muted-foreground font-medium">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayItems = itemsByDay[dayKey] || [];

            return (
              <div
                key={dayKey}
                className={cn(
                  "relative border-l border-border/30",
                  isToday(day) && "bg-primary/[0.02]"
                )}
              >
                {/* Hour grid lines */}
                {HOURS.map((hour) => (
                  <div key={hour} className="h-12 border-b border-border/20" />
                ))}

                {/* Schedule items */}
                {dayItems.map((item) => {
                  const { top, height } = getItemPosition(item);
                  const subject = item.subject_id ? getSubjectById(item.subject_id) : null;

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "absolute left-0.5 right-0.5 rounded-md border-l-[3px] px-1.5 py-1 cursor-pointer",
                        "transition-shadow hover:shadow-md hover:z-20 group overflow-hidden",
                        item.completed
                          ? "bg-green-500/10 border-l-green-500 opacity-70"
                          : "bg-card border shadow-sm",
                        !item.completed && getPriorityBorder(item.priority)
                      )}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        minHeight: "24px",
                        borderLeftColor: item.completed
                          ? undefined
                          : subject?.color || undefined,
                      }}
                      onClick={() => onSelectDate(day)}
                    >
                      <div className="flex items-start justify-between gap-0.5">
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-[10px] font-semibold truncate leading-tight",
                              item.completed && "line-through text-muted-foreground"
                            )}
                          >
                            {item.title}
                          </p>
                          {height > 30 && (
                            <p className="text-[9px] text-muted-foreground truncate">
                              {item.start_time.substring(0, 5)} – {item.end_time.substring(0, 5)}
                            </p>
                          )}
                        </div>

                        {/* Quick actions on hover */}
                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleComplete(item.id, !item.completed);
                            }}
                            className={cn(
                              "p-0.5 rounded transition-colors",
                              item.completed ? "text-green-500" : "text-muted-foreground hover:text-primary"
                            )}
                          >
                            {item.completed ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <Circle className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      {height > 50 && subject && (
                        <p className="text-[9px] text-muted-foreground truncate mt-0.5">
                          {subject.name}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeeklyAgendaView;
