import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, BookOpen, Target, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

/**
 * Dashboard de estatísticas de desempenho do usuário
 * Mostra acertos, erros, disciplinas com mais erros/acertos e sugestões
 * Só exibe após usuário responder pelo menos 5 questões
 */
const Statistics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState(0);
  const [disciplineStats, setDisciplineStats] = useState<any[]>([]);
  const [topicStats, setTopicStats] = useState<any[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      await fetchStatistics(user.id);
    };

    checkAuth();
  }, [navigate]);

  const fetchStatistics = async (userId: string) => {
    try {
      // Busca todas as tentativas do usuário
      const { data: attempts, error } = await supabase
        .from("question_attempts")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;

      // Se não houver tentativas, apenas mostra estado vazio
      if (!attempts || attempts.length === 0) {
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
        name,
        correct: stats.correct,
        wrong: stats.wrong,
        total: stats.total,
        accuracy: ((stats.correct / stats.total) * 100).toFixed(1),
      }));

      // Ordena por taxa de erro (para mostrar onde precisa melhorar)
      disciplines.sort((a, b) => parseFloat(a.accuracy) - parseFloat(b.accuracy));
      setDisciplineStats(disciplines);

      // Agrupa por assunto (topic) os erros
      const topicMap = new Map();
      attempts.filter((a) => !a.is_correct && a.topic).forEach((attempt) => {
        const topic = attempt.topic;
        if (!topicMap.has(topic)) {
          topicMap.set(topic, { count: 0, discipline: attempt.discipline });
        }
        topicMap.get(topic).count++;
      });

      const topics = Array.from(topicMap.entries()).map(([name, data]: any) => ({
        name,
        count: data.count,
        discipline: data.discipline,
      }));

      topics.sort((a, b) => b.count - a.count);
      setTopicStats(topics.slice(0, 5)); // Top 5 assuntos com mais erros

      setLoading(false);
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Carregando estatísticas...</p>
        </div>
      </div>
    );
  }

  // Mostra mensagem amigável se ainda não houver tentativas
  if (totalAttempts === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center"
          >
            <BookOpen className="h-24 w-24 text-muted-foreground mb-6" />
            <h1 className="text-3xl font-bold mb-4">Comece a Praticar!</h1>
            <p className="text-muted-foreground text-lg mb-6 max-w-md">
              Você ainda não respondeu nenhuma questão. Vá para o Banco de Questões e comece a praticar para ver suas estatísticas aqui.
            </p>
            <Button onClick={() => navigate("/questions")} className="gap-2">
              <Target className="h-4 w-4" />
              Ir para o Banco de Questões
            </Button>
          </motion.div>
        </main>
      </div>
    );
  }

  const successRate = ((correctAnswers / totalAttempts) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-8">
            Estatísticas de Desempenho
          </h1>

          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                <CardTitle className="text-sm font-medium">Acertos vs Erros</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-xl font-bold">{correctAnswers}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-error" />
                    <span className="text-xl font-bold">{wrongAnswers}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grid de Disciplinas e Assuntos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Desempenho por Disciplina */}
            <Card>
              <CardHeader>
                <CardTitle>Desempenho por Disciplina</CardTitle>
                <CardDescription>
                  Veja seu desempenho em cada disciplina
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
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

            {/* Assuntos que precisam de atenção */}
            <Card>
              <CardHeader>
                <CardTitle>Assuntos que Precisam de Atenção</CardTitle>
                <CardDescription>
                  Foque nesses assuntos para melhorar seu desempenho
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topicStats.length > 0 ? (
                  <div className="space-y-4">
                    {topicStats.map((topic, index) => (
                      <div
                        key={topic.name}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-error/10 text-error font-bold flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{topic.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{topic.discipline}</p>
                          </div>
                        </div>
                        <span className="text-error font-bold ml-2 flex-shrink-0">{topic.count} erros</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Ótimo! Você ainda não tem assuntos com muitos erros.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Statistics;
