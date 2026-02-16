import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDisciplineName } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface DisciplineBreakdownProps {
  userId?: string;
}

interface DisciplineStat {
  discipline: string;
  displayName: string;
  total: number;
  correct: number;
  accuracy: number;
  trend: "up" | "down" | "stable";
  color: string;
}

const DISCIPLINE_COLORS: Record<string, string> = {
  linguagens: "hsl(217, 91%, 50%)",
  matematica: "hsl(142, 76%, 40%)",
  humanas: "hsl(38, 92%, 50%)",
  natureza: "hsl(280, 67%, 55%)",
};

const DisciplineBreakdown = ({ userId }: DisciplineBreakdownProps) => {
  const [disciplines, setDisciplines] = useState<DisciplineStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: attempts } = await supabase
        .from("question_attempts")
        .select("discipline, is_correct, created_at")
        .eq("user_id", userId)
        .gte("created_at", fourteenDaysAgo.toISOString());

      const stats: Record<string, { total: number; correct: number; recentTotal: number; recentCorrect: number; prevTotal: number; prevCorrect: number }> = {};

      (attempts || []).forEach((a) => {
        const d = a.discipline || "outros";
        if (!stats[d]) stats[d] = { total: 0, correct: 0, recentTotal: 0, recentCorrect: 0, prevTotal: 0, prevCorrect: 0 };
        stats[d].total++;
        if (a.is_correct) stats[d].correct++;

        const date = new Date(a.created_at);
        if (date >= sevenDaysAgo) {
          stats[d].recentTotal++;
          if (a.is_correct) stats[d].recentCorrect++;
        } else {
          stats[d].prevTotal++;
          if (a.is_correct) stats[d].prevCorrect++;
        }
      });

      const result = Object.entries(stats)
        .map(([discipline, s]) => {
          const recentAcc = s.recentTotal > 0 ? (s.recentCorrect / s.recentTotal) * 100 : 0;
          const prevAcc = s.prevTotal > 0 ? (s.prevCorrect / s.prevTotal) * 100 : 0;
          const diff = recentAcc - prevAcc;

          return {
            discipline,
            displayName: formatDisciplineName(discipline),
            total: s.total,
            correct: s.correct,
            accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
            trend: (diff > 5 ? "up" : diff < -5 ? "down" : "stable") as "up" | "down" | "stable",
            color: DISCIPLINE_COLORS[discipline] || "hsl(var(--primary))",
          };
        })
        .sort((a, b) => b.total - a.total);

      setDisciplines(result);
      setLoading(false);
    };

    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="h-5 w-44 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-muted/50 animate-pulse rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (disciplines.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Por Disciplina
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
            Resolva questões para ver seu desempenho por disciplina
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Por Disciplina
        </CardTitle>
        <p className="text-xs text-muted-foreground">Últimos 14 dias</p>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-2.5">
        {disciplines.map((d, i) => {
          const TrendIcon = d.trend === "up" ? TrendingUp : d.trend === "down" ? TrendingDown : Minus;

          return (
            <motion.div
              key={d.discipline}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors"
            >
              {/* Radial gauge */}
              <div className="relative w-11 h-11 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke={d.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(d.accuracy / 100) * 94.2} 94.2`}
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
                  {d.accuracy}%
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{d.displayName}</span>
                  <div className={cn(
                    "flex items-center gap-0.5 text-[11px] font-medium",
                    d.trend === "up" ? "text-green-500" : d.trend === "down" ? "text-destructive" : "text-muted-foreground"
                  )}>
                    <TrendIcon className="h-3 w-3" />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-muted-foreground">{d.total} questões</span>
                  <span className="text-[11px] text-green-500">{d.correct} acertos</span>
                  <span className="text-[11px] text-destructive">{d.total - d.correct} erros</span>
                </div>
                {/* Mini bar */}
                <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${d.accuracy}%`, backgroundColor: d.color }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default DisciplineBreakdown;
