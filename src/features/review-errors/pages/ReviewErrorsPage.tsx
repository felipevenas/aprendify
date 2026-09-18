import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Brain,
  ArrowLeft,
  RefreshCw,
  Filter,
  Calendar,
  BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { PageLoader } from "@/components/ui/page-loader";
import { ListSkeleton } from "@/components/ui/page-skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import QuestionPractice from "@/components/questions/QuestionPractice";
import { usePremium } from "@/hooks/usePremium";
import PremiumLockScreen from "@/components/PremiumLockScreen";
import { getSubjectByDiscipline, getSubjectColor, FIXED_SUBJECTS } from "@/lib/subjects";
import ReviewStatistics from "../components/ReviewStatistics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import type { StudyQuestion } from "@/features/questions/types";

interface ErrorQuestion {
  id: string;
  question_id: string;
  discipline: string;
  created_at: string;
  days_since_error: number;
  review_priority: 'high' | 'medium' | 'low';
  question_data?: StudyQuestion;
}

// Intervalos de repetição espaçada (em dias)
const SPACED_INTERVALS = [1, 3, 7, 14, 30];
const ITEMS_PER_PAGE = 5;

/**
 * Página de Revisão de Erros com algoritmo de repetição espaçada
 * Questões erradas retornam após 1, 3, 7, 14 e 30 dias
 */
