import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Shuffle, Filter, Lock, StickyNote } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import QuestionPractice from "@/components/questions/QuestionPractice";
import QuestionFilters from "@/components/questions/QuestionFilters";
import AddQuestionNoteDialog from "@/components/questions/AddQuestionNoteDialog";
import Navbar from "@/components/Navbar";
import { usePremium } from "@/hooks/usePremium";
import { useQuestionBank } from "@/hooks/useQuestionBank";
import { useStreakContext } from "@/contexts/StreakContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Página de prática de questões do ENEM
 * Integra com a API do ENEM para buscar questões reais
 * Permite filtrar por ano, disciplina e idioma
 */
const Questions = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false); // Controla o diálogo de anotação
  const navigate = useNavigate();
  const { isPremium, isLoading: premiumLoading, dailyQuestionCount } = usePremium();
  const { currentQuestion, loading: loadingQuestion, fetchQuestion, clearCache } = useQuestionBank();
  // Usa o contexto global de streak para atualização em tempo real
  const { recordQuestionAnswered } = useStreakContext();
  
  // Limite de questões para usuários free
  const FREE_DAILY_LIMIT = 10;

  // Filtros - inicialmente busca de todos os anos
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setInitialLoading(false);
    };

    checkAuth();
  }, [navigate]);

  // Busca questão com verificação de limite
  const handleFetchQuestion = useCallback(async (random: boolean = true) => {
    // Verifica limite de questões para usuários free
    if (!isPremium && dailyQuestionCount >= FREE_DAILY_LIMIT) {
      toast.error("Você atingiu o limite de 10 questões diárias. Assine o Premium para questões ilimitadas!");
      return;
    }

    const result = await fetchQuestion(selectedYear, selectedDiscipline, selectedLanguage, random);
    
    if (!result.success && result.message) {
      toast.error(result.message);
    }
  }, [isPremium, dailyQuestionCount, fetchQuestion, selectedYear, selectedDiscipline, selectedLanguage]);

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
        console.error("Erro ao extrair tópico:", error);
        return null;
      }

      console.log("Tópico extraído com sucesso:", data?.topic);
      return data?.topic || null;
    } catch (error) {
      console.error("Erro ao chamar extract-question-topic:", error);
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

    try {
      // Captura a questão atual antes de qualquer operação assíncrona
      const questionToExtract = currentQuestion;
      
      // Extrai o tópico específico via IA (em paralelo com feedback visual)
      const topicPromise = extractQuestionTopic(questionToExtract);
      
      // Salva a tentativa imediatamente com tópico pendente
      const attemptData = {
        user_id: user.id,
        question_id: questionId,
        discipline: currentQuestion?.discipline || "desconhecida",
        year: selectedYear,
        selected_answer: selectedAnswer,
        correct_answer: correctAnswer,
        is_correct: isCorrect,
        topic: null, // Será atualizado após extração
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
      
      // Registra a questão respondida no sistema de streak
      await recordQuestionAnswered();
      
      toast.success("Resposta registrada!");

      // Atualiza o tópico quando a IA retornar
      const extractedTopic = await topicPromise;
      if (extractedTopic && insertedAttempt?.id) {
        const { error: updateError } = await supabase
          .from("question_attempts")
          .update({ topic: extractedTopic })
          .eq("id", insertedAttempt.id);
        
        if (updateError) {
          console.error("Erro ao atualizar tópico:", updateError);
        } else {
          console.log(`Tópico extraído e salvo: ${extractedTopic}`);
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
    clearCache(); // Limpa cache ao mudar filtros
    handleFetchQuestion(false);
  }, [clearCache, handleFetchQuestion]);

  // Carrega questão aleatória ao montar o componente (apenas uma vez)
  useEffect(() => {
    if (!initialLoading && !currentQuestion && !loadingQuestion) {
      fetchQuestion(selectedYear, selectedDiscipline, selectedLanguage, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoading]);

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header com ações integradas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
                Banco de Questões ENEM
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg">
                Pratique com questões reais das provas de 2009 a 2024
              </p>
            </div>
            
            {/* Ações discretas - botões quadrados com ícones */}
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate("/dashboard")} 
                title="Voltar ao Dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              {/* Botão de anotação - discreto no header */}
              <Button 
                variant="outline"
                size="icon"
                onClick={() => setNoteDialogOpen(true)}
                disabled={!currentQuestion}
                title="Fazer anotação"
              >
                <StickyNote className="h-4 w-4" />
              </Button>

              <Button 
                onClick={() => setShowFilters(!showFilters)} 
                variant="outline"
                size="icon"
                title="Filtros"
              >
                <Filter className="h-4 w-4" />
              </Button>
              
              <Button 
                onClick={() => handleFetchQuestion(true)}
                size="icon"
                disabled={loadingQuestion}
                title="Questão aleatória"
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
          </div>

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
                    onClick={() => window.open("https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=2fab389d1e6546429376b4a50517acd2", "_blank")}
                  >
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
                onYearChange={setSelectedYear}
                onDisciplineChange={setSelectedDiscipline}
                onLanguageChange={setSelectedLanguage}
                onApply={handleApplyFilters}
              />
            </Card>
          </motion.div>
        )}

        {/* Área da questão */}
        {loadingQuestion ? (
          <Card className="p-12 border-border/50 shadow-lg">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Carregando questão...</p>
            </div>
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
      </main>

      {/* Diálogo de anotação - movido para o nível da página */}
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
  );
};

export default Questions;
