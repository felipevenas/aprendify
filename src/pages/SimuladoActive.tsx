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
import { Badge } from "@/components/ui/badge";
import { LogOut, CheckCircle, Grid3X3, Loader2 } from "lucide-react";
import { SimuladoTimer } from "@/components/simulados/SimuladoTimer";
import { SimuladoProgress } from "@/components/simulados/SimuladoProgress";
import { SimuladoQuestion } from "@/components/simulados/SimuladoQuestion";
import { useSimulados, Simulado, SimuladoAnswer, SimuladoType } from "@/hooks/useSimulados";
import { useStreak } from "@/hooks/useStreak";
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
 * Displays questions with timer and progress tracking
 */
const SimuladoActive = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    getSimulado, 
    getSimuladoAnswers, 
    saveAnswer, 
    initializeQuestions,
    finishSimulado, 
    abandonSimulado 
  } = useSimulados();
  const { recordQuestionAnswered } = useStreak();

  const [simulado, setSimulado] = useState<Simulado | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [showGridView, setShowGridView] = useState(false);
  const [finishing, setFinishing] = useState(false);

  /**
   * Load simulado data - agora as questões já devem estar pré-carregadas
   * O hook useSimuladoPreparation garante que as questões sejam carregadas
   * antes da navegação, então aqui só precisamos recuperar do banco
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
        
        // Buscar respostas já inicializadas pelo useSimuladoPreparation
        setLoadingQuestions(true);
        try {
          const existingAnswers = await getSimuladoAnswers(sim.id);
          
          if (!isMounted) return;
          
          console.log(`[SimuladoActive] Found ${existingAnswers.length} pre-loaded answers`);

          // Se já temos respostas, as questões foram pré-carregadas
          if (existingAnswers.length > 0) {
            // Carregar questões baseado nos IDs das respostas
            const disciplines = getDisciplinesForType(sim.type as SimuladoType);
            let fetchedQuestions: QuestionData[] = [];
            const yearNum = sim.year ? parseInt(sim.year) : 0;

            if (sim.year && yearNum >= 2024) {
              fetchedQuestions = await fetchLocalQuestionsByYear(sim.year, disciplines, sim.total_questions);
            } else if (sim.year && yearNum >= 2009 && yearNum < 2024) {
              fetchedQuestions = await fetchQuestionsFromAPI(sim.year, disciplines, sim.total_questions);
              if (fetchedQuestions.length === 0) {
                fetchedQuestions = await fetchLocalQuestions(disciplines, sim.total_questions);
              }
            } else {
              const apiQuestions = await fetchQuestionsFromAPI("2023", disciplines, Math.ceil(sim.total_questions / 2));
              const localQuestions = await fetchLocalQuestions(disciplines, Math.ceil(sim.total_questions / 2));
              fetchedQuestions = [...apiQuestions, ...localQuestions]
                .sort(() => Math.random() - 0.5)
                .slice(0, sim.total_questions);
            }

            // Ordenar questões pela ordem das respostas pré-carregadas
            const questionMap = new Map(fetchedQuestions.map(q => [q.id, q]));
            const orderedQuestions: QuestionData[] = [];
            
            existingAnswers.forEach(answer => {
              const question = questionMap.get(answer.question_id);
              if (question) {
                orderedQuestions.push(question);
              }
            });

            // Usar questões ordenadas ou fallback para todas as questões
            if (orderedQuestions.length > 0) {
              setQuestions(orderedQuestions);
            } else {
              setQuestions(fetchedQuestions);
            }

            // Mapear respostas existentes
            const answersMap: Record<number, string> = {};
            existingAnswers.forEach(a => {
              if (a.selected_answer) {
                answersMap[a.question_index] = a.selected_answer;
              }
            });
            setAnswers(answersMap);
          } else {
            // Fallback: Se não houver respostas, carregar questões normalmente
            console.warn("[SimuladoActive] No pre-loaded answers found, loading questions fresh");
            const disciplines = getDisciplinesForType(sim.type as SimuladoType);
            let fetchedQuestions: QuestionData[] = [];
            const yearNum = sim.year ? parseInt(sim.year) : 0;

            if (sim.year && yearNum >= 2024) {
              fetchedQuestions = await fetchLocalQuestionsByYear(sim.year, disciplines, sim.total_questions);
            } else if (sim.year && yearNum >= 2009 && yearNum < 2024) {
              fetchedQuestions = await fetchQuestionsFromAPI(sim.year, disciplines, sim.total_questions);
              if (fetchedQuestions.length === 0) {
                fetchedQuestions = await fetchLocalQuestions(disciplines, sim.total_questions);
              }
            } else {
              const apiQuestions = await fetchQuestionsFromAPI("2023", disciplines, Math.ceil(sim.total_questions / 2));
              const localQuestions = await fetchLocalQuestions(disciplines, Math.ceil(sim.total_questions / 2));
              fetchedQuestions = [...apiQuestions, ...localQuestions]
                .sort(() => Math.random() - 0.5)
                .slice(0, sim.total_questions);
            }

            if (fetchedQuestions.length > 0) {
              setQuestions(fetchedQuestions);
              await initializeQuestions(
                sim.id,
                fetchedQuestions.map(q => ({
                  id: q.id,
                  discipline: q.discipline,
                  correct_alternative: q.correct_alternative
                }))
              );
            }
          }
        } catch (error) {
          console.error("Error fetching questions:", error);
          if (isMounted) toast.error("Erro ao carregar questões");
        } finally {
          if (isMounted) setLoadingQuestions(false);
        }
      } catch (error) {
        console.error("Error loading simulado:", error);
        if (isMounted) toast.error("Erro ao carregar simulado");
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
   * Handle answer selection
   * Registra a resposta e atualiza o sistema de streak
   */
  const handleAnswerSelect = async (answer: string) => {
    if (!simulado || !questions[currentIndex]) return;

    const question = questions[currentIndex];
    
    // Verifica se é uma nova resposta (não uma alteração)
    const isNewAnswer = !answers[currentIndex];
    
    // Update local state immediately
    setAnswers(prev => ({ ...prev, [currentIndex]: answer }));

    // Save to database
    await saveAnswer(
      simulado.id,
      question.id,
      currentIndex,
      question.discipline,
      answer,
      question.correct_alternative
    );

    // Registra no streak apenas para novas respostas
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

  // Calculate answered count
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
        {loadingQuestions ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando questões...</p>
          </div>
        ) : questions[currentIndex] ? (
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
                Nenhuma questão encontrada para este simulado.
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
 * Get disciplines based on simulado type
 * Matches actual database discipline values: humanas, matematica, natureza
 */
function getDisciplinesForType(type: SimuladoType): string[] {
  switch (type) {
    case "official_day1":
      return ["humanas"];
    case "official_day2":
      return ["matematica", "natureza"];
    case "custom_naturezas":
      return ["natureza"];
    case "custom_humanas":
      return ["humanas"];
    case "custom_matematica":
      return ["matematica"];
    case "custom_mixed":
    default:
      return ["humanas", "matematica", "natureza"];
  }
}

/**
 * Map API discipline names to local database discipline names
 */
function mapAPIDisciplineToLocal(apiDiscipline: string): string {
  const mapping: Record<string, string> = {
    "ciencias-humanas": "humanas",
    "ciencias-natureza": "natureza",
    "matematica": "matematica",
    "linguagens": "linguagens"
  };
  return mapping[apiDiscipline] || apiDiscipline;
}

/**
 * Map local discipline names to API discipline names
 * Note: The ENEM API uses these exact values:
 * - "linguagens" (for languages and codes questions)
 * - "ciencias-humanas" (for human sciences)
 * - "ciencias-natureza" (for natural sciences)  
 * - "matematica" (for mathematics)
 */
function mapLocalDisciplineToAPI(localDiscipline: string): string {
  const mapping: Record<string, string> = {
    "humanas": "ciencias-humanas",
    "natureza": "ciencias-natureza",
    "matematica": "matematica",
    "linguagens": "linguagens"
  };
  return mapping[localDiscipline] || localDiscipline;
}

/**
 * Fetch questions from external ENEM API (years 2009-2023)
 * Note: API has max limit of 50 per request, so we paginate
 * Note: API discipline filter doesn't work properly, so we fetch all and filter client-side
 */
async function fetchQuestionsFromAPI(
  year: string, 
  disciplines: string[], 
  limit: number
): Promise<QuestionData[]> {
  try {
    // Convert local discipline names to API format for filtering
    const apiDisciplines = disciplines.map(d => mapLocalDisciplineToAPI(d));
    console.log(`[API] Looking for disciplines: ${apiDisciplines.join(", ")}`);
    
    // API has max limit of 50 per request, so we need to paginate
    const API_PAGE_LIMIT = 50;
    let allQuestions: any[] = [];
    let offset = 0;
    let hasMore = true;
    
    // Fetch pages until we have enough questions or no more available
    while (hasMore) {
      const url = `https://api.enem.dev/v1/exams/${year}/questions?limit=${API_PAGE_LIMIT}&offset=${offset}`;
      console.log(`[API] Fetching from: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API] Response not ok: ${response.status}`, errorText);
        break;
      }
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("[API] Error parsing JSON response:", parseError);
        break;
      }
      
      if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        hasMore = false;
        break;
      }
      
      allQuestions = [...allQuestions, ...data.questions];
      console.log(`[API] Page fetched: ${data.questions.length} questions, total so far: ${allQuestions.length}`);
      
      // Check if there are more pages
      if (data.questions.length < API_PAGE_LIMIT) {
        hasMore = false;
      } else {
        offset += API_PAGE_LIMIT;
      }
      
      // Safety limit to avoid infinite loops
      if (offset > 500) {
        hasMore = false;
      }
    }
    
    if (allQuestions.length === 0) {
      console.error("[API] No questions fetched from API");
      return [];
    }
    
    console.log(`[API] Sample disciplines:`, allQuestions.slice(0, 5).map((q: any) => q.discipline));
    
    // Filter questions by the requested disciplines (client-side filtering)
    const filteredQuestions = allQuestions.filter((q: any) => {
      return apiDisciplines.includes(q.discipline);
    });
    
    console.log(`[API] Filtered ${filteredQuestions.length} questions for disciplines: ${apiDisciplines.join(", ")}`);
    
    if (filteredQuestions.length === 0) {
      console.warn(`[API] No questions found for disciplines: ${apiDisciplines.join(", ")}`);
      const availableDisciplines = [...new Set(allQuestions.map((q: any) => q.discipline))];
      console.log(`[API] Available disciplines in response: ${availableDisciplines.join(", ")}`);
    }
    
    // Map to our format - API uses camelCase
    const mappedQuestions: QuestionData[] = filteredQuestions.map((q: any, idx: number) => {
      // Parse alternatives - API returns array of objects with letter, text, file, isCorrect
      const alternatives = Array.isArray(q.alternatives) 
        ? q.alternatives.map((alt: any) => ({
            letter: alt.letter || "",
            text: alt.text || ""
          }))
        : [];

      return {
        id: `api-${year}-${q.discipline}-${q.index || idx}`,
        title: q.title || "",
        context: q.context || null,
        alternatives,
        alternatives_introduction: q.alternativesIntroduction || null,
        discipline: mapAPIDisciplineToLocal(q.discipline),
        year: String(q.year || year),
        index: q.index || idx,
        files: Array.isArray(q.files) && q.files.length > 0 ? q.files : null,
        correct_alternative: q.correctAlternative || ""
      };
    });
    
    // Shuffle and limit
    return mappedQuestions
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);
      
  } catch (error) {
    console.error(`[API] Error fetching:`, error);
    return [];
  }
}

