import { useMemo, useRef } from "react";
import {
  format,
  addDays,
  isToday,
  isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Circle, Sparkles, Plus } from "lucide-react";
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
  onAddAtSlot?: (date: Date, startTime: string) => void;
  weekStart: Date;
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6h to 21h
const HOUR_HEIGHT = 64; // px per hour — larger cells

const WeeklyAgendaView = ({
  items,
  selectedDate,
  onSelectDate,
  onEdit,
  onDelete,
  onToggleComplete,
  onAddAtSlot,
  weekStart,
}: WeeklyAgendaViewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

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
    const top = ((startH - 6) * 60 + startM) * (HOUR_HEIGHT / 60);
    const height = Math.max(((endH - startH) * 60 + (endM - startM)) * (HOUR_HEIGHT / 60), 28);
    return { top, height };
  };

  const handleSlotClick = (day: Date, hour: number) => {
    onSelectDate(day);
    if (onAddAtSlot) {
      const startTime = `${String(hour).padStart(2, "0")}:00`;
      onAddAtSlot(day, startTime);
    }
  };

  // Current time indicator
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const showCurrentTime = currentHour >= 6 && currentHour <= 21;
  const currentTimeTop = ((currentHour - 6) * 60 + currentMinute) * (HOUR_HEIGHT / 60);

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border/50 sticky top-0 bg-card z-20">
        <div className="p-2 border-r border-border/30" />
        {weekDays.map((day) => {
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const dayKey = format(day, "yyyy-MM-dd");
          const dayItems = itemsByDay[dayKey] || [];
          const completedCount = dayItems.filter((i) => i.completed).length;
          const today = isToday(day);

          return (
            <button
              key={dayKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                "py-3 px-1 text-center transition-all border-l border-border/30 relative",
                "hover:bg-accent/40",
                isSelected && "bg-primary/8",
                today && "bg-primary/5"
              )}
            >
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {format(day, "EEE", { locale: ptBR })}
              </p>
              <div
                className={cn(
                  "w-9 h-9 mx-auto flex items-center justify-center rounded-full text-lg font-bold transition-colors mt-0.5",
                  today && "bg-primary text-primary-foreground",
                  isSelected && !today && "bg-primary/15 text-primary"
                )}
              >
                {format(day, "d")}
              </div>
              {dayItems.length > 0 && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <div className="flex gap-0.5">
                    {dayItems.length <= 4
                      ? dayItems.map((item) => (
                          <div
                            key={item.id}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              item.completed ? "bg-green-500" : "bg-primary/60"
                            )}
                          />
                        ))
                      : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                          <span className="text-[9px] text-muted-foreground font-medium ml-0.5">
                            {completedCount}/{dayItems.length}
                          </span>
                        </>
                      )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="overflow-y-auto max-h-[600px] relative">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] relative">
          {/* Hour labels */}
          <div className="relative border-r border-border/30">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="flex items-start justify-end pr-2 pt-1"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayItems = itemsByDay[dayKey] || [];
            const today = isToday(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <div
                key={dayKey}
                className={cn(
                  "relative border-l border-border/30",
                  today && "bg-primary/[0.03]",
                  isSelected && !today && "bg-accent/20"
                )}
              >
                {/* Hour grid lines — clickable slots */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className={cn(
                      "border-b border-border/15 group/slot cursor-pointer transition-colors",
                      "hover:bg-primary/[0.06]"
                    )}
                    style={{ height: `${HOUR_HEIGHT}px` }}
                    onClick={() => handleSlotClick(day, hour)}
                  >
                    {/* Half-hour divider */}
                    <div
                      className="border-b border-border/8 w-full"
                      style={{ marginTop: `${HOUR_HEIGHT / 2}px` }}
                    />
                    {/* Add icon on hover */}
                    <div className="hidden group-hover/slot:flex items-center justify-center absolute inset-0 pointer-events-none opacity-0 group-hover/slot:opacity-100 transition-opacity">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plus className="h-3 w-3 text-primary/60" />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Current time indicator */}
                {today && showCurrentTime && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none"
                    style={{ top: `${currentTimeTop}px` }}
                  >
                    <div className="flex items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive -ml-1 shadow-sm" />
                      <div className="flex-1 h-[2px] bg-destructive/80" />
                    </div>
                  </div>
                )}

                {/* Schedule items */}
                {dayItems.map((item) => {
                  const { top, height } = getItemPosition(item);
                  const subject = item.subject_id ? getSubjectById(item.subject_id) : null;
                  const isCompact = height < 44;

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "absolute left-1 right-1 rounded-lg border-l-[3px] px-2 py-1.5 cursor-pointer",
                        "transition-all hover:shadow-lg hover:z-30 group/item z-10",
                        "backdrop-blur-sm",
                        item.completed
                          ? "bg-green-500/8 border-l-green-500 border border-green-500/20"
                          : "bg-card/95 border border-border/60 shadow-sm hover:border-primary/30",
                      )}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        minHeight: "28px",
                        borderLeftColor: item.completed
                          ? undefined
                          : subject?.color || undefined,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(item);
                      }}
                    >
                      <div className="flex items-start justify-between gap-1 h-full">
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex items-center gap-1">
                            <p
                              className={cn(
                                "text-[11px] font-semibold truncate leading-tight",
                                item.completed && "line-through text-muted-foreground"
                              )}
                            >
                              {item.title}
                            </p>
                            {item.is_ai_generated && (
                              <Sparkles className="h-2.5 w-2.5 text-primary/60 shrink-0" />
                            )}
                          </div>
                          {!isCompact && (
                            <>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {item.start_time.substring(0, 5)} – {item.end_time.substring(0, 5)}
                              </p>
                              {height > 60 && subject && (
                                <div className="flex items-center gap-1 mt-1">
                                  <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: subject.color }}
                                  />
                                  <span className="text-[9px] text-muted-foreground truncate">
                                    {subject.name}
                                  </span>
                                </div>
                              )}
                              {height > 80 && item.topic && item.topic !== item.title && (
                                <p className="text-[9px] text-muted-foreground/70 mt-0.5 truncate italic">
                                  {item.topic}
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        {/* Quick complete toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleComplete(item.id, !item.completed);
                          }}
                          className={cn(
                            "p-0.5 rounded-full transition-all shrink-0 mt-0.5",
                            "opacity-60 hover:opacity-100",
                            item.completed ? "text-green-500" : "text-muted-foreground hover:text-primary"
                          )}
                        >
                          {item.completed ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Circle className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
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
