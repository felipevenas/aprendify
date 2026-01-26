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
  Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { PageLoader } from "@/components/ui/page-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import QuestionPractice from "@/components/questions/QuestionPractice";
import { usePremium } from "@/hooks/usePremium";
import PremiumLockScreen from "@/components/PremiumLockScreen";

interface ErrorQuestion {
  id: string;
  question_id: string;
  discipline: string;
  created_at: string;
  days_since_error: number;
  review_priority: 'high' | 'medium' | 'low';
  question_data?: any;
}

// Intervalos de repetição espaçada (em dias)
const SPACED_INTERVALS = [1, 3, 7, 14, 30];

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

      const { data: attempts, error } = await supabase
        .from("question_attempts")
        .select(`
          id,
          question_id,
          discipline,
          created_at,
          had_doubt
        `)
        .eq("user_id", uid)
        .eq("is_correct", false)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!attempts || attempts.length === 0) {
        setErrors([]);
        setLoading(false);
        return;
      }

      // Processa erros e calcula prioridade baseado em repetição espaçada
      const now = new Date();
      const processedErrors: ErrorQuestion[] = [];
      const seenQuestions = new Set<string>();
      const uniqueDisciplines = new Set<string>();

      for (const attempt of attempts) {
        // Pula questões duplicadas (mantém apenas o erro mais recente)
        if (seenQuestions.has(attempt.question_id)) continue;
        seenQuestions.add(attempt.question_id);

        const errorDate = new Date(attempt.created_at);
        const daysSinceError = Math.floor((now.getTime() - errorDate.getTime()) / (1000 * 60 * 60 * 24));

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
        if (attempt.had_doubt && priority !== 'high') {
          priority = priority === 'low' ? 'medium' : 'high';
        }

        processedErrors.push({
          id: attempt.id,
          question_id: attempt.question_id,
          discipline: attempt.discipline || 'Geral',
          created_at: attempt.created_at,
          days_since_error: daysSinceError,
          review_priority: priority,
        });

        if (attempt.discipline) {
          uniqueDisciplines.add(attempt.discipline);
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

      setSelectedError({
        ...error,
        question_data: question,
      });
    } catch (err) {
      console.error("Error fetching question:", err);
      toast.error("Erro ao carregar questão");
    }
  };

  const handleAnswerSubmit = async (
    _questionId: string, 
    _selectedAnswer: string, 
    _correctAnswer: string, 
    isCorrect: boolean, 
    _hadDoubt?: boolean
  ) => {
    if (!selectedError || !userId) return;

    if (isCorrect) {
      toast.success("Parabéns! Você acertou na revisão! 🎉");
    } else {
      toast.info("Continue praticando! A questão será revisada novamente.");
    }

    // Volta para a lista
    setSelectedError(null);
    
    // Atualiza a lista se acertou (remove da lista de erros para revisão)
    if (isCorrect && userId) {
      fetchErrors(userId);
    }
  };

  const filteredErrors = disciplineFilter === "all" 
    ? errors 
    : errors.filter(e => e.discipline === disciplineFilter);

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando revisões...</p>
        </div>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
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
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <RotateCcw className="h-8 w-8 text-primary" />
                Revisão de Erros
              </h1>
              <p className="text-muted-foreground mt-1">
                Revise questões erradas com repetição espaçada para fixar o conteúdo
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => userId && fetchErrors(userId)}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filtrar por:</span>
          </div>
          <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Disciplina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Disciplinas</SelectItem>
              {disciplines.map((disc) => (
                <SelectItem key={disc} value={disc}>{disc}</SelectItem>
              ))}
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
            <AnimatePresence>
              {filteredErrors.map((error, index) => (
                <motion.div
                  key={error.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleStartReview(error)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${
                            error.review_priority === 'high' 
                              ? 'bg-red-100 dark:bg-red-900/30' 
                              : error.review_priority === 'medium'
                              ? 'bg-amber-100 dark:bg-amber-900/30'
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}>
                            <RotateCcw className={`h-5 w-5 ${
                              error.review_priority === 'high'
                                ? 'text-red-500'
                                : error.review_priority === 'medium'
                                ? 'text-amber-500'
                                : 'text-gray-500'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{error.discipline}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>Errou há {error.days_since_error} dia(s)</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={getPriorityColor(error.review_priority)}>
                            {getPriorityLabel(error.review_priority)}
                          </Badge>
                          <Button size="sm" variant="ghost">
                            Revisar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
};

export default ReviewErrors;
