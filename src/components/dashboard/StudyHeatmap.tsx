import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudyHeatmapProps {
  userId?: string;
  embedded?: boolean;
}

const DAILY_THRESHOLD = 5;
const WEEKS_TO_SHOW = 20; // ~5 months
const DAYS_TOTAL = WEEKS_TO_SHOW * 7;

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DAY_LABELS = ["", "Seg", "", "Qua", "", "Sex", ""];

const StudyHeatmap = ({ userId, embedded = false }: StudyHeatmapProps) => {
  const [dayCounts, setDayCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - DAYS_TOTAL);
      startDate.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("question_attempts")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", startDate.toISOString());

      const counts: Record<string, number> = {};
      (data || []).forEach((attempt) => {
        const date = new Date(attempt.created_at).toISOString().split("T")[0];
        counts[date] = (counts[date] || 0) + 1;
      });

      setDayCounts(counts);
      setLoading(false);
    };

    fetchData();
  }, [userId]);

  const { grid, monthHeaders, totalActiveDays, currentStreak } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build grid: array of weeks, each week is array of days
    const weeks: { date: string; count: number; dayOfWeek: number }[][] = [];
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - DAYS_TOTAL + 1);

    // Align to start of week (Sunday)
    const startDow = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDow);

    let currentDate = new Date(startDate);
    let activeDays = 0;
    let streak = 0;
    let streakBroken = false;

    const allDays: { date: string; count: number }[] = [];

    while (currentDate <= today) {
      const week: { date: string; count: number; dayOfWeek: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const count = dayCounts[dateStr] || 0;
        week.push({ date: dateStr, count, dayOfWeek: d });
        if (count >= DAILY_THRESHOLD) activeDays++;
        allDays.push({ date: dateStr, count });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    // Calculate current streak (from today backwards)
    for (let i = allDays.length - 1; i >= 0; i--) {
      if (allDays[i].count >= DAILY_THRESHOLD) {
        streak++;
      } else {
        // Allow today to be 0 if streak continues from yesterday
        if (i === allDays.length - 1) continue;
        break;
      }
    }

    // Month headers
    const headers: { label: string; colStart: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const firstDay = new Date(week[0].date);
      const month = firstDay.getMonth();
      if (month !== lastMonth) {
        headers.push({ label: MONTH_LABELS[month], colStart: wi });
        lastMonth = month;
      }
    });

    return { grid: weeks, monthHeaders: headers, totalActiveDays: activeDays, currentStreak: streak };
  }, [dayCounts]);

  const getColor = (count: number) => {
    if (count === 0) return "bg-muted/50";
    if (count < DAILY_THRESHOLD) return "bg-primary/20";
    if (count < 10) return "bg-primary/50";
    if (count < 20) return "bg-primary/75";
    return "bg-primary";
  };

  if (loading) {
    if (embedded) {
      return <div className="animate-pulse h-24 bg-muted rounded-lg" />;
    }
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-primary" />
            Frequência de Estudos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-24 bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const heatmapContent = (
    <div className="overflow-x-auto">
      {/* Stats row */}
      <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground mb-2 px-1">
        <span>
          <strong className="text-foreground">{totalActiveDays}</strong> dias ativos
        </span>
        {currentStreak > 0 && (
          <span className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-orange-500" />
            <strong className="text-foreground">{currentStreak}</strong> dias seguidos
          </span>
        )}
      </div>

      {/* Month labels */}
      <div className="flex mb-1 ml-7">
        {monthHeaders.map((mh, i) => (
          <span
            key={i}
            className="text-[10px] text-muted-foreground"
            style={{
              position: "relative",
              left: `${mh.colStart * 14}px`,
              marginRight:
                i < monthHeaders.length - 1 ? `${(monthHeaders[i + 1].colStart - mh.colStart) * 14 - 24}px` : 0,
            }}
          >
            {mh.label}
          </span>
        ))}
      </div>

      <div className="flex gap-0">
        {/* Day labels */}
        <div className="flex flex-col gap-[2px] mr-1 pt-0">
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="h-[12px] flex items-center">
              <span className="text-[9px] text-muted-foreground w-5 text-right">{label}</span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <TooltipProvider delayDuration={100}>
          <div className="flex gap-[2px]">
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((day) => {
                  const isToday = day.date === new Date().toISOString().split("T")[0];
                  return (
                    <Tooltip key={day.date}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "w-[12px] h-[12px] rounded-[2px] transition-colors",
                            getColor(day.count),
                            isToday && "ring-1 ring-foreground/30",
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p className="font-medium">
                          {day.count} questão(ões) em{" "}
                          {new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {day.count >= DAILY_THRESHOLD && <p className="text-primary">✓ Meta diária atingida!</p>}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </TooltipProvider>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-muted-foreground">
        <span>Menos</span>
        <div className="w-[10px] h-[10px] rounded-[2px] bg-muted/50" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-primary/20" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-primary/50" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-primary/75" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-primary" />
        <span>Mais</span>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="py-2">{heatmapContent}</div>;
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-primary" />
          Frequência de Estudos
        </CardTitle>
      </CardHeader>
      <CardContent>{heatmapContent}</CardContent>
    </Card>
  );
};

export default StudyHeatmap;
