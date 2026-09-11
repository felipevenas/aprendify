import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Target,
  Lightbulb,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSimulados, Simulado, SimuladoResult, SimuladoAnswer } from "../hooks/useSimulados";
import { formatDisciplineName } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ShareResultsButton } from "../components/ShareResultsButton";
import TRIScoreDisplay from "../components/TRIScoreDisplay";

interface QuestionWithAnswer {
  question_index: number;
  question_id: string;
  discipline: string;
  selected_answer: string | null;
  correct_answer: string;
  is_correct: boolean | null;
  difficulty?: string;
  question_data?: {
    title: string;
    context: string | null;
    alternatives: Array<{ letter: string; text: string }>;
    difficulty?: string;
  };
}

/**
 * Simulado results page
 * Shows detailed analysis of performance with strengths, weaknesses and tips
 */
const SimuladoResults = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getSimulado, getSimuladoResults, getSimuladoAnswers } = useSimulados();

  const [simulado, setSimulado] = useState<Simulado | null>(null);
  const [results, setResults] = useState<SimuladoResult | null>(null);
  const [answers, setAnswers] = useState<QuestionWithAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  useEffect(() => {
    const loadResults = async () => {
      if (!id) return;

      try {
        const [sim, res, ans] = await Promise.all([
          getSimulado(id),
          getSimuladoResults(id),
          getSimuladoAnswers(id)
        ]);

        if (!sim) {
          navigate("/simulados");
          return;
        }

        setSimulado(sim);
        setResults(res);

        // Fetch question details for answers
        const questionIds = ans.map(a => a.question_id);
        const { data: questionsData } = await supabase
          .from("enem_questions")
          .select("id, title, context, alternatives, difficulty")
          .in("id", questionIds);

        const questionsMap = new Map(questionsData?.map(q => [q.id, {
          title: q.title,
          context: q.context,
          alternatives: Array.isArray(q.alternatives) 
            ? q.alternatives as unknown as Array<{ letter: string; text: string }>
            : [],
          difficulty: q.difficulty
        }]) || []);

        const answersWithData: QuestionWithAnswer[] = ans.map(a => {
          const qData = questionsMap.get(a.question_id);
          return {
            ...a,
            difficulty: qData?.difficulty,
            question_data: qData
          };
        });

        setAnswers(answersWithData);
      } catch (error) {
        console.error("Error loading results:", error);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [id, getSimulado, getSimuladoResults, getSimuladoAnswers, navigate]);

  const toggleQuestion = (index: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedQuestions(newExpanded);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!simulado || !results) {
    return null;
  }

  const total = results.total_correct + results.total_incorrect + results.total_unanswered;
  const percentage = total > 0 ? Math.round((results.total_correct / total) * 100) : 0;

  // Calculate duration
  const startTime = new Date(simulado.started_at);
  const endTime = simulado.finished_at ? new Date(simulado.finished_at) : new Date();
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  // Get discipline performance from answers
  const disciplineStats = answers.reduce((acc, ans) => {
    const discipline = ans.discipline;
    if (!acc[discipline]) {
      acc[discipline] = { correct: 0, incorrect: 0, unanswered: 0 };
    }
    if (ans.selected_answer === null) {
      acc[discipline].unanswered++;
    } else if (ans.is_correct) {
      acc[discipline].correct++;
    } else {
      acc[discipline].incorrect++;
    }
    return acc;
  }, {} as Record<string, { correct: number; incorrect: number; unanswered: number }>);

  // Wrong answers for review
  const wrongAnswers = answers.filter(a => a.is_correct === false);
  const displayedQuestions = showAllQuestions ? wrongAnswers : wrongAnswers.slice(0, 5);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-8"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/simulados")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Resultado do Simulado</h1>
            <p className="text-muted-foreground">
              {simulado.finished_at && format(new Date(simulado.finished_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Score Overview */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-muted-foreground mb-2">Aproveitamento Geral</p>
                <div className="text-5xl font-bold text-primary">{percentage}%</div>
              </div>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-2 text-green-600 mb-1">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-2xl font-bold">{results.total_correct}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Acertos</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-2 text-red-500 mb-1">
                    <XCircle className="h-5 w-5" />
                    <span className="text-2xl font-bold">{results.total_incorrect}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Erros</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MinusCircle className="h-5 w-5" />
                    <span className="text-2xl font-bold">{results.total_unanswered}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Em branco</p>
                </div>
              </div>
            </div>
          </div>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Tempo: {hours}h {minutes}min</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <span>{simulado.total_questions} questões</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TRI Score Card */}
        <TRIScoreDisplay answers={answers} showDetails={true} />

        {/* Discipline Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Desempenho por Área</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(disciplineStats).map(([discipline, stats]) => {
              const total = stats.correct + stats.incorrect + stats.unanswered;
              const perc = total > 0 ? Math.round((stats.correct / total) * 100) : 0;
              return (
                <div key={discipline} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{formatDisciplineName(discipline)}</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.correct}/{total} ({perc}%)
                    </span>
                  </div>
                  <Progress 
                    value={perc} 
                    className={cn(
                      "h-2",
                      perc >= 70 && "[&>div]:bg-green-500",
                      perc < 50 && "[&>div]:bg-red-500"
                    )}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Strengths and Weaknesses */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Strengths */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Pontos Fortes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.strengths && results.strengths.length > 0 ? (
                <div className="space-y-2">
                  {results.strengths.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-green-500/10">
                      <span>{formatDisciplineName(s.discipline)}</span>
                      <Badge variant="secondary" className="bg-green-500/20 text-green-600">
                        {s.percentage}%
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Continue praticando para identificar suas áreas de destaque!
                </p>
              )}
            </CardContent>
          </Card>

          {/* Weaknesses */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                Áreas para Melhorar
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.weaknesses && results.weaknesses.length > 0 ? (
                <div className="space-y-2">
                  {results.weaknesses.map((w, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-red-500/10">
                      <span>{formatDisciplineName(w.discipline)}</span>
                      <Badge variant="secondary" className="bg-red-500/20 text-red-600">
                        {w.percentage}%
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Excelente! Nenhuma área crítica identificada.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Tips */}
        {results.tips && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Dicas de Estudo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {results.tips.split('\n').map((paragraph, idx) => (
                  paragraph.trim() && <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wrong Answers Review */}
        {wrongAnswers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Questões para Revisar</CardTitle>
              <CardDescription>
                Veja as questões que você errou e entenda a resposta correta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {displayedQuestions.map((answer, idx) => (
                <Collapsible
                  key={answer.question_id}
                  open={expandedQuestions.has(idx)}
                  onOpenChange={() => toggleQuestion(idx)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{answer.question_index + 1}</Badge>
                        <span className="text-sm">{formatDisciplineName(answer.discipline)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-red-500">Sua: {answer.selected_answer?.toUpperCase()}</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-green-600">Correta: {answer.correct_answer.toUpperCase()}</span>
                        </div>
                        {expandedQuestions.has(idx) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {answer.question_data && (
                      <div className="p-4 border border-t-0 rounded-b-lg bg-muted/30 space-y-4">
                        <p className="font-medium">{answer.question_data.title}</p>
                        {answer.question_data.context && (
                          <p className="text-sm text-muted-foreground">
                            {answer.question_data.context.substring(0, 300)}...
                          </p>
                        )}
                        <div className="space-y-2">
                          {answer.question_data.alternatives.map((alt) => (
                            <div
                              key={alt.letter}
                              className={cn(
                                "p-3 rounded-lg text-sm",
                                alt.letter === answer.correct_answer && "bg-green-500/10 border border-green-500/30",
                                alt.letter === answer.selected_answer && alt.letter !== answer.correct_answer && "bg-red-500/10 border border-red-500/30"
                              )}
                            >
                              <span className="font-bold mr-2">{alt.letter.toUpperCase()})</span>
                              {alt.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}

              {wrongAnswers.length > 5 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAllQuestions(!showAllQuestions)}
                >
                  {showAllQuestions 
                    ? "Mostrar menos" 
                    : `Ver todas as ${wrongAnswers.length} questões erradas`}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" onClick={() => navigate("/simulados")}>
            Voltar aos Simulados
          </Button>
          <ShareResultsButton
            percentage={percentage}
            totalCorrect={results.total_correct}
            totalQuestions={total}
            disciplineStats={disciplineStats}
            simuladoType={simulado.type.includes("official") ? "Simulado ENEM Oficial" : "Simulado ENEM"}
          />
          <Button onClick={() => navigate("/simulados")}>
            Fazer Novo Simulado
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export const SimuladoResultsPage = SimuladoResults;
export default SimuladoResults;
