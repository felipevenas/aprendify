import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Search,
  Edit,
  Save,
  Play,
  Pause,
  Loader2,
  CheckCircle,
  AlertCircle,
  Wand2,
  FileText,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import DifficultyIndicator from "@/components/questions/DifficultyIndicator";
import { cn } from "@/lib/utils";
import { formatDisciplineName } from "@/lib/formatters";

/**
 * Interface para questão (banco local + API externa)
 */
interface Question {
  id: string;
  index: number;
  title: string;
  discipline: string;
  context: string | null;
  alternativesIntroduction: string | null;
  alternatives: any[];
  correctAlternative: string;
  year: string;
  difficulty: "easy" | "medium" | "hard" | null;
  files: string[] | null;
  language: string | null;
  isFromAPI?: boolean; // Flag para identificar questões da API externa
}

/**
 * Anos disponíveis (API externa 2009-2023 + Banco local 2024+)
 */
const AVAILABLE_YEARS = [
  "2024", "2023", "2022", "2021", "2020", "2019", 
  "2018", "2017", "2016", "2015", "2014", "2013", 
  "2012", "2011", "2010", "2009"
];

/**
 * Rate limiting: 5 requisições por minuto = 1 requisição a cada 12 segundos
 */
const REQUESTS_PER_MINUTE = 5;
const REQUEST_INTERVAL_MS = (60 * 1000) / REQUESTS_PER_MINUTE; // 12 segundos

/**
 * Página de administração para gerenciar questões do ENEM
 * Permite edição manual e automação via IA com rate limiting
 */