/**
 * Fetch questions from local database for a specific year (2024+)
 */
async function fetchLocalQuestionsByYear(
  year: string,
  disciplines: string[], 
  limit: number
): Promise<QuestionData[]> {
  console.log(`[LOCAL DB] Fetching year=${year}, disciplines=${disciplines.join(",")}, limit=${limit}`);
  
  const { data, error } = await supabase
    .from("enem_questions")
    .select("*")
    .eq("year", year)
    .in("discipline", disciplines)
    .limit(limit * 2);

  if (error) {
    console.error("[LOCAL DB] Error fetching questions:", error);
    return [];
  }

  console.log(`[LOCAL DB] Found ${data?.length || 0} questions`);

  const shuffled = (data || [])
    .sort(() => Math.random() - 0.5)
    .slice(0, limit);

  return shuffled.map(q => ({
    ...q,
    alternatives: Array.isArray(q.alternatives) 
      ? q.alternatives as unknown as Array<{ letter: string; text: string }>
      : []
  })) as unknown as QuestionData[];
}

/**
 * Fetch questions from local database (any year 2024+)
 */
async function fetchLocalQuestions(
  disciplines: string[], 
  limit: number
): Promise<QuestionData[]> {
  console.log(`[LOCAL DB] Fetching any year, disciplines=${disciplines.join(",")}, limit=${limit}`);
  
  const { data, error } = await supabase
    .from("enem_questions")
    .select("*")
    .in("discipline", disciplines)
    .limit(limit * 2);

  if (error) {
    console.error("[LOCAL DB] Error fetching questions:", error);
    return [];
  }

  console.log(`[LOCAL DB] Found ${data?.length || 0} questions`);

  const shuffled = (data || [])
    .sort(() => Math.random() - 0.5)
    .slice(0, limit);

  return shuffled.map(q => ({
    ...q,
    alternatives: Array.isArray(q.alternatives) 
      ? q.alternatives as unknown as Array<{ letter: string; text: string }>
      : []
  })) as unknown as QuestionData[];
}

export default SimuladoActive;
