import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, CheckCircle, Grid3X3, Loader2, AlertCircle } from "lucide-react";
import { SimuladoTimer } from "../components/SimuladoTimer";
import { SimuladoProgress } from "../components/SimuladoProgress";
import { SimuladoQuestion } from "../components/SimuladoQuestion";
import { useSimulados, Simulado, SimuladoAnswer } from "../hooks/useSimulados";
import { useStreakContext } from "@/contexts/StreakContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuestionData {
  id: string;
  title: string;
  context: string | null;
  alternatives: Array<{ letter: string; text: string }>;
  alternatives_introduction: string | null;
  discipline: string;
  year: string;
  index: number;
  files: string[] | null;
  correct_alternative: string;
}

/**
 * Active simulado page
 * As questões já foram pré-carregadas pelo useSimuladoPreparation antes da navegação
 */
const SimuladoActive = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    getSimulado, 
    getSimuladoAnswers, 
    saveAnswer,
    finishSimulado, 
    abandonSimulado 
  } = useSimulados();
  const { recordQuestionAnswered } = useStreakContext();

  const [simulado, setSimulado] = useState<Simulado | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [showGridView, setShowGridView] = useState(false);
  const [finishing, setFinishing] = useState(false);

  /**
   * Carrega o simulado e as questões pré-inicializadas
   */
  useEffect(() => {
    let isMounted = true;

    const loadSimulado = async () => {
      if (!id) return;

      try {
        const sim = await getSimulado(id);
        
        if (!isMounted) return;

        if (!sim) {
          toast.error("Simulado não encontrado");
          navigate("/simulados");
          return;
        }

        if (sim.status === "completed") {
          navigate(`/simulados/${id}/resultado`);
          return;
        }

        setSimulado(sim);
        
        // As questões foram pré-carregadas pelo useSimuladoPreparation
        // Buscar as respostas/questões já inicializadas
        const existingAnswers = await getSimuladoAnswers(sim.id);
        
        if (!isMounted) return;
        
        console.log(`[SimuladoActive] Found ${existingAnswers.length} pre-loaded answers`);

        if (existingAnswers.length === 0) {
          setLoadingError(
            "Nenhuma questão foi carregada para este simulado. " +
            "Por favor, volte e inicie um novo simulado."
          );
          setLoading(false);
          return;
        }

        // Verificar se temos todas as questões esperadas
        if (existingAnswers.length < sim.total_questions) {
          setLoadingError(
            `Apenas ${existingAnswers.length} de ${sim.total_questions} questões foram carregadas. ` +
            "Por favor, volte e inicie um novo simulado."
          );
          setLoading(false);
          return;
        }

        // Buscar detalhes das questões baseado nos IDs
        const questionIds = existingAnswers.map(a => a.question_id);
        const loadedQuestions = await loadQuestionDetails(questionIds, existingAnswers);

        if (!isMounted) return;

        if (loadedQuestions.length === 0) {
          setLoadingError("Erro ao carregar detalhes das questões. Tente novamente.");
          setLoading(false);
          return;
        }

        setQuestions(loadedQuestions);

        // Mapear respostas já respondidas
        const answersMap: Record<number, string> = {};
        existingAnswers.forEach(a => {
          if (a.selected_answer) {
            answersMap[a.question_index] = a.selected_answer;
          }
        });
        setAnswers(answersMap);
        
      } catch (error) {
        console.error("Error loading simulado:", error);
        if (isMounted) {
          setLoadingError("Erro ao carregar simulado. Tente novamente.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadSimulado();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /**
   * Carrega detalhes das questões (do banco local ou reconstruindo da API)
   */
  const loadQuestionDetails = async (
    questionIds: string[],
    answers: SimuladoAnswer[]
  ): Promise<QuestionData[]> => {
    const questions: QuestionData[] = [];

    // Separar IDs locais (uuid) vs IDs da API (api-year-discipline-index)
    const localIds = questionIds.filter(id => !id.startsWith("api-"));
    const apiIds = questionIds.filter(id => id.startsWith("api-"));

    // Buscar questões do banco local
    if (localIds.length > 0) {
      const { data, error } = await supabase
        .from("enem_questions")
        .select("*")
        .in("id", localIds);

      if (!error && data) {
        for (const q of data) {
          questions.push({
            id: q.id,
            title: q.title,
            context: q.context,
            alternatives: Array.isArray(q.alternatives)
              ? (q.alternatives as unknown as Array<{ letter: string; text: string }>)
              : [],
            alternatives_introduction: q.alternatives_introduction,
            discipline: q.discipline,
            year: q.year,
            index: q.index,
            files: q.files,
            correct_alternative: q.correct_alternative,
          });
        }
      }
    }

    // Para questões da API, precisamos buscar novamente
    // Agrupa por ano para fazer menos requisições
    const apiQuestionsByYear = new Map<string, string[]>();
    for (const id of apiIds) {
      // Format: api-{year}-{discipline}-{index}
      const parts = id.split("-");
      if (parts.length >= 3) {
        const year = parts[1];
        if (!apiQuestionsByYear.has(year)) {
          apiQuestionsByYear.set(year, []);
        }
        apiQuestionsByYear.get(year)!.push(id);
      }
    }

    // Buscar questões da API por ano com paginação
    for (const [year, ids] of apiQuestionsByYear) {
      try {
        let offset = 0;
        const pageSize = 50;
        let hasMore = true;
        const yearQuestions: any[] = [];

        // Paginar para buscar todas as questões do ano
        while (hasMore) {
          const response = await fetch(
            `https://api.enem.dev/v1/exams/${year}/questions?limit=${pageSize}&offset=${offset}`
          );
          
          if (!response.ok) {
            console.error(`[SimuladoActive] API error ${response.status} for year ${year}`);
            break;
          }

          const data = await response.json();
          
          if (!data.questions || data.questions.length === 0) {
            hasMore = false;
            break;
          }

          yearQuestions.push(...data.questions);
          hasMore = data.questions.length >= pageSize;
          offset += pageSize;

          // Rate limiting - aguardar entre requisições
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 1100));
          }
        }

        // Mapear questões encontradas
        for (const q of yearQuestions) {
          const qId = `api-${year}-${q.discipline}-${q.index}`;
          
          if (ids.includes(qId)) {
            questions.push({
              id: qId,
              title: q.title || "",
              context: q.context || null,
              alternatives: Array.isArray(q.alternatives)
                ? q.alternatives.map((alt: any) => ({ letter: alt.letter || "", text: alt.text || "" }))
                : [],
              alternatives_introduction: q.alternativesIntroduction || null,
              discipline: mapAPIToLocal(q.discipline),
              year: String(q.year || year),
              index: q.index,
              files: Array.isArray(q.files) && q.files.length > 0 ? q.files : null,
              correct_alternative: q.correctAlternative || "",
            });
          }
        }
      } catch (error) {
        console.error(`[SimuladoActive] Error fetching year ${year}:`, error);
      }
    }

    // Ordenar na ordem correta baseado no question_index das answers
    const orderedQuestions: QuestionData[] = [];
    const questionMap = new Map(questions.map(q => [q.id, q]));
    
    // Ordenar answers por question_index
    const sortedAnswers = [...answers].sort((a, b) => a.question_index - b.question_index);
    
    for (const answer of sortedAnswers) {
      const question = questionMap.get(answer.question_id);
      if (question) {
        orderedQuestions.push(question);
      }
    }

    return orderedQuestions;
  };

  /**
   * Handle answer selection
   */
  const handleAnswerSelect = async (answer: string) => {
    if (!simulado || !questions[currentIndex]) return;

    const question = questions[currentIndex];
    const isNewAnswer = !answers[currentIndex];
    
    setAnswers(prev => ({ ...prev, [currentIndex]: answer }));

    await saveAnswer(
      simulado.id,
      question.id,
      currentIndex,
      question.discipline,
      answer,
      question.correct_alternative
    );

    if (isNewAnswer) {
      await recordQuestionAnswered();
    }
  };

  /**
   * Handle finishing the simulado
   */
  const handleFinish = async () => {
    if (!simulado) return;

    setFinishing(true);
    try {
      const success = await finishSimulado(simulado.id);
      if (success) {
        navigate(`/simulados/${simulado.id}/resultado`);
      }
    } catch (error) {
      console.error("Error finishing simulado:", error);
      toast.error("Erro ao finalizar simulado");
    } finally {
      setFinishing(false);
    }
  };

  /**
   * Handle abandoning the simulado
   */
  const handleAbandon = async () => {
    if (!simulado) return;
    await abandonSimulado(simulado.id);
    navigate("/simulados");
  };

  /**
   * Handle time up
   */
  const handleTimeUp = () => {
    toast.warning("Tempo esgotado! O simulado será finalizado.");
    handleFinish();
  };

  const answeredCount = Object.keys(answers).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Erro ao carregar simulado</h2>
              <p className="text-muted-foreground mb-6">{loadingError}</p>
              <Button onClick={() => navigate("/simulados")}>
                Voltar para Simulados
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!simulado) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
      {/* Timer */}
      <SimuladoTimer
        durationMinutes={simulado.duration_minutes}
        startedAt={simulado.started_at}
        onTimeUp={handleTimeUp}
      />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setShowExitDialog(true)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair do Simulado
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGridView(!showGridView)}
              className="hidden sm:flex"
            >
              <Grid3X3 className="h-4 w-4 mr-1" />
              Visão Geral
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowGridView(!showGridView)}
              className="sm:hidden"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setShowFinishDialog(true)}
              disabled={answeredCount === 0}
              className="bg-primary"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Finalizar</span>
              <span className="sm:hidden">Fim</span>
            </Button>
          </div>
        </div>

        {/* Progress */}
        <SimuladoProgress
          currentIndex={currentIndex}
          totalQuestions={questions.length}
          answeredCount={answeredCount}
        />

        {/* Grid View */}
        {showGridView && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-10 gap-2">
                {questions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowGridView(false);
                    }}
                    className={cn(
                      "h-10 w-10 rounded-lg text-sm font-medium transition-all",
                      idx === currentIndex && "ring-2 ring-primary",
                      answers[idx]
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Question */}
        {questions[currentIndex] ? (
          <SimuladoQuestion
            question={questions[currentIndex]}
            questionIndex={currentIndex}
            totalQuestions={questions.length}
            selectedAnswer={answers[currentIndex] || null}
            onAnswerSelect={handleAnswerSelect}
            onPrevious={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            onNext={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Carregando questão...
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Exit Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandonar Simulado?</AlertDialogTitle>
            <AlertDialogDescription>
              Se você sair agora, o simulado será marcado como abandonado.
              Seu progresso será salvo e você poderá ver as respostas que deu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar Simulado</AlertDialogCancel>
            <AlertDialogAction onClick={handleAbandon} className="bg-destructive text-destructive-foreground">
              Abandonar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finish Dialog */}
      <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Simulado?</AlertDialogTitle>
            <AlertDialogDescription>
              Você respondeu {answeredCount} de {questions.length} questões.
              {questions.length - answeredCount > 0 && (
                <span className="block mt-2 text-yellow-600">
                  Ainda restam {questions.length - answeredCount} questões não respondidas.
                </span>
              )}
              <span className="block mt-2">
                Após finalizar, você verá seu resultado e as respostas corretas.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar Respondendo</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinish} disabled={finishing}>
              {finishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Finalizar Simulado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/**
 * Map API discipline names to local database discipline names
 */
function mapAPIToLocal(apiDiscipline: string): string {
  const mapping: Record<string, string> = {
    "ciencias-humanas": "humanas",
    "ciencias-natureza": "natureza",
    "matematica": "matematica",
    "linguagens": "linguagens"
  };
  return mapping[apiDiscipline] || apiDiscipline;
}

export const SimuladoActivePage = SimuladoActive;
export default SimuladoActive;
