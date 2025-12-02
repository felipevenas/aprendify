import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Shuffle, Filter, ChevronRight, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import QuestionPractice from "@/components/questions/QuestionPractice";
import QuestionFilters from "@/components/questions/QuestionFilters";
import Navbar from "@/components/Navbar";
import { usePremium } from "@/hooks/usePremium";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Página de prática de questões do ENEM
 * Integra com a API do ENEM para buscar questões reais
 * Permite filtrar por ano, disciplina e idioma
 */
const Questions = () => {
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();
  const { isPremium, isLoading: premiumLoading, dailyQuestionCount } = usePremium();
  
  // Limite de questões para usuários free
  const FREE_DAILY_LIMIT = 10;

  // Filtros
  const [selectedYear, setSelectedYear] = useState<string>("2023");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");

  // Estado da questão atual
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  // Busca questão da API do ENEM ou do banco local (2024+)
  const fetchQuestion = async (random: boolean = false) => {
    // Verifica limite de questões para usuários free
    if (!isPremium && dailyQuestionCount >= FREE_DAILY_LIMIT) {
      toast.error("Você atingiu o limite de 10 questões diárias. Assine o Premium para questões ilimitadas!");
      return;
    }
    
    setLoadingQuestion(true);
    try {
      const year = parseInt(selectedYear);
      
      // Anos 2024+ buscam do banco local
      if (year >= 2024) {
        let query = supabase
          .from('enem_questions')
          .select('*')
          .eq('year', selectedYear);
        
        // Aplica filtro de disciplina
        if (selectedDiscipline !== "all") {
          query = query.eq('discipline', selectedDiscipline);
        }
        
        // Aplica filtro de idioma
        if (selectedLanguage !== "all") {
          query = query.eq('language', selectedLanguage);
        }
        
        // Busca aleatória ou primeira
        if (random) {
          // Conta total de questões com os filtros
          const { count } = await supabase
            .from('enem_questions')
            .select('*', { count: 'exact', head: true })
            .eq('year', selectedYear)
            .eq(selectedDiscipline !== "all" ? 'discipline' : 'year', selectedDiscipline !== "all" ? selectedDiscipline : selectedYear)
            .eq(selectedLanguage !== "all" ? 'language' : 'year', selectedLanguage !== "all" ? selectedLanguage : selectedYear);
          
          const randomOffset = Math.floor(Math.random() * (count || 1));
          query = query.range(randomOffset, randomOffset);
        } else {
          query = query.limit(1);
        }
        
        const { data, error } = await query.maybeSingle();
        
        if (error) {
          console.error("Erro ao buscar questão local:", error);
          throw new Error("Erro ao buscar questão");
        }
        
        if (data) {
          // Transforma formato do banco para formato esperado pelo QuestionPractice
          const transformedQuestion = {
            index: data.index,
            title: data.title,
            discipline: data.discipline,
            language: data.language,
            context: data.context,
            files: data.files,
            alternativesIntroduction: data.alternatives_introduction,
            alternatives: data.alternatives,
            correctAlternative: data.correct_alternative,
          };
          setCurrentQuestion(transformedQuestion);
        } else {
          toast.error("Nenhuma questão encontrada com os filtros selecionados");
          setCurrentQuestion(null);
        }
      } else {
        // Anos 2009-2023 buscam da API externa
        let url = `https://api.enem.dev/v1/exams/${selectedYear}/questions`;
        const params = new URLSearchParams();

        if (selectedDiscipline !== "all") {
          params.append("discipline", selectedDiscipline);
        }

        if (selectedLanguage !== "all") {
          params.append("language", selectedLanguage);
        }

        if (random) {
          params.append("limit", "1");
          const randomOffset = Math.floor(Math.random() * 100);
          params.append("offset", randomOffset.toString());
        } else {
          params.append("limit", "1");
          params.append("offset", "0");
        }

        const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
        
        const response = await fetch(fullUrl);
        if (!response.ok) {
          throw new Error("Erro ao buscar questão");
        }

        const data = await response.json();
        
        if (data.questions && data.questions.length > 0) {
          setCurrentQuestion(data.questions[0]);
        } else {
          toast.error("Nenhuma questão encontrada com os filtros selecionados");
          setCurrentQuestion(null);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar questão:", error);
      toast.error("Erro ao carregar questão. Tente novamente.");
      setCurrentQuestion(null);
    } finally {
      setLoadingQuestion(false);
    }
  };

  // Salva resposta do usuário no banco
  // questionId formato: "ano-disciplina-index" (ex: "2023-ciencias-natureza-99")
  const handleAnswerSubmit = async (questionId: string, selectedAnswer: string, correctAnswer: string, isCorrect: boolean) => {
    console.log("=== INÍCIO handleAnswerSubmit ===");
    console.log("Parâmetros recebidos:", { questionId, selectedAnswer, correctAnswer, isCorrect });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error("Erro ao obter usuário:", userError);
      toast.error("Erro de autenticação. Por favor, faça login novamente.");
      return;
    }
    
    if (!user) {
      console.error("Usuário não autenticado ao tentar salvar resposta");
      toast.error("Você precisa estar logado para salvar respostas.");
      return;
    }

    console.log("Usuário autenticado:", user.id);
    console.log("Questão atual:", currentQuestion);

    try {
      const attemptData = {
        user_id: user.id,
        question_id: questionId,
        discipline: currentQuestion?.discipline || "desconhecida",
        year: selectedYear,
        selected_answer: selectedAnswer,
        correct_answer: correctAnswer,
        is_correct: isCorrect,
        topic: currentQuestion?.context || null,
        language: currentQuestion?.language || null,
      };
      
      console.log("📝 Tentando salvar no banco:", attemptData);
      
      const { data, error } = await supabase
        .from("question_attempts")
        .insert(attemptData)
        .select();
      
      if (error) {
        console.error("❌ ERRO do Supabase ao salvar tentativa:", error);
        console.error("Detalhes do erro:", JSON.stringify(error, null, 2));
        toast.error(`Erro ao salvar: ${error.message}`);
      } else {
        console.log("✅ Tentativa salva com SUCESSO:", data);
        toast.success("Resposta registrada com sucesso!");
      }
    } catch (error) {
      console.error("❌ Erro inesperado ao salvar resposta:", error);
      console.error("Stack trace:", error);
      toast.error("Erro inesperado ao salvar sua resposta.");
    }
    
    console.log("=== FIM handleAnswerSubmit ===");
  };

  // Busca questão aleatória
  const handleRandomQuestion = () => {
    fetchQuestion(true);
  };

  // Aplica filtros e busca nova questão
  const handleApplyFilters = () => {
    setShowFilters(false);
    fetchQuestion(false);
  };

  // Carrega questão aleatória ao montar o componente
  useEffect(() => {
    if (!loading) {
      fetchQuestion(true); // Sempre começa com questão aleatória
    }
  }, [loading]);

  if (loading) {
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
            
            {/* Ações discretas */}
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/dashboard")} 
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
              <Button 
                onClick={() => setShowFilters(!showFilters)} 
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filtros</span>
              </Button>
              <Button 
                onClick={handleRandomQuestion}
                size="sm"
                className="gap-2"
                disabled={loadingQuestion}
              >
                <Shuffle className="h-4 w-4" />
                <span className="hidden sm:inline">Aleatória</span>
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
            onNext={() => fetchQuestion(true)}
            onAnswer={handleAnswerSubmit}
          />
        ) : (
          <Card className="p-12 border-border/50 shadow-lg">
            <div className="text-center">
              <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhuma questão encontrada</h3>
              <p className="text-muted-foreground mb-6">
                Ajuste os filtros ou clique em "Aleatória" para começar
              </p>
              <Button onClick={handleRandomQuestion} className="gap-2">
                <Shuffle className="h-4 w-4" />
                Buscar Questão Aleatória
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Questions;
