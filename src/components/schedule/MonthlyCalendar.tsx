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
  subjects?: {
    name: string;
    color: string;
  };
}

interface MonthlyCalendarProps {
  items: ScheduleItem[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MonthlyCalendar = ({ items, selectedDate, onSelectDate }: MonthlyCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Preencher dias antes do primeiro dia do mês
  const firstDayOfMonth = days[0].getDay();
  const emptyDaysBefore = Array(firstDayOfMonth).fill(null);

  // Contar itens por dia
  const itemCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      if (item.scheduled_date) {
        const dateKey = item.scheduled_date;
        counts[dateKey] = (counts[dateKey] || 0) + 1;
      }
    });
    return counts;
  }, [items]);

  const getPriorityColor = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dayItems = items.filter((item) => item.scheduled_date === dateKey);

    if (dayItems.some((item) => item.priority === "alta")) {
      return "bg-destructive/20 border-destructive/40";
    }
    if (dayItems.some((item) => item.priority === "média")) {
      return "bg-amber-500/20 border-amber-500/40";
    }
    if (dayItems.length > 0) {
      return "bg-primary/20 border-primary/40";
    }
    return "";
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      {/* Header com navegação */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</h2>
        <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Dias da semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-1">
        {/* Dias vazios antes do início do mês */}
        {emptyDaysBefore.map((_, index) => (
          <div key={`empty-${index}`} className="aspect-square" />
        ))}

        {/* Dias do mês */}
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const itemCount = itemCountByDate[dateKey] || 0;
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const priorityClass = getPriorityColor(day);

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all hover:bg-accent relative",
                !isSameMonth(day, currentMonth) && "text-muted-foreground opacity-50",
                isToday(day) && "ring-2 ring-primary",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                !isSelected && priorityClass,
                day.getDay() === 0 && "text-muted-foreground",
              )}
            >
              <span className={cn("font-medium", isToday(day) && !isSelected && "text-primary")}>
                {format(day, "d")}
              </span>

              {itemCount > 0 && !isSelected && (
                <div className="flex gap-0.5 mt-0.5">
                  {Array(Math.min(itemCount, 3))
                    .fill(0)
                    .map((_, i) => (
                      <div
                        key={i}
                        className={cn("w-1 h-1 rounded-full", isSelected ? "bg-primary-foreground" : "bg-primary")}
                      />
                    ))}
                  {itemCount > 3 && <span className="text-[8px] text-white">+{itemCount - 3}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-destructive/40" />
          <span>Alta prioridade</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500/40" />
          <span>Média</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary/40" />
          <span>Normal</span>
        </div>
      </div>
    </div>
  );
};

export default MonthlyCalendar;