const AdminQuestions = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Estado de listagem
  const [selectedYear, setSelectedYear] = useState("2024");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Estado de edição
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estado de automação
  const [isAutomating, setIsAutomating] = useState(false);
  const [automationProgress, setAutomationProgress] = useState(0);
  const [automationTotal, setAutomationTotal] = useState(0);
  const [automationPaused, setAutomationPaused] = useState(false);
  const [automationQueue, setAutomationQueue] = useState<Question[]>([]);

  // Verifica se é admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: roleData } = await supabase.rpc("get_user_role", { 
        _user_id: session.user.id 
      });
      
      if (roleData !== "admin") {
        toast.error("Acesso restrito a administradores");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    };

    checkAdmin();
  }, [navigate]);

  /**
   * Carrega questões do ano selecionado
   * 2024+: Banco local | 2009-2023: API externa
   */
  const loadQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    setQuestions([]);
    
    try {
      const yearNum = parseInt(selectedYear);
      
      if (yearNum >= 2024) {
        // Busca do banco local
        const { data, error } = await supabase
          .from("enem_questions")
          .select("*")
          .eq("year", selectedYear)
          .order("index", { ascending: true });
        
        if (error) throw error;
        
        const mappedQuestions: Question[] = (data || []).map(q => ({
          id: q.id,
          index: q.index,
          title: q.title,
          discipline: q.discipline,
          context: q.context,
          alternativesIntroduction: q.alternatives_introduction,
          alternatives: q.alternatives as any[],
          correctAlternative: q.correct_alternative,
          year: q.year,
          difficulty: q.difficulty as "easy" | "medium" | "hard" | null,
          files: q.files,
          language: q.language,
          isFromAPI: false,
        }));
        
        setQuestions(mappedQuestions);
        console.log(`[AdminQuestions] Carregadas ${mappedQuestions.length} questões do banco local`);
        
      } else {
        // Busca da API externa
        const url = `https://api.enem.dev/v1/exams/${selectedYear}/questions?limit=180`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error("Erro ao buscar da API");
        
        const data = await response.json();
        
        const mappedQuestions: Question[] = (data.questions || []).map((q: any) => ({
          id: `api_${selectedYear}_${q.index}`,
          index: q.index,
          title: q.title || "",
          discipline: q.discipline || "",
          context: q.context || null,
          alternativesIntroduction: q.alternativesIntroduction || null,
          alternatives: q.alternatives || [],
          correctAlternative: q.correctAlternative || "",
          year: selectedYear,
          difficulty: null, // API externa não tem dificuldade
          files: q.files || null,
          language: q.language || null,
          isFromAPI: true,
        }));
        
        setQuestions(mappedQuestions);
        console.log(`[AdminQuestions] Carregadas ${mappedQuestions.length} questões da API externa`);
      }
    } catch (error) {
      console.error("[AdminQuestions] Erro ao carregar questões:", error);
      toast.error("Erro ao carregar questões");
    } finally {
      setLoadingQuestions(false);
    }
  }, [selectedYear]);

  // Carrega questões quando muda o ano
  useEffect(() => {
    if (isAdmin) {
      loadQuestions();
    }
  }, [isAdmin, loadQuestions]);

  /**
   * Abre o diálogo de edição com a questão selecionada
   */
  const openEditDialog = (question: Question) => {
    setEditingQuestion({ ...question });
    setEditDialogOpen(true);
  };

  /**
   * Salva as alterações da questão editada
   * Para questões do banco local, salva no Supabase
   * Para questões da API, não é possível salvar (apenas visualizar)
   */
  const saveQuestion = async () => {
    if (!editingQuestion) return;
    
    if (editingQuestion.isFromAPI) {
      toast.error("Questões da API externa não podem ser editadas no servidor");
      return;
    }
    
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from("enem_questions")
        .update({
          title: editingQuestion.title,
          context: editingQuestion.context,
          alternatives_introduction: editingQuestion.alternativesIntroduction,
          alternatives: editingQuestion.alternatives,
          correct_alternative: editingQuestion.correctAlternative,
          difficulty: editingQuestion.difficulty,
        })
        .eq("id", editingQuestion.id);
      
      if (error) throw error;
      
      // Atualiza na lista local
      setQuestions(prev => prev.map(q => 
        q.id === editingQuestion.id ? editingQuestion : q
      ));
      
      toast.success("Questão atualizada com sucesso!");
      setEditDialogOpen(false);
      
    } catch (error) {
      console.error("[AdminQuestions] Erro ao salvar questão:", error);
      toast.error("Erro ao salvar questão");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Atualiza campo de alternativa
   */
  const updateAlternative = (index: number, field: "letter" | "text", value: string) => {
    if (!editingQuestion) return;
    
    const newAlternatives = [...editingQuestion.alternatives];
    newAlternatives[index] = {
      ...newAlternatives[index],
      [field]: value,
    };
    
    setEditingQuestion({
      ...editingQuestion,
      alternatives: newAlternatives,
    });
  };

  /**
   * Inicia automação: formata textos e classifica dificuldade via IA
   * Taxa limitada a 5 requisições por minuto para economizar tokens
   */
  const startAutomation = async () => {
    // Filtra questões que precisam de processamento (sem dificuldade)
    const questionsToProcess = questions.filter(q => !q.difficulty && !q.isFromAPI);
    
    if (questionsToProcess.length === 0) {
      toast.info("Todas as questões já foram processadas!");
      return;
    }
    
    setAutomationQueue(questionsToProcess);
    setAutomationTotal(questionsToProcess.length);
    setAutomationProgress(0);
    setIsAutomating(true);
    setAutomationPaused(false);
    
    toast.info(`Iniciando automação de ${questionsToProcess.length} questões...`);
  };

  /**
   * Processa fila de automação com rate limiting
   */
  useEffect(() => {
    if (!isAutomating || automationPaused || automationQueue.length === 0) return;
    
    const processNext = async () => {
      const question = automationQueue[0];
      
      try {
        console.log(`[Automation] Processando questão ${question.index}...`);
        
        const { data, error } = await supabase.functions.invoke("format-question", {
          body: {
            questionId: question.id,
            discipline: question.discipline,
            context: question.context || "",
            title: question.title || "",
            alternatives: question.alternatives || [],
          },
        });
        
        if (!error && data?.difficulty) {
          // Atualiza na lista local
          setQuestions(prev => prev.map(q => 
            q.id === question.id 
              ? { ...q, difficulty: data.difficulty, title: data.title || q.title, context: data.context || q.context }
              : q
          ));
          
          console.log(`[Automation] Questão ${question.index} processada: ${data.difficulty}`);
        }
      } catch (err) {
        console.error(`[Automation] Erro na questão ${question.index}:`, err);
      }
      
      // Remove da fila e atualiza progresso
      setAutomationQueue(prev => prev.slice(1));
      setAutomationProgress(prev => prev + 1);
    };
    
    // Executa com delay para rate limiting
    const timer = setTimeout(processNext, REQUEST_INTERVAL_MS);
    
    return () => clearTimeout(timer);
  }, [isAutomating, automationPaused, automationQueue]);

  // Finaliza automação quando fila esvazia
  useEffect(() => {
    if (isAutomating && automationQueue.length === 0 && automationProgress > 0) {
      setIsAutomating(false);
      toast.success(`Automação concluída! ${automationProgress} questões processadas.`);
    }
  }, [isAutomating, automationQueue.length, automationProgress]);

  /**
   * Pausa/retoma automação
   */
  const toggleAutomationPause = () => {
    setAutomationPaused(prev => !prev);
    toast.info(automationPaused ? "Automação retomada" : "Automação pausada");
  };

  /**
   * Cancela automação
   */
  const cancelAutomation = () => {
    setIsAutomating(false);
    setAutomationQueue([]);
    setAutomationProgress(0);
    toast.info("Automação cancelada");
  };

  // Filtra questões pela busca
  const filteredQuestions = questions.filter(q => 
    q.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.discipline?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.index.toString().includes(searchTerm)
  );

  // Estatísticas de dificuldade
  const difficultyStats = {
    easy: questions.filter(q => q.difficulty === "easy").length,
    medium: questions.filter(q => q.difficulty === "medium").length,
    hard: questions.filter(q => q.difficulty === "hard").length,
    unset: questions.filter(q => !q.difficulty).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Gerenciar Questões ENEM</h1>
              <p className="text-muted-foreground">
                Edite manualmente ou automatize a formatação via IA
              </p>
            </div>
          </div>

          {/* Controles */}
          <Card className="p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Seletor de Ano */}
              <div className="flex-1">
                <Label htmlFor="year" className="mb-2 block">Ano da Prova</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="year">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_YEARS.map(year => (
                      <SelectItem key={year} value={year}>
                        ENEM {year} {parseInt(year) >= 2024 ? "(Banco Local)" : "(API Externa)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Busca */}
              <div className="flex-1">
                <Label htmlFor="search" className="mb-2 block">Buscar Questão</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Número, disciplina ou texto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Botão de Automação - apenas para banco local */}
              {parseInt(selectedYear) >= 2024 && (
                <div className="flex items-end gap-2">
                  {!isAutomating ? (
                    <Button
                      onClick={startAutomation}
                      disabled={difficultyStats.unset === 0}
                      className="gap-2"
                    >
                      <Wand2 className="h-4 w-4" />
                      Automatizar ({difficultyStats.unset})
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={toggleAutomationPause}
                        variant="outline"
                        className="gap-2"
                      >
                        {automationPaused ? (
                          <><Play className="h-4 w-4" /> Retomar</>
                        ) : (
                          <><Pause className="h-4 w-4" /> Pausar</>
                        )}
                      </Button>
                      <Button
                        onClick={cancelAutomation}
                        variant="destructive"
                        size="icon"
                      >
                        ×
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Barra de progresso da automação */}
            {isAutomating && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    Processando... ({automationProgress}/{automationTotal})
                  </span>
                  <span className="text-primary font-medium">
                    {Math.round((automationProgress / automationTotal) * 100)}%
                  </span>
                </div>
                <Progress value={(automationProgress / automationTotal) * 100} />
                <p className="text-xs text-muted-foreground mt-2">
                  Taxa: {REQUESTS_PER_MINUTE} requisições/min (1 a cada {REQUEST_INTERVAL_MS / 1000}s)
                </p>
              </div>
            )}

            {/* Estatísticas de dificuldade */}
            <div className="mt-4 pt-4 border-t flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm text-muted-foreground">Fácil: {difficultyStats.easy}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm text-muted-foreground">Médio: {difficultyStats.medium}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-muted-foreground">Difícil: {difficultyStats.hard}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                <span className="text-sm text-muted-foreground">Sem classificação: {difficultyStats.unset}</span>
              </div>
            </div>
          </Card>

          {/* Lista de Questões */}
          <Card className="overflow-hidden">
            {loadingQuestions ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma questão encontrada</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="divide-y divide-border">
                  {filteredQuestions.map((question) => (
                    <div
                      key={question.id}
                      className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                    >
                      {/* Número da questão */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {question.index}
                      </div>

                      {/* Info da questão */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {question.title?.substring(0, 100) || "Sem título"}
                          {question.title && question.title.length > 100 && "..."}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {formatDisciplineName(question.discipline)}
                          </Badge>
                          {question.language && (
                            <Badge variant="outline" className="text-xs">
                              {question.language === "ingles" ? "Inglês" : "Espanhol"}
                            </Badge>
                          )}
                          {question.isFromAPI && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500">
                              API Externa
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Indicador de dificuldade */}
                      <div className="flex-shrink-0">
                        <DifficultyIndicator 
                          difficulty={question.difficulty} 
                          showLabel={true}
                          size="sm"
                        />
                      </div>

                      {/* Botão de edição */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(question)}
                        disabled={question.isFromAPI}
                        title={question.isFromAPI ? "Questões da API não podem ser editadas" : "Editar questão"}
                      >
                        <Edit className={cn(
                          "h-4 w-4",
                          question.isFromAPI && "opacity-30"
                        )} />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>
        </motion.div>
      </main>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Editar Questão {editingQuestion?.index} - ENEM {editingQuestion?.year}
            </DialogTitle>
          </DialogHeader>

          {editingQuestion && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 py-4">
                {/* Dificuldade */}
                <div className="space-y-2">
                  <Label>Dificuldade</Label>
                  <Select
                    value={editingQuestion.difficulty || ""}
                    onValueChange={(value) => setEditingQuestion({
                      ...editingQuestion,
                      difficulty: value as "easy" | "medium" | "hard",
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a dificuldade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          Fácil
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500" />
                          Médio
                        </div>
                      </SelectItem>
                      <SelectItem value="hard">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          Difícil
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Enunciado/Título */}
                <div className="space-y-2">
                  <Label htmlFor="title">Enunciado</Label>
                  <Textarea
                    id="title"
                    value={editingQuestion.title || ""}
                    onChange={(e) => setEditingQuestion({
                      ...editingQuestion,
                      title: e.target.value,
                    })}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {/* Contexto */}
                <div className="space-y-2">
                  <Label htmlFor="context">Contexto / Texto de Apoio</Label>
                  <Textarea
                    id="context"
                    value={editingQuestion.context || ""}
                    onChange={(e) => setEditingQuestion({
                      ...editingQuestion,
                      context: e.target.value,
                    })}
                    rows={5}
                    className="resize-none"
                  />
                </div>

                {/* Introdução das Alternativas */}
                <div className="space-y-2">
                  <Label htmlFor="alternativesIntro">Introdução das Alternativas</Label>
                  <Input
                    id="alternativesIntro"
                    value={editingQuestion.alternativesIntroduction || ""}
                    onChange={(e) => setEditingQuestion({
                      ...editingQuestion,
                      alternativesIntroduction: e.target.value,
                    })}
                  />
                </div>

                {/* Alternativas */}
                <div className="space-y-4">
                  <Label>Alternativas</Label>
                  {editingQuestion.alternatives?.map((alt: any, idx: number) => (
                    <div key={idx} className="flex gap-3 items-start">
                      <div className={cn(
                        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2",
                        alt.letter === editingQuestion.correctAlternative
                          ? "bg-green-500 border-green-500 text-white"
                          : "bg-muted border-border"
                      )}>
                        {alt.letter?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <Textarea
                          value={alt.text || ""}
                          onChange={(e) => updateAlternative(idx, "text", e.target.value)}
                          rows={2}
                          className="resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Resposta Correta */}
                <div className="space-y-2">
                  <Label>Alternativa Correta</Label>
                  <Select
                    value={editingQuestion.correctAlternative || ""}
                    onValueChange={(value) => setEditingQuestion({
                      ...editingQuestion,
                      correctAlternative: value,
                    })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Letra" />
                    </SelectTrigger>
                    <SelectContent>
                      {["a", "b", "c", "d", "e"].map(letter => (
                        <SelectItem key={letter} value={letter}>
                          {letter.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={saveQuestion} disabled={saving} className="gap-2">
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="h-4 w-4" /> Salvar Alterações</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminQuestions;
