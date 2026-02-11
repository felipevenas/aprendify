import { useState, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

interface MonthlyCalendarProps {
  items: ScheduleItem[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const MonthlyCalendar = ({ items, selectedDate, onSelectDate }: MonthlyCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const firstDayOfMonth = days[0].getDay();
  const emptyDaysBefore = Array(firstDayOfMonth).fill(null);

  const itemsByDate = useMemo(() => {
    const map: Record<string, { count: number; completed: number; hasHigh: boolean; hasMedium: boolean }> = {};
    items.forEach((item) => {
      if (item.scheduled_date) {
        const key = item.scheduled_date;
        if (!map[key]) map[key] = { count: 0, completed: 0, hasHigh: false, hasMedium: false };
        map[key].count++;
        if (item.completed) map[key].completed++;
        if (item.priority === "alta") map[key].hasHigh = true;
        if (item.priority === "média") map[key].hasMedium = true;
      }
    });
    return map;
  }, [items]);

  const getDayIndicator = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    const data = itemsByDate[key];
    if (!data) return null;

    const allDone = data.completed === data.count;
    if (allDone) return "done";
    if (data.hasHigh) return "high";
    if (data.hasMedium) return "medium";
    return "normal";
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 shadow-sm p-3 sm:p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm sm:text-base font-semibold capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((day, i) => (
          <div
            key={i}
            className={cn(
              "text-center text-[10px] sm:text-xs font-medium py-1",
              i === 0 ? "text-destructive/60" : "text-muted-foreground"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {emptyDaysBefore.map((_, index) => (
          <div key={`empty-${index}`} className="aspect-square" />
        ))}

        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const indicator = getDayIndicator(day);
          const data = itemsByDate[dateKey];

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center text-xs sm:text-sm transition-all relative",
                "hover:bg-accent/50",
                !isSameMonth(day, currentMonth) && "opacity-30",
                isToday(day) && !isSelected && "ring-1.5 ring-primary font-bold",
                isSelected && "bg-primary text-primary-foreground shadow-md hover:bg-primary/90",
                day.getDay() === 0 && !isSelected && "text-destructive/70",
              )}
            >
              <span className={cn("leading-none", isToday(day) && !isSelected && "text-primary")}>
                {format(day, "d")}
              </span>

              {/* Activity indicator dot */}
              {indicator && !isSelected && (
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full mt-0.5",
                    indicator === "done" && "bg-green-500",
                    indicator === "high" && "bg-destructive",
                    indicator === "medium" && "bg-amber-500",
                    indicator === "normal" && "bg-primary",
                  )}
                />
              )}

              {/* Count badge for selected */}
              {isSelected && data && (
                <span className="text-[8px] font-bold leading-none mt-0.5">
                  {data.completed}/{data.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Compact legend */}
      <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-border/50 text-[10px] sm:text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span>Feito</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
          <span>Alta</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span>Média</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span>Normal</span>
        </div>
      </div>
    </div>
  );
};

export default MonthlyCalendar;
