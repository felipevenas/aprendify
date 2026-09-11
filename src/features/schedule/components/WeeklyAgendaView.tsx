import { useMemo, useRef, useEffect } from "react";
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
const HOUR_HEIGHT = 64;
const GUTTER_WIDTH = 60;

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

  // Auto-scroll to ~8am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 2 * HOUR_HEIGHT; // 8:00
    }
  }, []);

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
      onAddAtSlot(day, `${String(hour).padStart(2, "0")}:00`);
    }
  };

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const showCurrentTime = currentHour >= 6 && currentHour <= 21;
  const currentTimeTop = ((currentHour - 6) * 60 + currentMinute) * (HOUR_HEIGHT / 60);

  const totalGridHeight = HOURS.length * HOUR_HEIGHT;

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <div className="min-w-[750px] lg:min-w-0">
          {/* ── Day headers ── */}
          <div
            className="grid border-b border-border/50 sticky top-0 bg-card z-20"
            style={{ gridTemplateColumns: `${GUTTER_WIDTH}px repeat(7, 1fr)` }}
          >
            {/* Empty gutter cell */}
            <div className="border-r border-border/30" />

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
                    "py-2.5 text-center transition-all border-l border-border/30",
                    "hover:bg-accent/30",
                    isSelected && "bg-primary/8",
                    today && "bg-primary/5"
                  )}
                >
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {format(day, "EEE", { locale: ptBR })}
                  </p>
                  <div
                    className={cn(
                      "w-8 h-8 mx-auto flex items-center justify-center rounded-full text-base font-bold mt-0.5 transition-colors",
                      today && "bg-primary text-primary-foreground",
                      isSelected && !today && "bg-primary/15 text-primary",
                      !today && !isSelected && "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  {dayItems.length > 0 && (
                    <div className="flex items-center justify-center gap-0.5 mt-1">
                      {dayItems.length <= 5
                        ? dayItems.map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                "w-1.5 h-1.5 rounded-full transition-colors",
                                item.completed ? "bg-green-500" : "bg-primary/50"
                              )}
                            />
                          ))
                        : (
                          <span className="text-[9px] text-muted-foreground font-medium">
                            {completedCount}/{dayItems.length}
                          </span>
                        )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Time grid ── */}
          <div ref={scrollRef} className="overflow-y-auto max-h-[600px] scrollbar-thin">
            <div
              className="grid relative"
              style={{ gridTemplateColumns: `${GUTTER_WIDTH}px repeat(7, 1fr)` }}
            >
              {/* ── Gutter: hour labels ── */}
              <div className="relative border-r border-border/30" style={{ height: totalGridHeight }}>
                {HOURS.map((hour, i) => (
                  <div
                    key={hour}
                    className="absolute right-0 pr-2 flex items-center justify-end"
                    style={{
                      top: i * HOUR_HEIGHT - 7, // center the label on the line
                      height: 14,
                    }}
                  >
                    {i > 0 && (
                      <span className="text-[10px] text-muted-foreground font-medium tabular-nums select-none">
                        {String(hour).padStart(2, "0")}:00
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* ── Day columns ── */}
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
                      today && "bg-primary/[0.02]",
                      isSelected && !today && "bg-accent/10"
                    )}
                    style={{ height: totalGridHeight }}
                  >
                    {/* Horizontal hour lines + clickable slots */}
                    {HOURS.map((hour, i) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0"
                        style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                      >
                        {/* Hour line */}
                        <div className="absolute top-0 left-0 right-0 border-t border-border/20" />
                        {/* Half-hour line */}
                        <div
                          className="absolute left-0 right-0 border-t border-border/10"
                          style={{ top: HOUR_HEIGHT / 2 }}
                        />

                        {/* Clickable slot */}
                        <div
                          className="absolute inset-0 cursor-pointer group/slot hover:bg-primary/[0.04] transition-colors"
                          onClick={() => handleSlotClick(day, hour)}
                        >
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity pointer-events-none">
                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                              <Plus className="h-3 w-3 text-primary/50" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Current time indicator */}
                    {today && showCurrentTime && (
                      <div
                        className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                        style={{ top: currentTimeTop }}
                      >
                        <div className="w-2 h-2 rounded-full bg-destructive -ml-1 shadow-sm shrink-0" />
                        <div className="flex-1 h-[2px] bg-destructive/70" />
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
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2 }}
                          className={cn(
                            "absolute left-1 right-1 rounded-md border-l-[3px] px-2 py-1 cursor-pointer overflow-hidden",
                            "transition-shadow hover:shadow-md hover:z-30 z-10",
                            item.completed
                              ? "bg-green-500/8 border-l-green-500 border border-green-500/15"
                              : "bg-card border border-border/50 shadow-sm hover:border-primary/30",
                          )}
                          style={{
                            top: `${top + 1}px`,
                            height: `${height - 2}px`,
                            minHeight: "26px",
                            borderLeftColor: item.completed
                              ? undefined
                              : subject?.color || undefined,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(item);
                          }}
                        >
                          <div className="flex items-start justify-between gap-0.5 h-full">
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
                                  <Sparkles className="h-2.5 w-2.5 text-primary/50 shrink-0" />
                                )}
                              </div>
                              {!isCompact && (
                                <>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {item.start_time.substring(0, 5)} – {item.end_time.substring(0, 5)}
                                  </p>
                                  {height > 60 && subject && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <div
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: subject.color }}
                                      />
                                      <span className="text-[9px] text-muted-foreground truncate">
                                        {subject.name}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleComplete(item.id, !item.completed);
                              }}
                              className={cn(
                                "p-0.5 rounded-full shrink-0 mt-0.5 transition-colors",
                                item.completed
                                  ? "text-green-500 hover:text-green-600"
                                  : "text-muted-foreground/50 hover:text-primary"
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
      </div>
    </div>
  );
};

export default WeeklyAgendaView;
