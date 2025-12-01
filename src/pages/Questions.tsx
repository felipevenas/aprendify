import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Shuffle, Filter, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import QuestionPractice from "@/components/questions/QuestionPractice";
import QuestionFilters from "@/components/questions/QuestionFilters";
import Navbar from "@/components/Navbar";

/**
 * Página de prática de questões do ENEM
 * Integra com a API do ENEM para buscar questões reais
 * Permite filtrar por ano, disciplina e idioma
 */
const Questions = () => {
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

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

  // Busca questão da API do ENEM
  const fetchQuestion = async (random: boolean = false) => {
    setLoadingQuestion(true);
    try {
      // Monta a URL base com o ano selecionado
      let url = `https://api.enem.dev/v1/exams/${selectedYear}/questions`;
      const params = new URLSearchParams();

      // Adiciona filtro de disciplina se selecionado
      if (selectedDiscipline !== "all") {
        params.append("discipline", selectedDiscipline);
      }

      // Adiciona filtro de idioma se selecionado
      if (selectedLanguage !== "all") {
        params.append("language", selectedLanguage);
      }

      // Define limite e offset para buscar questões
      if (random) {
        // Busca uma questão aleatória dentro dos filtros
        params.append("limit", "1");
        const randomOffset = Math.floor(Math.random() * 100); // Offset aleatório
        params.append("offset", randomOffset.toString());
      } else {
        // Busca a primeira questão com os filtros aplicados
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
    } catch (error) {
      console.error("Erro ao buscar questão:", error);
      toast.error("Erro ao carregar questão. Tente novamente.");
      setCurrentQuestion(null);
    } finally {
      setLoadingQuestion(false);
    }
  };

  // Salva resposta do usuário no banco
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
      
      {/* Barra de ações */}
      <div className="bg-card/80 backdrop-blur-md border-b border-border shadow-sm sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/dashboard")} 
              className="gap-2 hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowFilters(!showFilters)} 
                variant="outline"
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filtros</span>
              </Button>
              <Button 
                onClick={handleRandomQuestion}
                className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                disabled={loadingQuestion}
              >
                <Shuffle className="h-4 w-4" />
                <span className="hidden sm:inline">Aleatória</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Banco de Questões ENEM
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Pratique com questões reais das provas de 2009 a 2023
          </p>
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