const ReviewErrors = () => {
  const navigate = useNavigate();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<ErrorQuestion[]>([]);
  const [selectedError, setSelectedError] = useState<ErrorQuestion | null>(null);
  const [disciplineFilter, setDisciplineFilter] = useState<string>("all");
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [disciplineFilter]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
      fetchErrors(session.user.id);
    };
    checkAuth();
  }, [navigate]);

  const fetchErrors = async (uid: string) => {
    setLoading(true);
    try {
      // Busca tentativas erradas dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Busca TODAS as tentativas do usuário nos últimos 30 dias (certas e erradas)
      const { data: allAttempts, error } = await supabase
        .from("question_attempts")
        .select(`
          id,
          question_id,
          discipline,
          created_at,
          had_doubt,
          is_correct
        `)
        .eq("user_id", uid)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!allAttempts || allAttempts.length === 0) {
        setErrors([]);
        setLoading(false);
        return;
      }

      // Agrupa tentativas por question_id para análise
      const attemptsByQuestion = new Map<string, typeof allAttempts>();
      for (const attempt of allAttempts) {
        const existing = attemptsByQuestion.get(attempt.question_id) || [];
        existing.push(attempt);
        attemptsByQuestion.set(attempt.question_id, existing);
      }

      // Processa erros e calcula prioridade baseado em repetição espaçada
      const now = new Date();
      const processedErrors: ErrorQuestion[] = [];
      const uniqueDisciplines = new Set<string>();

      for (const [questionId, attempts] of attemptsByQuestion) {
        // Ordena por data (mais recente primeiro)
        const sortedAttempts = attempts.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Encontra o erro mais recente
        const lastError = sortedAttempts.find(a => !a.is_correct);
        if (!lastError) continue; // Não tem erro, pula

        const lastErrorDate = new Date(lastError.created_at);

        // Verifica se o usuário ACERTOU essa questão DEPOIS do último erro
        const hasCorrectAfterError = sortedAttempts.some(a => {
          if (!a.is_correct) return false;
          const correctDate = new Date(a.created_at);
          return correctDate > lastErrorDate;
        });

        // Se acertou depois do erro, não precisa revisar mais (por agora)
        if (hasCorrectAfterError) {
          continue;
        }

        const daysSinceError = Math.floor((now.getTime() - lastErrorDate.getTime()) / (1000 * 60 * 60 * 24));

        // Determina prioridade baseado nos intervalos de repetição espaçada
        let priority: 'high' | 'medium' | 'low' = 'low';
        
        // Alta prioridade: está em um intervalo de revisão (1, 3, 7, 14 dias)
        if (SPACED_INTERVALS.slice(0, 4).includes(daysSinceError) || 
            (daysSinceError >= 1 && daysSinceError <= 2)) {
          priority = 'high';
        } else if (daysSinceError <= 7) {
          priority = 'medium';
        }

        // Questões marcadas com dúvida têm prioridade aumentada
        if (lastError.had_doubt && priority !== 'high') {
          priority = priority === 'low' ? 'medium' : 'high';
        }

        processedErrors.push({
          id: lastError.id,
          question_id: questionId,
          discipline: lastError.discipline || 'Geral',
          created_at: lastError.created_at,
          days_since_error: daysSinceError,
          review_priority: priority,
        });

        if (lastError.discipline) {
          uniqueDisciplines.add(lastError.discipline);
        }
      }

      // Ordena por prioridade (high primeiro) e depois por dias desde erro
      processedErrors.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.review_priority] !== priorityOrder[b.review_priority]) {
          return priorityOrder[a.review_priority] - priorityOrder[b.review_priority];
        }
        return a.days_since_error - b.days_since_error;
      });

      setErrors(processedErrors);
      setDisciplines(Array.from(uniqueDisciplines).sort());
    } catch (error) {
      console.error("Error fetching errors:", error);
      toast.error("Erro ao carregar questões para revisão");
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = async (error: ErrorQuestion) => {
    try {
      // question_id pode ser UUID ou identificador legado (ex: "2019-linguagens-26")
      // Tenta buscar por id primeiro, se falhar tenta por índice
      let question = null;
      
      // Verifica se é um UUID válido
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(error.question_id);
      
      if (isUUID) {
        const { data, error: fetchError } = await supabase
          .from("enem_questions")
          .select("*")
          .eq("id", error.question_id)
          .single();
        
        if (!fetchError) question = data;
      }
      
      // Se não encontrou por UUID, tenta parsear o identificador legado
      if (!question) {
        // Formato: "ano-disciplina-index" ex: "2019-linguagens-26"
        const parts = error.question_id.split("-");
        if (parts.length >= 2) {
          const year = parts[0];
          const index = parseInt(parts[parts.length - 1], 10);
          
          if (!isNaN(index)) {
            const { data, error: fetchError } = await supabase
              .from("enem_questions")
              .select("*")
              .eq("year", year)
              .eq("index", index)
              .maybeSingle();
            
            if (!fetchError && data) question = data;
          }
        }
      }

      if (!question) {
        toast.error("Questão não encontrada no banco de dados");
        // Remove da lista local já que a questão não existe mais
        setErrors(prev => prev.filter(e => e.id !== error.id));
        return;
      }

      // Normaliza os campos do banco (snake_case) para o formato esperado pelo QuestionPractice (camelCase)
      const normalizedQuestion: StudyQuestion = {
        ...question,
        alternatives: question.alternatives as unknown as StudyQuestion["alternatives"],
        correctAlternative: question.correct_alternative,
        alternativesIntroduction: question.alternatives_introduction,
      };

      setSelectedError({
        ...error,
        question_data: normalizedQuestion,
      });
    } catch (err) {
      console.error("Error fetching question:", err);
      toast.error("Erro ao carregar questão");
    }
  };

  const handleAnswerSubmit = async (
    questionId: string, 
    selectedAnswer: string, 
    _correctAnswer?: string,
    _isCorrect?: boolean,
    _hadDoubt?: boolean
  ) => {
    if (!selectedError || !userId) return;

    try {
      const { error: insertError } = await supabase.rpc("record_question_attempt", {
        _question_id: questionId,
        _selected_answer: selectedAnswer,
      });

      if (insertError) {
        console.error("Erro ao salvar tentativa:", insertError);
        toast.error("Erro ao salvar resposta");
        return;
      }

      // Volta para a lista
      setSelectedError(null);

      const isCorrectAnswer = selectedAnswer === selectedError.question_data?.correctAlternative;
      if (isCorrectAnswer) {
        toast.success("Parabéns! Questão revisada com sucesso! 🎉", {
          description: "Esta questão foi removida da sua lista de revisão."
        });
        
        // Remove imediatamente da lista visual para feedback instantâneo
        setErrors(prev => prev.filter(e => e.question_id !== selectedError.question_id));
      } else {
        toast.info("Continue praticando!", {
          description: "Esta questão voltará para revisão nos próximos dias."
        });
        // Recarrega a lista para recalcular prioridades
        fetchErrors(userId);
      }
      
      // Dispara atualização das estatísticas
      setStatsRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Erro inesperado ao salvar resposta:", error);
      toast.error("Erro ao processar resposta");
    }
  };

  const filteredErrors = disciplineFilter === "all" 
    ? errors 
    : errors.filter(e => e.discipline === disciplineFilter);

  const totalPages = Math.ceil(filteredErrors.length / ITEMS_PER_PAGE);
  const paginatedErrors = filteredErrors.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const highPriorityCount = errors.filter(e => e.review_priority === 'high').length;
  const mediumPriorityCount = errors.filter(e => e.review_priority === 'medium').length;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Revisar Hoje';
      case 'medium': return 'Revisar Esta Semana';
      default: return 'Revisão Opcional';
    }
  };

  const premiumFeatures = [
    {
      title: "Revisão Espaçada Inteligente",
      description: "Algoritmo que prioriza questões nos momentos ideais para fixação",
    },
    {
      title: "Análise de Padrões de Erro",
      description: "Identifica temas e conceitos que você precisa reforçar",
    },
    {
      title: "Priorização Automática",
      description: "Questões mais críticas são destacadas para revisão urgente",
    },
  ];

  if (loading || premiumLoading) {
    return (
      <div className="min-h-screen bg-background app-layout-container">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ListSkeleton rows={6} />
        </main>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-background app-layout-container">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-12">
          <PremiumLockScreen
            title="Revisão de Erros"
            description="Revise suas questões erradas com repetição espaçada para fixar o conteúdo"
            features={premiumFeatures}
          />
        </main>
      </div>
    );
  }

  // Se está revisando uma questão específica
  if (selectedError && selectedError.question_data) {
    return (
      <div className="min-h-screen bg-background app-layout-container">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Button
            variant="ghost"
            onClick={() => setSelectedError(null)}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar à Lista
          </Button>

          <div className="mb-4 flex items-center gap-2">
            <Badge variant="outline" className={getPriorityColor(selectedError.review_priority)}>
              <RotateCcw className="h-3 w-3 mr-1" />
              {getPriorityLabel(selectedError.review_priority)}
            </Badge>
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" />
              Errou há {selectedError.days_since_error} dia(s)
            </Badge>
          </div>

          <QuestionPractice
            question={selectedError.question_data}
            onNext={() => setSelectedError(null)}
            onAnswer={handleAnswerSubmit}
            isPremium={isPremium}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background app-layout-container">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                <RotateCcw className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                Revisão de Erros
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Revise questões erradas com repetição espaçada para fixar o conteúdo
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => userId && fetchErrors(userId)}
              className="gap-2 w-full sm:w-auto justify-center"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </motion.div>

        {/* Tabs: Revisão e Estatísticas */}
        <Tabs defaultValue="review" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="review" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Revisão
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Estatísticas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                      <XCircle className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{highPriorityCount}</p>
                      <p className="text-sm text-muted-foreground">Revisar Hoje</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                      <Clock className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{mediumPriorityCount}</p>
                      <p className="text-sm text-muted-foreground">Esta Semana</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <Brain className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{errors.length}</p>
                      <p className="text-sm text-muted-foreground">Total para Revisar</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filtrar por:</span>
          </div>
          <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Disciplina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Disciplinas</SelectItem>
              {disciplines.map((disc) => {
                const subject = getSubjectByDiscipline(disc);
                return (
                  <SelectItem key={disc} value={disc}>
                    <span className="flex items-center gap-2">
                      <span 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: subject?.color || '#6B7280' }} 
                      />
                      {subject?.name || disc}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Lista de Erros */}
        {filteredErrors.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Parabéns! 🎉</h3>
              <p className="text-muted-foreground">
                {errors.length === 0
                  ? "Você não tem questões para revisar. Continue praticando!"
                  : "Nenhuma questão encontrada com este filtro."}
              </p>
              <Button onClick={() => navigate("/questions")} className="mt-4">
                Praticar Questões
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {paginatedErrors.map((error, index) => (
                <motion.div
                  key={error.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card 
                    className="cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => handleStartReview(error)}
                  >
                    <CardContent className="py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3 sm:gap-4">
                          {/* Ícone de disciplina com cor */}
                          <div 
                            className="p-2.5 rounded-xl transition-transform group-hover:scale-105 shrink-0 mt-0.5"
                            style={{ 
                              backgroundColor: `${getSubjectColor(error.discipline)}20`,
                            }}
                          >
                            <div 
                              className="w-5 h-5 rounded-full"
                              style={{ backgroundColor: getSubjectColor(error.discipline) }}
                            />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-foreground text-sm sm:text-base">
                                {getSubjectByDiscipline(error.discipline)?.name || error.discipline}
                              </p>
                              <Badge 
                                variant="outline" 
                                className={getPriorityColor(error.review_priority)}
                              >
                                {getPriorityLabel(error.review_priority)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Errou há {error.days_since_error} dia(s)</span>
                            </div>
                          </div>
                        </div>
                        <Button size="sm" className="gap-2 w-full sm:w-auto justify-center">
                          <RotateCcw className="h-4 w-4" />
                          Revisar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className={cn("cursor-pointer select-none", currentPage === 1 && "pointer-events-none opacity-50")}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const page = i + 1;
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer select-none"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}

                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className={cn("cursor-pointer select-none", currentPage === totalPages && "pointer-events-none opacity-50")}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
          </TabsContent>

          <TabsContent value="stats">
            {userId && <ReviewStatistics userId={userId} refreshTrigger={statsRefreshTrigger} />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export const ReviewErrorsPage = ReviewErrors;
export default ReviewErrors;
