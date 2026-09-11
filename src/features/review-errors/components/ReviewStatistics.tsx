import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown,
  CheckCircle2, 
  XCircle,
  Target,
  Flame,
  BarChart3,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getSubjectByDiscipline, getSubjectColor } from "@/lib/subjects";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

interface ReviewStatisticsProps {
  userId: string;
  refreshTrigger?: number;
}

interface DisciplineStats {
  discipline: string;
  displayName: string;
  color: string;
  totalErrors: number;
  resolved: number;
  pending: number;
  successRate: number;
}

interface WeeklyProgress {
  week: string;
  resolved: number;
  newErrors: number;
}

interface ReviewStats {
  totalReviewed: number;
  totalPending: number;
  overallSuccessRate: number;
  streakDays: number;
  avgResolutionDays: number;
  disciplineStats: DisciplineStats[];
  weeklyProgress: WeeklyProgress[];
  trend: 'up' | 'down' | 'stable';
}

const ReviewStatistics = ({ userId, refreshTrigger }: ReviewStatisticsProps) => {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetchStats();
  }, [userId, refreshTrigger]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Busca todas as tentativas dos últimos 30 dias
      const { data: allAttempts, error } = await supabase
        .from("question_attempts")
        .select("question_id, discipline, created_at, is_correct")
        .eq("user_id", userId)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!allAttempts || allAttempts.length === 0) {
        setStats({
          totalReviewed: 0,
          totalPending: 0,
          overallSuccessRate: 0,
          streakDays: 0,
          avgResolutionDays: 0,
          disciplineStats: [],
          weeklyProgress: [],
          trend: 'stable',
        });
        setLoading(false);
        return;
      }

      // Agrupa tentativas por question_id
      const attemptsByQuestion = new Map<string, typeof allAttempts>();
      for (const attempt of allAttempts) {
        const existing = attemptsByQuestion.get(attempt.question_id) || [];
        existing.push(attempt);
        attemptsByQuestion.set(attempt.question_id, existing);
      }

      // Calcula estatísticas
      const disciplineMap = new Map<string, { 
        totalErrors: number; 
        resolved: number; 
        pending: number;
        resolutionDays: number[];
      }>();

      let totalReviewed = 0;
      let totalPending = 0;
      let allResolutionDays: number[] = [];

      // Dados semanais
      const weeklyData = new Map<string, { resolved: number; newErrors: number }>();

      for (const [_questionId, attempts] of attemptsByQuestion) {
        const sortedAttempts = attempts.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        // Encontra o primeiro erro
        const firstError = sortedAttempts.find(a => !a.is_correct);
        if (!firstError) continue;

        const discipline = firstError.discipline || 'Geral';
        const errorDate = new Date(firstError.created_at);
        const weekKey = getWeekKey(errorDate);

        // Inicializa dados da disciplina
        if (!disciplineMap.has(discipline)) {
          disciplineMap.set(discipline, {
            totalErrors: 0,
            resolved: 0,
            pending: 0,
            resolutionDays: [],
          });
        }

        // Inicializa dados da semana
        if (!weeklyData.has(weekKey)) {
          weeklyData.set(weekKey, { resolved: 0, newErrors: 0 });
        }

        const discStats = disciplineMap.get(discipline)!;
        const weekStats = weeklyData.get(weekKey)!;
        
        discStats.totalErrors++;
        weekStats.newErrors++;

        // Verifica se foi resolvido (acertou depois do erro)
        const correctAfterError = sortedAttempts.find(a => {
          if (!a.is_correct) return false;
          return new Date(a.created_at) > errorDate;
        });

        if (correctAfterError) {
          discStats.resolved++;
          totalReviewed++;
          
          const resolvedDate = new Date(correctAfterError.created_at);
          const daysToResolve = Math.floor(
            (resolvedDate.getTime() - errorDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          discStats.resolutionDays.push(daysToResolve);
          allResolutionDays.push(daysToResolve);

          // Conta como resolvido na semana em que foi resolvido
          const resolvedWeekKey = getWeekKey(resolvedDate);
          if (!weeklyData.has(resolvedWeekKey)) {
            weeklyData.set(resolvedWeekKey, { resolved: 0, newErrors: 0 });
          }
          weeklyData.get(resolvedWeekKey)!.resolved++;
        } else {
          discStats.pending++;
          totalPending++;
        }
      }

      // Formata estatísticas por disciplina
      const disciplineStats: DisciplineStats[] = [];
      for (const [discipline, data] of disciplineMap) {
        const subject = getSubjectByDiscipline(discipline);
        disciplineStats.push({
          discipline,
          displayName: subject?.name || discipline,
          color: getSubjectColor(discipline),
          totalErrors: data.totalErrors,
          resolved: data.resolved,
          pending: data.pending,
          successRate: data.totalErrors > 0 
            ? Math.round((data.resolved / data.totalErrors) * 100) 
            : 0,
        });
      }

      // Ordena por taxa de sucesso (menor primeiro - precisa mais atenção)
      disciplineStats.sort((a, b) => a.successRate - b.successRate);

      // Formata dados semanais (últimas 4 semanas)
      const weeklyProgress: WeeklyProgress[] = [];
      const sortedWeeks = Array.from(weeklyData.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-4);
      
      for (const [week, data] of sortedWeeks) {
        weeklyProgress.push({
          week: formatWeekLabel(week),
          resolved: data.resolved,
          newErrors: data.newErrors,
        });
      }

      // Calcula tendência baseada nas últimas 2 semanas
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (weeklyProgress.length >= 2) {
        const lastWeek = weeklyProgress[weeklyProgress.length - 1];
        const prevWeek = weeklyProgress[weeklyProgress.length - 2];
        if (lastWeek.resolved > prevWeek.resolved) {
          trend = 'up';
        } else if (lastWeek.resolved < prevWeek.resolved) {
          trend = 'down';
        }
      }

      // Calcula média de dias para resolução
      const avgResolutionDays = allResolutionDays.length > 0
        ? Math.round(allResolutionDays.reduce((a, b) => a + b, 0) / allResolutionDays.length)
        : 0;

      // Taxa de sucesso geral
      const totalErrors = totalReviewed + totalPending;
      const overallSuccessRate = totalErrors > 0 
        ? Math.round((totalReviewed / totalErrors) * 100) 
        : 0;

      // Streak de dias revisando (simplificado)
      const { data: streakData } = await supabase
        .from("user_streaks")
        .select("current_streak")
        .eq("user_id", userId)
        .single();

      setStats({
        totalReviewed,
        totalPending,
        overallSuccessRate,
        streakDays: streakData?.current_streak || 0,
        avgResolutionDays,
        disciplineStats,
        weeklyProgress,
        trend,
      });
    } catch (error) {
      console.error("Error fetching review stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekKey = (date: Date): string => {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  };

  const formatWeekLabel = (weekKey: string): string => {
    const [_year, week] = weekKey.split('-W');
    return `Sem ${parseInt(week)}`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalReviewed}</p>
                  <p className="text-xs text-muted-foreground">Resolvidas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <XCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalPending}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.overallSuccessRate}%</p>
                  <p className="text-xs text-muted-foreground">Taxa de Sucesso</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                  <Calendar className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgResolutionDays}d</p>
                  <p className="text-xs text-muted-foreground">Média p/ Dominar</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Gráfico de progresso semanal */}
      {stats.weeklyProgress.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Progresso Semanal
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Questões resolvidas por semana
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5">
                  {stats.trend === 'up' && (
                    <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Melhorando
                    </Badge>
                  )}
                  {stats.trend === 'down' && (
                    <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <TrendingDown className="h-3 w-3 mr-1" />
                      Atenção
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[160px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.weeklyProgress}>
                    <XAxis 
                      dataKey="week" 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      axisLine={false}
                      width={30}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        fontSize: 12, 
                        borderRadius: 8,
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value: number, name: string) => [
                        value, 
                        name === 'resolved' ? 'Resolvidas' : 'Novos Erros'
                      ]}
                    />
                    <Bar dataKey="resolved" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Progresso por disciplina */}
      {stats.disciplineStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" />
                Progresso por Disciplina
              </CardTitle>
              <CardDescription className="text-xs">
                Taxa de resolução de erros por matéria
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.disciplineStats.map((disc) => (
                <div key={disc.discipline} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: disc.color }}
                      />
                      <span className="text-sm font-medium">{disc.displayName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {disc.resolved}/{disc.totalErrors}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={
                          disc.successRate >= 70 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : disc.successRate >= 40
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }
                      >
                        {disc.successRate}%
                      </Badge>
                    </div>
                  </div>
                  <Progress 
                    value={disc.successRate} 
                    className="h-2"
                    style={{ 
                      ['--progress-background' as string]: disc.color,
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default ReviewStatistics;
