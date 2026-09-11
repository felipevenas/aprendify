import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, Trophy, Calendar, CheckCircle2, Sparkles, BookOpen, PenTool, Layers } from "lucide-react";
import { studyActivityTracker, StudyActivityMap } from "../services/studyActivityTracker";
import { cn } from "@/lib/utils";

interface GitHubStudyHeatmapProps {
  userId?: string;
  className?: string;
}

const WEEKS_TO_SHOW = 32; // ~7 a 8 meses de histórico completo visível confortavelmente
const DAYS_TOTAL = WEEKS_TO_SHOW * 7;

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DAY_LABELS = ["", "Seg", "", "Qua", "", "Sex", ""];

export const GitHubStudyHeatmap: React.FC<GitHubStudyHeatmapProps> = ({ userId, className = "" }) => {
  const [activityMap, setActivityMap] = useState<StudyActivityMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const load = async () => {
      setLoading(true);
      const data = await studyActivityTracker.fetchUserActivity(userId, DAYS_TOTAL);
      if (isMounted) {
        setActivityMap(data);
        setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const { grid, monthHeaders, totalActiveDays, currentStreak, longestStreak, totalActions } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - DAYS_TOTAL + 1);

    // Alinha para o domingo da semana de início
    const startDow = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDow);

    const weeks: Array<Array<{
      date: string;
      count: number;
      questions: number;
      essays: number;
      flashcards: number;
      simulados: number;
      dayOfWeek: number;
    }>> = [];

    let currentDate = new Date(startDate);
    let activeDays = 0;
    let totalActs = 0;

    const allDays: Array<{ date: string; count: number }> = [];

    while (currentDate <= today) {
      const week: typeof weeks[0] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const dayData = activityMap[dateStr] || { total: 0, questions: 0, essays: 0, flashcards: 0, simulados: 0 };
        const count = dayData.total || 0;

        week.push({
          date: dateStr,
          count,
          questions: dayData.questions || 0,
          essays: dayData.essays || 0,
          flashcards: dayData.flashcards || 0,
          simulados: dayData.simulados || 0,
          dayOfWeek: d,
        });

        if (count >= 1) {
          activeDays += 1;
        }
        totalActs += count;
        allDays.push({ date: dateStr, count });

        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    // Calcula Sequência Atual (Streak contínuo a partir de 1 atividade de estudo)
    let currentStreakCount = 0;
    for (let i = allDays.length - 1; i >= 0; i--) {
      if (allDays[i].count >= 1) {
        currentStreakCount++;
      } else {
        // Se hoje ainda não estudou, mas ontem sim, permite continuar o streak ativo
        if (i === allDays.length - 1) continue;
        break;
      }
    }

    // Calcula Maior Sequência Histórica
    let maxStreak = 0;
    let tempStreak = 0;
    for (const d of allDays) {
      if (d.count >= 1) {
        tempStreak++;
        if (tempStreak > maxStreak) {
          maxStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    }

    // Rótulos dos meses alinhados às colunas
    const headers: Array<{ label: string; colIndex: number }> = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const firstDay = new Date(week[0].date + "T12:00:00");
      const month = firstDay.getMonth();
      if (month !== lastMonth) {
        headers.push({ label: MONTH_LABELS[month], colIndex: wi });
        lastMonth = month;
      }
    });

    return {
      grid: weeks,
      monthHeaders: headers,
      totalActiveDays: activeDays,
      currentStreak: currentStreakCount,
      longestStreak: maxStreak,
      totalActions: totalActs,
    };
  }, [activityMap]);

  // Escala monocromática e verde estilo GitHub
  const getCellColor = (count: number) => {
    if (count === 0) return "bg-muted/40 hover:bg-muted/70 border border-border/30";
    if (count <= 2) return "bg-emerald-500/35 dark:bg-emerald-500/30 border border-emerald-500/40 hover:scale-110";
    if (count <= 5) return "bg-emerald-500/60 dark:bg-emerald-500/55 border border-emerald-500/60 hover:scale-110";
    if (count <= 10) return "bg-emerald-600/85 dark:bg-emerald-500/85 border border-emerald-600/80 hover:scale-110";
    return "bg-emerald-600 dark:bg-emerald-400 border border-emerald-400 shadow-sm hover:scale-110";
  };

  if (loading) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-56 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <Skeleton className="h-32 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-border/60 shadow-sm overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Consistência & Frequência de Estudos
              </CardTitle>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                Estilo GitHub
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Contabilizado a partir de <strong>1 questão resolvida</strong>, <strong>1 redação</strong> ou <strong>1 flashcard</strong> lido no dia.
            </CardDescription>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            {currentStreak > 0 ? (
              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-xs py-1 px-2.5">
                <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                {currentStreak} {currentStreak === 1 ? "dia seguido" : "dias seguidos"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs py-1 px-2 text-muted-foreground">
                Comece seu streak hoje!
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-0">
        {/* Métricas Rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>Dias Ativos</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {totalActiveDays} <span className="text-xs font-normal text-muted-foreground">dias</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span>Sequência Atual</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {currentStreak} <span className="text-xs font-normal text-muted-foreground">dias</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Trophy className="h-3.5 w-3.5 text-yellow-500" />
              <span>Maior Sequência</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {longestStreak} <span className="text-xs font-normal text-muted-foreground">dias</span>
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>Total de Ações</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {totalActions} <span className="text-xs font-normal text-muted-foreground">estudos</span>
            </p>
          </div>
        </div>

        {/* Grade do Mapa de Calor (Scroll Horizontal para Mobile e Telas Menores) */}
        <div className="relative p-4 rounded-xl bg-card/60 border border-border/50">
          <div className="overflow-x-auto pb-2 scrollbar-thin">
            <div className="min-w-[680px]">
              {/* Cabeçalho dos Meses */}
              <div className="flex mb-2 ml-7 relative h-4 text-[10px] text-muted-foreground font-medium">
                {monthHeaders.map((mh, idx) => (
                  <span
                    key={idx}
                    className="absolute"
                    style={{ left: `${mh.colIndex * 15}px` }}
                  >
                    {mh.label}
                  </span>
                ))}
              </div>

              {/* Corpo da Grade: Rótulos dos Dias + Colunas das Semanas */}
              <div className="flex items-start gap-1">
                {/* Rótulos dos Dias da Semana */}
                <div className="flex flex-col gap-[3px] pr-1.5 select-none pt-[1px]">
                  {DAY_LABELS.map((label, i) => (
                    <div key={i} className="h-[12px] flex items-center justify-end">
                      <span className="text-[9px] text-muted-foreground/80 font-medium w-5 text-right">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Colunas das Semanas (Grid de 7 Dias) */}
                <TooltipProvider delayDuration={50}>
                  <div className="flex gap-[3px]">
                    {grid.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-[3px]">
                        {week.map((day) => {
                          const isToday = day.date === new Date().toISOString().split("T")[0];
                          const hasStudied = day.count >= 1;

                          return (
                            <Tooltip key={day.date}>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "w-[12px] h-[12px] rounded-[2px] transition-all cursor-pointer",
                                    getCellColor(day.count),
                                    isToday && "ring-1 ring-primary ring-offset-1 ring-offset-background font-bold"
                                  )}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs p-3 max-w-xs space-y-1.5 shadow-xl">
                                <div className="font-semibold text-foreground flex items-center justify-between gap-3">
                                  <span>
                                    {new Date(day.date + "T12:00:00").toLocaleDateString("pt-BR", {
                                      weekday: "short",
                                      day: "numeric",
                                      month: "long",
                                      year: "numeric",
                                    })}
                                  </span>
                                  {isToday && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 text-primary border-primary/20">
                                      Hoje
                                    </Badge>
                                  )}
                                </div>

                                {hasStudied ? (
                                  <div className="space-y-1 pt-1 border-t border-border/50 text-[11px]">
                                    <p className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      {day.count} {day.count === 1 ? "atividade de estudo" : "atividades de estudo"}
                                    </p>
                                    <div className="text-muted-foreground flex flex-wrap gap-x-2.5 gap-y-0.5 pt-0.5">
                                      {day.questions > 0 && (
                                        <span className="flex items-center gap-1">
                                          <BookOpen className="w-3 h-3 text-primary" />
                                          {day.questions} quest.
                                        </span>
                                      )}
                                      {day.essays > 0 && (
                                        <span className="flex items-center gap-1">
                                          <PenTool className="w-3 h-3 text-purple-500" />
                                          {day.essays} red.
                                        </span>
                                      )}
                                      {day.flashcards > 0 && (
                                        <span className="flex items-center gap-1">
                                          <Layers className="w-3 h-3 text-amber-500" />
                                          {day.flashcards} flash.
                                        </span>
                                      )}
                                      {day.simulados > 0 && (
                                        <span className="flex items-center gap-1">
                                          <Trophy className="w-3 h-3 text-rose-500" />
                                          {day.simulados} sim.
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-muted-foreground pt-0.5">
                                    Nenhuma atividade de estudo registrada.
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Legenda Estilo GitHub no Rodapé */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1 text-[11px]">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              1 atividade por dia mantém sua ofensiva ativa
            </span>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[10px] mr-1">Menos</span>
              <div className="w-[11px] h-[11px] rounded-[2px] bg-muted/40 border border-border/30" title="0 atividades" />
              <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-500/35 border border-emerald-500/40" title="1-2 atividades" />
              <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-500/60 border border-emerald-500/60" title="3-5 atividades" />
              <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-600/85 border border-emerald-600/80" title="6-10 atividades" />
              <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-600 dark:bg-emerald-400 border border-emerald-400 shadow-sm" title="11+ atividades" />
              <span className="text-[10px] ml-1">Mais</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GitHubStudyHeatmap;
