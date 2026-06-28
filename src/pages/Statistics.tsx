import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageLoader } from "@/components/ui/page-loader";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Target,
  AlertCircle,
  Lock,
  Crown,
  FileText,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import { formatDisciplineName } from "@/lib/formatters";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { usePremium } from "@/hooks/usePremium";
import PremiumLockScreen from "@/components/PremiumLockScreen";
import WeeklyComparison from "@/components/statistics/WeeklyComparison";

/**
 * Dashboard de estatísticas de desempenho do usuário
 * Mostra acertos, erros, disciplinas com mais erros/acertos e sugestões
 * Só exibe após usuário responder pelo menos 5 questões
 */
const Statistics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState(0);
  const [disciplineStats, setDisciplineStats] = useState<any[]>([]);
  const [topicStats, setTopicStats] = useState<any[]>([]);
  const [specificTopicStats, setSpecificTopicStats] = useState<any[]>([]); // Tópicos específicos extraídos por IA
  const [topicDisciplineFilter, setTopicDisciplineFilter] = useState<string>("all"); // Filtro de disciplina para tópicos
  const [periodFilter, setPeriodFilter] = useState<"all" | "week" | "month" | "today">("all");
  const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
  const [disciplineChartData, setDisciplineChartData] = useState<any[]>([]);
  
  // Novos estados para redações
  const [essayStats, setEssayStats] = useState<any[]>([]);
  const [essayCompetencyData, setEssayCompetencyData] = useState<any[]>([]);
  const [averageEssayScore, setAverageEssayScore] = useState(0);
  const [totalEssays, setTotalEssays] = useState(0);
  
  // Estado para sugestão de IA
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [loadingAiSuggestion, setLoadingAiSuggestion] = useState(false);
  
  // Estado para comparação semanal
  const [weeklyComparisonData, setWeeklyComparisonData] = useState<{
    currentWeek: { questions: number; correct: number; accuracy: number };
    previousWeek: { questions: number; correct: number; accuracy: number };
  } | null>(null);

  useEffect(() => {
    let userId: string | null = null;

    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      userId = user.id;
      await fetchStatistics(user.id);
      await fetchEssayStats(user.id);
    };

    checkAuth();

    // Configura realtime para atualizar estatísticas automaticamente
    const attemptsChannel = supabase
      .channel("statistics_attempts_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "question_attempts",
        },
        async () => {
          // Atualiza estatísticas quando nova tentativa é registrada
          if (userId) {
            await fetchStatistics(userId);
          }
        }
      )
      .subscribe();

    const essaysChannel = supabase
      .channel("statistics_essays_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "essays",
        },
        async () => {
          // Atualiza estatísticas de redações
          if (userId) {
            await fetchEssayStats(userId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attemptsChannel);
      supabase.removeChannel(essaysChannel);
    };
  }, [navigate]);

  // Recarrega estatísticas quando o filtro de período muda
  useEffect(() => {
    const reloadStats = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await fetchStatistics(user.id);
        await fetchEssayStats(user.id);
      }
    };

    if (!loading) {
      reloadStats();
    }
  }, [periodFilter]);

  const fetchEssayStats = async (userId: string) => {
    try {
      let query = supabase
        .from("essays")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "corrected")
        .order("created_at", { ascending: true });

      const { data: essays, error } = await query;

      if (error) throw error;

      if (!essays || essays.length === 0) {
        setTotalEssays(0);
        return;
      }

      setTotalEssays(essays.length);

      // Calcular média de nota
      const totalScore = essays.reduce((acc, e) => acc + (e.score_total || 0), 0);
      setAverageEssayScore(Math.round(totalScore / essays.length));

      // Preparar dados para gráfico de evolução
      const evolutionData = essays.map((essay, index) => ({
        redacao: `Redação ${index + 1}`,
        nota: essay.score_total || 0,
        data: new Date(essay.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      }));
      setEssayStats(evolutionData);

      // Calcular médias por competência
      const competencyAverages = [
        { competencia: "C1 - Norma Culta", media: 0, fullMark: 200 },
        { competencia: "C2 - Tema", media: 0, fullMark: 200 },
        { competencia: "C3 - Argumentação", media: 0, fullMark: 200 },
        { competencia: "C4 - Coesão", media: 0, fullMark: 200 },
        { competencia: "C5 - Proposta", media: 0, fullMark: 200 },
      ];

      essays.forEach((essay) => {
        competencyAverages[0].media += essay.score_competency_1 || 0;
        competencyAverages[1].media += essay.score_competency_2 || 0;
        competencyAverages[2].media += essay.score_competency_3 || 0;
        competencyAverages[3].media += essay.score_competency_4 || 0;
        competencyAverages[4].media += essay.score_competency_5 || 0;
      });

      competencyAverages.forEach((c) => {
        c.media = Math.round(c.media / essays.length);
      });

      setEssayCompetencyData(competencyAverages);
    } catch (error) {
      console.error("Erro ao buscar estatísticas de redações:", error);
    }
  };

  const fetchStatistics = async (userId: string) => {
    try {

      // Calcula data de início baseado no filtro
      let startDate = null;
      const now = new Date();

      if (periodFilter === "today") {
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      } else if (periodFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString();
      } else if (periodFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString();
      }

      // Busca tentativas do usuário com filtro de período
      let query = supabase.from("question_attempts").select("*").eq("user_id", userId);

      if (startDate) {
        query = query.gte("created_at", startDate);
      }

      const { data: attempts, error } = await query;

      console.log("Tentativas encontradas:", attempts?.length || 0, attempts);

      if (error) {
        console.error("Erro ao buscar tentativas:", error);
        throw error;
      }

      // Se não houver tentativas, apenas mostra estado vazio
      if (!attempts || attempts.length === 0) {
        console.log("Nenhuma tentativa encontrada para este usuário");
        setTotalAttempts(0);
        setLoading(false);
        return;
      }

      // Calcula estatísticas gerais
      setTotalAttempts(attempts.length);
      const correct = attempts.filter((a) => a.is_correct).length;
      const wrong = attempts.length - correct;
      setCorrectAnswers(correct);
      setWrongAnswers(wrong);

      // Agrupa por disciplina
      const disciplineMap = new Map();
      attempts.forEach((attempt) => {
        const disc = attempt.discipline;
        if (!disciplineMap.has(disc)) {
          disciplineMap.set(disc, { correct: 0, wrong: 0, total: 0 });
        }
        const stats = disciplineMap.get(disc);
        stats.total++;
        if (attempt.is_correct) {
          stats.correct++;
        } else {
          stats.wrong++;
        }
      });

      const disciplines = Array.from(disciplineMap.entries()).map(([name, stats]: any) => ({
        name: formatDisciplineName(name),
        correct: stats.correct,
        wrong: stats.wrong,
        total: stats.total,
        accuracy: ((stats.correct / stats.total) * 100).toFixed(1),
      }));

      // Ordena por taxa de erro (para mostrar onde precisa melhorar)
      disciplines.sort((a, b) => parseFloat(a.accuracy) - parseFloat(b.accuracy));
      setDisciplineStats(disciplines);

      // Agrupa erros por disciplina (não por topic/assunto)
      const errorsByDiscipline = new Map();
      attempts
        .filter((a) => !a.is_correct)
        .forEach((attempt) => {
          const disc = attempt.discipline;
          if (!errorsByDiscipline.has(disc)) {
            errorsByDiscipline.set(disc, 0);
          }
          errorsByDiscipline.set(disc, errorsByDiscipline.get(disc) + 1);
        });

      const disciplineErrors = Array.from(errorsByDiscipline.entries()).map(([name, count]: any) => ({
        name: formatDisciplineName(name),
        count,
      }));

      disciplineErrors.sort((a, b) => b.count - a.count);
      setTopicStats(disciplineErrors.slice(0, 5)); // Top 5 disciplinas com mais erros

      // Agrupa por tópico específico (extraído pela IA)
      const topicMap = new Map<string, { correct: number; wrong: number; total: number; discipline: string }>();
      attempts.forEach((attempt) => {
        if (attempt.topic && attempt.topic.length > 0 && attempt.topic.length < 100) {
          const key = `${attempt.topic}|${attempt.discipline}`;
          if (!topicMap.has(key)) {
            topicMap.set(key, { correct: 0, wrong: 0, total: 0, discipline: attempt.discipline });
          }
          const stats = topicMap.get(key)!;
          stats.total++;
          if (attempt.is_correct) {
            stats.correct++;
          } else {
            stats.wrong++;
          }
        }
      });

      const specificTopics = Array.from(topicMap.entries())
        .map(([key, stats]) => {
          const [topic, discipline] = key.split("|");
          return {
            topic,
            discipline: formatDisciplineName(discipline),
            correct: stats.correct,
            wrong: stats.wrong,
            total: stats.total,
            accuracy: stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : "0",
          };
        })
        .filter(t => t.total >= 2) // Mínimo de 2 questões para aparecer
        .sort((a, b) => parseFloat(a.accuracy) - parseFloat(b.accuracy)); // Pior desempenho primeiro
      
      setSpecificTopicStats(specificTopics.slice(0, 10)); // Top 10 tópicos

      // Prepara dados para gráfico mensal (últimos 30 dias)
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return date.toISOString().split("T")[0];
      });

      const dailyAttempts = last30Days.map((date) => {
        const count = attempts.filter((a) => a.created_at.startsWith(date)).length;
        return {
          date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          questões: count,
        };
      });
      setMonthlyStats(dailyAttempts);

      // Prepara dados para gráfico por disciplina
      const disciplineChartMap = new Map();
      attempts.forEach((attempt) => {
        const disc = formatDisciplineName(attempt.discipline);
        if (!disciplineChartMap.has(disc)) {
          disciplineChartMap.set(disc, 0);
        }
        disciplineChartMap.set(disc, disciplineChartMap.get(disc) + 1);
      });

      const disciplineChart = Array.from(disciplineChartMap.entries()).map(([name, count]: any) => ({
        disciplina: name,
        questões: count,
      }));

      setDisciplineChartData(disciplineChart);

      // Calcular comparação semanal
      const comparisonNow = new Date();
      const oneWeekAgo = new Date(comparisonNow.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(comparisonNow.getTime() - 14 * 24 * 60 * 60 * 1000);

      // Fetch all attempts for comparison (without period filter)
      const { data: allAttempts } = await supabase
        .from("question_attempts")
        .select("*")
        .eq("user_id", userId)
        .gte("created_at", twoWeeksAgo.toISOString());

      if (allAttempts && allAttempts.length > 0) {
        const currentWeekAttempts = allAttempts.filter(
          (a) => new Date(a.created_at) >= oneWeekAgo
        );
        const previousWeekAttempts = allAttempts.filter(
          (a) => new Date(a.created_at) >= twoWeeksAgo && new Date(a.created_at) < oneWeekAgo
        );

        const currentWeekCorrect = currentWeekAttempts.filter((a) => a.is_correct).length;
        const previousWeekCorrect = previousWeekAttempts.filter((a) => a.is_correct).length;

        setWeeklyComparisonData({
          currentWeek: {
            questions: currentWeekAttempts.length,
            correct: currentWeekCorrect,
            accuracy: currentWeekAttempts.length > 0
              ? (currentWeekCorrect / currentWeekAttempts.length) * 100
              : 0,
          },
          previousWeek: {
            questions: previousWeekAttempts.length,
            correct: previousWeekCorrect,
            accuracy: previousWeekAttempts.length > 0
              ? (previousWeekCorrect / previousWeekAttempts.length) * 100
              : 0,
          },
        });
      }

      setLoading(false);
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      setLoading(false);
    }
  };

  const fetchAiSuggestion = async () => {
    setLoadingAiSuggestion(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Usuário não autenticado");
      }

      // Preparar dados para enviar à IA
      const statsData = {
        totalQuestions: totalAttempts,
        correctAnswers,
        wrongAnswers,
        successRate: ((correctAnswers / totalAttempts) * 100).toFixed(1),
        disciplineStats,
        topicStats,
        totalEssays,
        averageEssayScore,
        essayCompetencyData,
      };

      const response = await supabase.functions.invoke("ai-study-suggestion", {
        body: { stats: statsData },
      });

      if (response.error) throw response.error;

      setAiSuggestion(response.data.suggestion);
    } catch (error) {
      console.error("Erro ao buscar sugestão da IA:", error);
      setAiSuggestion("Não foi possível gerar sugestões no momento. Tente novamente mais tarde.");
    } finally {
      setLoadingAiSuggestion(false);
    }
  };

  // Verifica estados após terminar o carregamento para evitar piscadas
  const showEmptyState = !loading && !premiumLoading && totalAttempts === 0 && totalEssays === 0;
  const showLockState = !loading && !premiumLoading && !isPremium;

  // Mostra mensagem amigável se ainda não houver tentativas
  if (showEmptyState) {
    return (
      <PageLoader loading={loading || premiumLoading} message="Preparando estatísticas...">
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 app-layout-container">
          <Navbar />
          <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center"
            >
              <BookOpen className="h-24 w-24 text-muted-foreground mb-6" />
              <h1 className="text-3xl font-bold mb-4">Comece a Praticar!</h1>
              <p className="text-muted-foreground text-lg mb-6 max-w-md">
                Você ainda não respondeu nenhuma questão ou enviou redações. Comece a praticar para ver suas
                estatísticas aqui.
              </p>
              <Button onClick={() => navigate("/questions")} className="gap-2">
                <Target className="h-4 w-4" />
                Ir para o Banco de Questões
              </Button>
            </motion.div>
          </main>
        </div>
      </PageLoader>
    );
  }

  // Bloqueia acesso para usuários free
  if (showLockState) {
    return (
      <PageLoader loading={loading || premiumLoading} message="Preparando estatísticas...">
        <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 app-layout-container">
          <Navbar />
          <main className="max-w-4xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-20">
            <PremiumLockScreen
              title="Estatísticas Premium"
              description="Assine o plano Premium para acessar estatísticas detalhadas do seu desempenho"
              features={[
                {
                  title: "Análise Completa de Desempenho",
                  description: "Acompanhe sua evolução em todas as disciplinas",
                },
                {
                  title: "Gráficos e Histórico Completo",
                  description: "Visualize seu progresso ao longo do tempo",
                },
                {
                  title: "Sugestões Personalizadas com IA",
                  description: "Receba dicas de estudo baseadas no seu desempenho",
                },
                {
                  title: "Análise de Redações",
                  description: "Acompanhe a evolução das suas notas por competência",
                },
              ]}
            />
          </main>
        </div>
      </PageLoader>
    );
  }

  const successRate = totalAttempts > 0 ? ((correctAnswers / totalAttempts) * 100).toFixed(1) : "0";

  return (
    <PageLoader loading={loading || premiumLoading} message="Preparando estatísticas...">
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 app-layout-container">
        <Navbar />

        <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Estatísticas de Desempenho</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Acompanhe sua evolução e taxas de acerto</p>
              </div>
            </div>

            {/* Filtro de período */}
            <Tabs value={periodFilter} onValueChange={(v) => setPeriodFilter(v as any)} className="w-full sm:w-auto" data-tour="stats-period">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="today" className="text-xs sm:text-sm">
                  Hoje
                </TabsTrigger>
                <TabsTrigger value="week" className="text-xs sm:text-sm">
                  Semana
                </TabsTrigger>
                <TabsTrigger value="month" className="text-xs sm:text-sm">
                  Mês
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs sm:text-sm">
                  Tudo
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Cards de resumo - Questões e Redações */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" data-tour="stats-summary">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Questões</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAttempts}</div>
                <p className="text-xs text-muted-foreground">questões respondidas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Acerto</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{successRate}%</div>
                <Progress value={parseFloat(successRate)} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Redações Enviadas</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalEssays}</div>
                <p className="text-xs text-muted-foreground">redações corrigidas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Média Redações</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{averageEssayScore}</div>
                <p className="text-xs text-muted-foreground">pontos (máx. 1000)</p>
              </CardContent>
            </Card>
          </div>

          {/* Comparação Semanal */}
          {weeklyComparisonData && (
            <div className="mb-8">
              <WeeklyComparison data={weeklyComparisonData} />
            </div>
          )}

          {/* Sugestão de IA */}
          <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5" data-tour="stats-ai">
            <CardHeader className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
                  <CardTitle className="text-base sm:text-lg">Sugestões de Estudo com IA</CardTitle>
                </div>
                <Button 
                  onClick={fetchAiSuggestion} 
                  disabled={loadingAiSuggestion}
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  {loadingAiSuggestion ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar Sugestões
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                Análise personalizada baseada no seu desempenho em questões e redações
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiSuggestion ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{aiSuggestion}</div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Clique em "Gerar Sugestões" para receber dicas personalizadas baseadas nos seus dados de estudo.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Grid de Questões */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Desempenho por Disciplina */}
            <Card>
              <CardHeader>
                <CardTitle>Desempenho por Disciplina</CardTitle>
                <CardDescription>Veja seu desempenho em cada disciplina</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
                  {disciplineStats.length > 0 ? (
                    disciplineStats.map((disc) => (
                      <div key={disc.name}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3 flex-1">
                            {parseFloat(disc.accuracy) >= 70 ? (
                              <TrendingUp className="h-5 w-5 text-success flex-shrink-0" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-error flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{disc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {disc.total} questões • {disc.correct} acertos • {disc.wrong} erros
                              </p>
                            </div>
                          </div>
                          <span className="text-lg font-bold ml-2 flex-shrink-0">{disc.accuracy}%</span>
                        </div>
                        <Progress value={parseFloat(disc.accuracy)} />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Responda mais questões para ver estatísticas por disciplina
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Matérias que precisam de atenção */}
            <Card>
              <CardHeader>
                <CardTitle>Matérias que Precisam de Atenção</CardTitle>
                <CardDescription>Foque nessas disciplinas para melhorar seu desempenho</CardDescription>
              </CardHeader>
              <CardContent>
                {topicStats.length > 0 ? (
                  <div className="space-y-4">
                    {topicStats.map((item, index) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-error/10 text-error font-bold flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{item.name}</p>
                          </div>
                        </div>
                        <span className="text-error font-bold ml-2 flex-shrink-0">{item.count} erros</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Ótimo! Você ainda não tem matérias com muitos erros.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tópicos Específicos que Precisam de Atenção */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Assuntos Específicos
              <span className="text-sm font-normal text-muted-foreground ml-2">(identificados por IA)</span>
            </h2>
            
            {/* Filtro por disciplina */}
            {specificTopicStats.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Filtrar:</span>
                <select
                  value={topicDisciplineFilter}
                  onChange={(e) => setTopicDisciplineFilter(e.target.value)}
                  className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                >
                  <option value="all">Todas as disciplinas</option>
                  {[...new Set(specificTopicStats.map(t => t.discipline))].map(disc => (
                    <option key={disc} value={disc}>{disc}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {(() => {
            // Filtra os tópicos pela disciplina selecionada
            const filteredTopics = topicDisciplineFilter === "all" 
              ? specificTopicStats 
              : specificTopicStats.filter(t => t.discipline === topicDisciplineFilter);
            
            return filteredTopics.length > 0 ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Gráfico de barras - Tópicos com mais erros */}
                <Card>
                  <CardHeader>
                    <CardTitle>Tópicos com Mais Erros</CardTitle>
                    <CardDescription>Assuntos que precisam de mais atenção</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        layout="vertical"
                        data={filteredTopics.slice(0, 8).map(t => ({
                          topic: t.topic.length > 20 ? t.topic.substring(0, 20) + "..." : t.topic,
                          erros: t.wrong,
                          acertos: t.correct,
                        }))}
                        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" horizontal={true} vertical={false} />
                        <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <YAxis 
                          type="category" 
                          dataKey="topic" 
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                          width={75}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.5rem",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="erros" stackId="a" fill="hsl(var(--destructive))" name="Erros" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="acertos" stackId="a" fill="hsl(var(--success, 142 76% 36%))" name="Acertos" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Lista de tópicos com taxa de acerto */}
                <Card>
                  <CardHeader>
                    <CardTitle>Desempenho por Assunto</CardTitle>
                    <CardDescription>Taxa de acerto em cada tópico identificado pela IA</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                      {filteredTopics.map((item, index) => {
                        const accuracy = parseFloat(item.accuracy);
                        const colorClass = accuracy < 50 
                          ? "text-red-600 bg-red-500/10" 
                          : accuracy < 70 
                            ? "text-amber-600 bg-amber-500/10" 
                            : "text-green-600 bg-green-500/10";
                        const progressColor = accuracy < 50 
                          ? "bg-red-500" 
                          : accuracy < 70 
                            ? "bg-amber-500" 
                            : "bg-green-500";
                        
                        return (
                          <div key={`${item.topic}-${index}`} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${colorClass}`}>
                                  {item.accuracy}%
                                </span>
                                <span className="text-sm font-medium truncate">{item.topic}</span>
                              </div>
                              <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                                {item.discipline}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${progressColor} transition-all`} 
                                  style={{ width: `${accuracy}%` }} 
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-20 text-right">
                                {item.correct}/{item.total} acertos
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Resumo de Áreas Críticas */}
              <Card className="mb-8 border-destructive/20 bg-gradient-to-br from-destructive/5 to-background">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    Áreas Críticas para Revisão
                  </CardTitle>
                  <CardDescription>
                    Tópicos com menos de 50% de acerto que precisam de atenção urgente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredTopics.filter(t => parseFloat(t.accuracy) < 50).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredTopics
                        .filter(t => parseFloat(t.accuracy) < 50)
                        .slice(0, 6)
                        .map((item, index) => (
                          <div 
                            key={`critical-${item.topic}-${index}`}
                            className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                          >
                            <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.topic}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.discipline} • {item.accuracy}% de acerto
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-green-600">Parabéns!</p>
                        <p className="text-sm text-muted-foreground">
                          Você não tem tópicos com taxa de acerto abaixo de 50%.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Análise de Tópicos por IA</h3>
                  <p className="text-muted-foreground max-w-md mb-4">
                    À medida que você responde questões, nossa IA identifica automaticamente os assuntos específicos 
                    de cada pergunta para mostrar seu desempenho detalhado aqui.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Continue praticando no <span className="font-medium text-primary">Banco de Questões</span> para 
                    começar a ver estatísticas por tópico. Mínimo de 2 questões por tópico.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          )()}

          {/* Gráficos de Questões */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Gráfico de questões respondidas por dia (últimos 30 dias) */}
            <Card>
              <CardHeader>
                <CardTitle>Questões Respondidas</CardTitle>
                <CardDescription>Evolução diária nos últimos 30 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={monthlyStats} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorQuestoes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      interval="preserveStartEnd"
                      minTickGap={50}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="questões"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#colorQuestoes)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gráfico de questões por disciplina */}
            <Card>
              <CardHeader>
                <CardTitle>Questões por Disciplina</CardTitle>
                <CardDescription>Distribuição das suas práticas</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={disciplineChartData} margin={{ top: 5, right: 5, left: -20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                    <XAxis
                      dataKey="disciplina"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="questões" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Seção de Redações */}
          {totalEssays > 0 && (
            <>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Estatísticas de Redações
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Gráfico de evolução de notas */}
                <Card>
                  <CardHeader>
                    <CardTitle>Evolução das Notas</CardTitle>
                    <CardDescription>Acompanhe seu progresso nas redações</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={essayStats} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" vertical={false} />
                        <XAxis
                          dataKey="redacao"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                          tickLine={false}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <YAxis
                          domain={[0, 1000]}
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.5rem",
                            fontSize: "12px",
                          }}
                          formatter={(value: number) => [`${value} pontos`, "Nota"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="nota"
                          stroke="hsl(var(--chart-2))"
                          strokeWidth={2.5}
                          dot={{ fill: "hsl(var(--chart-2))", r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Gráfico radar de competências */}
                <Card>
                  <CardHeader>
                    <CardTitle>Média por Competência</CardTitle>
                    <CardDescription>Seu desempenho nas 5 competências do ENEM</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <RadarChart data={essayCompetencyData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis
                          dataKey="competencia"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                        />
                        <PolarRadiusAxis
                          domain={[0, 200]}
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                        />
                        <Radar
                          name="Média"
                          dataKey="media"
                          stroke="hsl(var(--chart-2))"
                          fill="hsl(var(--chart-2))"
                          fillOpacity={0.3}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.5rem",
                            fontSize: "12px",
                          }}
                          formatter={(value: number) => [`${value} / 200`, "Média"]}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </motion.div>
      </main>
    </div>
  </PageLoader>
  );
};

export default Statistics;
