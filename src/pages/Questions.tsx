import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Shuffle, Filter, Lock, StickyNote, Crown, RefreshCw } from "lucide-react";
import { clearCache as clearIndexedDBCache } from "@/lib/questionCache";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import QuestionPractice from "@/components/questions/QuestionPractice";
import QuestionFilters from "@/components/questions/QuestionFilters";
import AddQuestionNoteDialog from "@/components/questions/AddQuestionNoteDialog";
import SessionIndicator from "@/components/questions/SessionIndicator";
import Navbar from "@/components/Navbar";
import { usePremium } from "@/hooks/usePremium";
import { useQuestionBank } from "@/hooks/useQuestionBank";
import { useStreakContext } from "@/contexts/StreakContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * Página de prática de questões do ENEM
 * Integra com a API do ENEM para buscar questões reais
 * Permite filtrar por ano, disciplina, idioma, dificuldade, tópico e status
 */
const Questions = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isPremium, isLoading: premiumLoading, dailyQuestionCount } = usePremium();
  const { currentQuestion, loading: loadingQuestion, fetchQuestion, clearCache } = useQuestionBank();
  const { recordQuestionAnswered, streakData } = useStreakContext();
  
  // Session counter for this study session
  const [sessionCount, setSessionCount] = useState(0);
  
  const FREE_DAILY_LIMIT = 10;

  // Filtros
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
      setInitialLoading(false);
    };

    checkAuth();
  }, [navigate]);

  // Busca questão com verificação de limite (com check server-side)
  const handleFetchQuestion = useCallback(async (random: boolean = true) => {
    if (!isPremium) {
      // Verificação server-side para garantir que o limite não foi ultrapassado
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: todayAttempts } = await supabase
          .from("question_attempts")
          .select("id")
          .eq("user_id", user.id)
          .gte("created_at", new Date().toISOString().split('T')[0]);
        
        const realCount = todayAttempts?.length || 0;
        if (realCount >= FREE_DAILY_LIMIT) {
          toast.error("Você atingiu o limite de 10 questões diárias. Assine o Premium para questões ilimitadas!");
          return;
        }
      }
    }

    const result = await fetchQuestion(
      selectedYear, 
      selectedDiscipline, 
      selectedLanguage, 
      selectedDifficulty, 
      random, 
      selectedTopic,
      selectedStatus,
      searchKeyword,
      userId
    );
    
    if (!result.success && result.message) {
      toast.error(result.message);
    }
  }, [isPremium, dailyQuestionCount, fetchQuestion, selectedYear, selectedDiscipline, selectedLanguage, selectedDifficulty, selectedTopic, selectedStatus, searchKeyword, userId]);

  // Extrai o tópico específico da questão via IA
  const extractQuestionTopic = async (question: typeof currentQuestion): Promise<string | null> => {
    if (!question || !question.discipline) {
      console.log("Questão ou disciplina não disponível para extração de tópico");
      return null;
    }
    
    try {
      console.log(`Extraindo tópico para disciplina: ${question.discipline}`);
      
      const { data, error } = await supabase.functions.invoke("extract-question-topic", {
        body: {
          discipline: question.discipline,
          context: question.context || "",
          title: question.title || "",
          alternatives: question.alternatives || [],
        },
      });

      if (error) {
        return null;
      }

      return data?.topic || null;
    } catch {
      return null;
    }
  };

  // Salva resposta do usuário no banco
  const handleAnswerSubmit = async (questionId: string, selectedAnswer: string, correctAnswer: string, isCorrect: boolean) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      toast.error("Erro de autenticação. Por favor, faça login novamente.");
      return;
    }

    // Verificação server-side do limite diário para usuários gratuitos
    if (!isPremium) {
      const { data: todayAttempts } = await supabase
        .from("question_attempts")
        .select("id")
        .eq("user_id", user.id)
        .gte("created_at", new Date().toISOString().split('T')[0]);
      
      const realCount = todayAttempts?.length || 0;
      if (realCount >= FREE_DAILY_LIMIT) {
        toast.error("Você atingiu o limite de 10 questões diárias. Assine o Premium para questões ilimitadas!");
        return;
      }
    }

    try {
      const questionToExtract = currentQuestion;
      const topicPromise = extractQuestionTopic(questionToExtract);
      
      const attemptData = {
        user_id: user.id,
        question_id: questionId,
        discipline: currentQuestion?.discipline || "desconhecida",
        year: selectedYear === "all" ? (currentQuestion?.year || new Date().getFullYear().toString()) : selectedYear,
        selected_answer: selectedAnswer,
        correct_answer: correctAnswer,
        is_correct: isCorrect,
        topic: null,
        language: currentQuestion?.language || null,
      };
      
      const { data: insertedAttempt, error } = await supabase
        .from("question_attempts")
        .insert(attemptData)
        .select("id")
        .single();
      
      if (error) {
        console.error("Erro ao salvar tentativa:", error);
        toast.error(`Erro ao salvar: ${error.message}`);
        return;
      }
      
      await recordQuestionAnswered();
      setSessionCount(prev => prev + 1); // Increment session counter

      const extractedTopic = await topicPromise;
      if (extractedTopic && insertedAttempt?.id) {
        const { error: updateError } = await supabase
          .from("question_attempts")
          .update({ topic: extractedTopic })
          .eq("id", insertedAttempt.id);
        
        if (updateError) {
          // Silently fail - topic extraction is not critical
        }
      }
    } catch (error) {
      console.error("Erro inesperado:", error);
      toast.error("Erro inesperado ao salvar sua resposta.");
    }
  };

  // Aplica filtros e busca nova questão
  const handleApplyFilters = useCallback(() => {
    setShowFilters(false);
    clearCache();
    handleFetchQuestion(false);
  }, [clearCache, handleFetchQuestion]);

  // Limpa todos os caches e busca nova questão
  const handleClearCache = useCallback(async () => {
    clearCache();
    await clearIndexedDBCache();
    toast.success("Cache limpo! Buscando questões atualizadas...");
    handleFetchQuestion(true);
  }, [clearCache, handleFetchQuestion]);

  // Carrega questão aleatória ao montar o componente
  useEffect(() => {
    if (!initialLoading && !currentQuestion && !loadingQuestion && userId) {
      if (!isPremium && dailyQuestionCount >= FREE_DAILY_LIMIT) {
        // Não busca questão se o usuário grátis já atingiu o limite
        return;
      }
      fetchQuestion(selectedYear, selectedDiscipline, selectedLanguage, selectedDifficulty, true, selectedTopic, selectedStatus, searchKeyword, userId);
    }
  }, [initialLoading, userId, isPremium, dailyQuestionCount]);

  return (
    <PageLoader loading={initialLoading} message="Preparando suas questões...">
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 app-layout-container">
        <Navbar />

        <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    Banco de Questões ENEM
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Pratique com questões reais das provas de 2009 a 2025
                  </p>
                </div>
              </div>
              
              {/* Session Indicator */}
              <AnimatePresence>
                {(sessionCount > 0 || (streakData && streakData.currentStreak > 0)) && (
                  <SessionIndicator
                    sessionCount={sessionCount}
                    currentStreak={streakData?.currentStreak || 0}
                    streakCompletedToday={streakData?.streakCompletedToday || false}
                  />
                )}
              </AnimatePresence>
            </div>
            
            {/* Actions row */}
            <TooltipProvider>
              <div className="flex items-center justify-end gap-2 mb-4" data-tour="questions-actions">
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline"
                    size="icon"
                    onClick={() => setNoteDialogOpen(true)}
                    disabled={!currentQuestion}
                  >
                    <StickyNote className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Fazer Anotação</p>
                  <p className="text-xs text-muted-foreground">
                    Crie uma nota sobre esta questão para revisar depois.
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline"
                    size="icon"
                    onClick={handleClearCache}
                    disabled={loadingQuestion}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Limpar Cache</p>
                  <p className="text-xs text-muted-foreground">
                    Remove questões salvas localmente e busca as versões mais atualizadas do banco de dados.
                  </p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={() => setShowFilters(!showFilters)} 
                    variant="outline"
                    size="icon"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Filtros</p>
                  <p className="text-xs text-muted-foreground">
                    Filtre por ano, disciplina, dificuldade, tópico e muito mais.
                  </p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={() => handleFetchQuestion(true)}
                    size="icon"
                    disabled={loadingQuestion}
                  >
                    <Shuffle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium">Questão Aleatória</p>
                  <p className="text-xs text-muted-foreground">
                    Busca uma nova questão aleatória com base nos filtros selecionados.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          {/* Alerta de limite para usuários free */}
          {!premiumLoading && !isPremium && (
            <Alert className={`${dailyQuestionCount >= FREE_DAILY_LIMIT ? 'border-destructive' : 'border-primary'}`}>
              <AlertDescription className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {dailyQuestionCount >= FREE_DAILY_LIMIT ? (
                    <Lock className="h-4 w-4 text-destructive" />
                  ) : (
                    <BookOpen className="h-4 w-4 text-primary" />
                  )}
                  <span>
                    {dailyQuestionCount >= FREE_DAILY_LIMIT
                      ? "Limite diário atingido! Assine o Premium para continuar."
                      : `Você respondeu ${dailyQuestionCount} de ${FREE_DAILY_LIMIT} questões hoje.`}
                  </span>
                </div>
                {dailyQuestionCount >= FREE_DAILY_LIMIT && (
                  <Button 
                    size="sm" 
                    onClick={() => navigate("/subscription")}
                    className="gap-1"
                  >
                    <Crown className="h-3 w-3" />
                    Assinar Premium
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </motion.div>

        {/* Painel de Filtros */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <Card className="p-6 border-border/50 shadow-lg">
              <QuestionFilters
                selectedYear={selectedYear}
                selectedDiscipline={selectedDiscipline}
                selectedLanguage={selectedLanguage}
                selectedDifficulty={selectedDifficulty}
                selectedTopic={selectedTopic}
                selectedStatus={selectedStatus}
                searchKeyword={searchKeyword}
                onYearChange={setSelectedYear}
                onDisciplineChange={setSelectedDiscipline}
                onLanguageChange={setSelectedLanguage}
                onDifficultyChange={setSelectedDifficulty}
                onTopicChange={setSelectedTopic}
                onStatusChange={setSelectedStatus}
                onSearchChange={setSearchKeyword}
                onApply={handleApplyFilters}
              />
            </Card>
          </motion.div>
        )}

        {/* Área da questão */}
        <div data-tour="questions-area">
          {loadingQuestion ? (
            <Card className="p-12 border-border/50 shadow-lg">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">Carregando questão...</p>
              </div>
            </Card>
          ) : !isPremium && dailyQuestionCount >= FREE_DAILY_LIMIT ? (
            <Card className="p-12 border-border/50 shadow-lg text-center">
              <Lock className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Limite diário atingido</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Você já respondeu o limite de 10 questões gratuitas por hoje. Assine o plano Premium para ter acesso a milhares de questões ilimitadas, resoluções com IA e muito mais!
              </p>
              <Button onClick={() => navigate("/subscription")} className="gap-2 bg-primary">
                <Crown className="h-4 w-4" />
                Ver Planos Premium
              </Button>
            </Card>
          ) : currentQuestion ? (
            <QuestionPractice 
              question={currentQuestion}
              onNext={() => handleFetchQuestion(true)}
              onAnswer={handleAnswerSubmit}
              isPremium={isPremium}
            />
          ) : (
            <Card className="p-12 border-border/50 shadow-lg">
              <div className="text-center">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Nenhuma questão encontrada</h3>
                <p className="text-muted-foreground mb-6">
                  Ajuste os filtros ou clique em "Aleatória" para começar
                </p>
                <Button onClick={() => handleFetchQuestion(true)} className="gap-2">
                  <Shuffle className="h-4 w-4" />
                  Buscar Questão Aleatória
                </Button>
              </div>
            </Card>
          )}
        </div>
      </main>

      <AddQuestionNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        questionContext={currentQuestion ? {
          year: currentQuestion.year || new Date().getFullYear().toString(),
          discipline: currentQuestion.discipline || "",
          index: currentQuestion.index || 0,
          context: currentQuestion.context,
        } : undefined}
      />
    </div>
  </PageLoader>
  );
};

export default Questions;
