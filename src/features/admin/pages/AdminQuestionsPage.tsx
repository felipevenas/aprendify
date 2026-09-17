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
import { PageLoader } from "@/components/ui/page-loader";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { CursorGlow } from "@/components/ui/cursor-glow";
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
  Sparkles,
  Database,
  Globe,
  Power,
  Upload,
  Image,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import DifficultyIndicator from "@/components/questions/DifficultyIndicator";
import { cn } from "@/lib/utils";
import { formatDisciplineName } from "@/lib/formatters";
import type { Json } from "@/integrations/supabase/types";

/**
 * Interface para questão (banco local + API externa)
 */
interface QuestionAlternative {
  letter: string;
  text: string;
  file?: string;
  files?: string[];
}

interface Question {
  id: string;
  index: number;
  title: string;
  discipline: string;
  context: string | null;
  alternativesIntroduction: string | null;
  alternatives: QuestionAlternative[];
  correctAlternative: string;
  year: string;
  difficulty: "easy" | "medium" | "hard" | null;
  files: string[] | null;
  language: string | null;
  isFromAPI?: boolean;
  // Novos campos de classificação
  mainTopic?: string | null;
  subtopics?: string[] | null;
  confidence?: number | null;
  classificationStatus?: string | null;
  origin?: string | null;
  // Campo de ativação
  isActive?: boolean;
}

/**
 * Anos disponíveis (todos do banco de dados)
 */
const AVAILABLE_YEARS = [
  "2025", "2024", "2023", "2022", "2021", "2020", "2019", 
  "2018", "2017", "2016", "2015", "2014", "2013", 
  "2012", "2011", "2010", "2009"
];

/**
 * Rate limiting baseado nos limites do Groq API (llama-3.3-70b-versatile):
 * - RPM: 30 requests/min (1 a cada 2s)
 * - TPM: 12K tokens/min
 * - TPD: 100K tokens/day
 * 
 * Para ser conservador e evitar erros, usamos 1 request a cada 4 segundos
 */
const REQUESTS_PER_MINUTE = 15; // Conservador: metade do limite real
const REQUEST_INTERVAL_MS = (60 * 1000) / REQUESTS_PER_MINUTE; // ~4 segundos

interface YearStats {
  year: string;
  total: number;
  pending: number;
  ready: number;
  needsReview: number;
}

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
  
  // Estado para análise individual
  const [analyzingQuestionId, setAnalyzingQuestionId] = useState<string | null>(null);
  
  // Estado para classificação em lote
  const [isClassifying, setIsClassifying] = useState(false);
  
  // Estado para classificação + dificuldade combinada
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [processingAllProgress, setProcessingAllProgress] = useState({
    processed: 0,
    total: 0,
    isPaused: false,
    pauseCountdown: 0,
  });
  const [processingAllPaused, setProcessingAllPaused] = useState(false);
  
  // Estado para classificação global (todas as questões)
  const [isGlobalClassifying, setIsGlobalClassifying] = useState(false);
  const [globalClassificationPaused, setGlobalClassificationPaused] = useState(false);
  const [globalProgress, setGlobalProgress] = useState({ 
    currentYear: "", 
    processedYears: 0, 
    totalYears: 0,
    processedQuestions: 0,
    totalPending: 0,
    startTime: 0,
    estimatedRemaining: "",
    isPaused: false,
    pauseCountdown: 0
  });
  
  // Estatísticas por ano
  const [yearStats, setYearStats] = useState<YearStats[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showYearOverview, setShowYearOverview] = useState(true);

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
   * Carrega estatísticas por ano do banco de dados
   */
  const loadYearStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { data, error } = await supabase
        .from("enem_questions")
        .select("year, classification_status");

      if (error) throw error;

      // Agrupa por ano
      const statsMap = new Map<string, YearStats>();
      
      AVAILABLE_YEARS.forEach(year => {
        statsMap.set(year, { year, total: 0, pending: 0, ready: 0, needsReview: 0 });
      });

      (data || []).forEach(q => {
        const stat = statsMap.get(q.year);
        if (stat) {
          stat.total++;
          if (q.classification_status === "ready") stat.ready++;
          else if (q.classification_status === "needs_review") stat.needsReview++;
          else stat.pending++;
        }
      });

      setYearStats(Array.from(statsMap.values()).sort((a, b) => parseInt(b.year) - parseInt(a.year)));
    } catch (error) {
      console.error("[AdminQuestions] Erro ao carregar estatísticas:", error);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  /**
   * Carrega questões do ano selecionado (sempre do banco local)
   */
  const loadQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    setQuestions([]);
    
    try {
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
        alternatives: q.alternatives as unknown as QuestionAlternative[],
        correctAlternative: q.correct_alternative,
        year: q.year,
        difficulty: q.difficulty as "easy" | "medium" | "hard" | null,
        files: q.files,
        language: q.language,
        isFromAPI: false,
        mainTopic: q.main_topic,
        subtopics: q.subtopics,
        confidence: q.confidence,
        classificationStatus: q.classification_status,
        origin: q.origin,
        isActive: q.is_active,
      }));
      
      setQuestions(mappedQuestions);
    } catch (error) {
      console.error("[AdminQuestions] Erro ao carregar questões:", error);
      toast.error("Erro ao carregar questões");
    } finally {
      setLoadingQuestions(false);
    }
  }, [selectedYear]);

  // Carrega estatísticas quando torna-se admin
  useEffect(() => {
    if (isAdmin) {
      loadYearStats();
    }
  }, [isAdmin, loadYearStats]);

  // Carrega questões quando muda o ano ou sai do overview
  useEffect(() => {
    if (isAdmin && !showYearOverview) {
      loadQuestions();
    }
  }, [isAdmin, loadQuestions, showYearOverview]);

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
            alternatives: editingQuestion.alternatives as unknown as Json,
          correct_alternative: editingQuestion.correctAlternative,
          difficulty: editingQuestion.difficulty,
          main_topic: editingQuestion.mainTopic,
          subtopics: editingQuestion.subtopics,
          is_active: editingQuestion.isActive,
          // Ao salvar manualmente, força status = ready
          classification_status: 'ready',
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
        }
      } catch {
        // Silent fail for automation
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

  /**
   * Analisa dificuldade de uma única questão via IA
   */
  const analyzeIndividualQuestion = async (question: Question) => {
    if (question.isFromAPI) {
      toast.error("Questões da API externa não podem ser processadas");
      return;
    }
    
    setAnalyzingQuestionId(question.id);
    
    try {
      const { data, error } = await supabase.functions.invoke("format-question", {
        body: {
          questionId: question.id,
          discipline: question.discipline,
          context: question.context || "",
          title: question.title || "",
          alternatives: question.alternatives || [],
        },
      });
      
      if (error) throw error;
      
      if (data?.difficulty) {
        // Atualiza na lista local
        setQuestions(prev => prev.map(q => 
          q.id === question.id 
            ? { ...q, difficulty: data.difficulty, title: data.title || q.title, context: data.context || q.context }
            : q
        ));
        
        toast.success(`Questão ${question.index}: ${data.difficulty === 'easy' ? 'Fácil' : data.difficulty === 'medium' ? 'Médio' : 'Difícil'}`);
      }
    } catch {
      toast.error("Erro ao analisar questão");
    } finally {
      setAnalyzingQuestionId(null);
    }
  };

  // Filtra questões pela busca
  const filteredQuestions = questions.filter(q => 
    q.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.discipline?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.mainTopic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.index.toString().includes(searchTerm)
  );

  // Estatísticas de dificuldade
  const difficultyStats = {
    easy: questions.filter(q => q.difficulty === "easy").length,
    medium: questions.filter(q => q.difficulty === "medium").length,
    hard: questions.filter(q => q.difficulty === "hard").length,
    unset: questions.filter(q => !q.difficulty).length,
  };

  // Estatísticas de classificação
  const classificationStats = {
    ready: questions.filter(q => q.classificationStatus === "ready").length,
    pending: questions.filter(q => q.classificationStatus === "pending_classification").length,
    needsReview: questions.filter(q => q.classificationStatus === "needs_review").length,
  };

  // Função para executar classificação em lote para o ano selecionado
  const runBatchClassification = async () => {
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("classify-questions", {
        body: { batchSize: 20, year: selectedYear },
      });

      if (error) throw error;

      toast.success(`Classificação concluída: ${data.processed} questões processadas (${data.ready} prontas, ${data.needsReview} para revisão)`);
      
      // Recarrega as questões e estatísticas
      loadQuestions();
      loadYearStats();
    } catch (err) {
      console.error("[Classification] Erro:", err);
      toast.error("Erro ao executar classificação");
    } finally {
      setIsClassifying(false);
    }
  };

  /**
   * Executa classificação + dificuldade combinada para o ano selecionado
   * Processa todas as questões pendentes respeitando o rate-limit
   */
  const runClassifyAndDifficulty = async () => {
    // Conta questões que precisam de processamento
    const needsProcessing = questions.filter(
      q => q.classificationStatus === 'pending_classification' || !q.difficulty
    ).length;
    
    if (needsProcessing === 0) {
      toast.info("Todas as questões do ano já foram processadas!");
      return;
    }

    setIsProcessingAll(true);
    setProcessingAllPaused(false);
    setProcessingAllProgress({
      processed: 0,
      total: needsProcessing,
      isPaused: false,
      pauseCountdown: 0,
    });

    let totalProcessed = 0;
    let totalFailed = 0;
    let remaining = needsProcessing;
    const cancelled = false;

    const DELAY_BETWEEN_REQUESTS_MS = 2500; // 2.5s = ~24 RPM (conservador)
    const RATE_LIMIT_PAUSE_SECONDS = 65;

    try {
      while (remaining > 0 && !cancelled) {
        // Verifica pausa manual
        while (processingAllPaused && !cancelled) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (cancelled) break;

        const { data, error } = await supabase.functions.invoke("classify-and-difficulty", {
          body: { batchSize: 1, year: selectedYear },
        });

        if (error) {
          const errorStr = error.message?.toLowerCase() || '';
          
          // Rate limit - pausa automática
          if (errorStr.includes("rate") || errorStr.includes("429") || errorStr.includes("limit")) {
            toast.warning(`Rate limit atingido. Pausando ${RATE_LIMIT_PAUSE_SECONDS}s...`);
            setProcessingAllProgress(prev => ({ ...prev, isPaused: true, pauseCountdown: RATE_LIMIT_PAUSE_SECONDS }));
            
            for (let countdown = RATE_LIMIT_PAUSE_SECONDS; countdown > 0 && !cancelled; countdown--) {
              setProcessingAllProgress(prev => ({ ...prev, pauseCountdown: countdown }));
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            setProcessingAllProgress(prev => ({ ...prev, isPaused: false, pauseCountdown: 0 }));
            continue;
          }
          
          totalFailed++;
          remaining--;
          continue;
        }

        totalProcessed += data.processed || 0;
        totalFailed += data.failed || 0;
        remaining -= (data.processed || 0) + (data.failed || 0);

        setProcessingAllProgress(prev => ({
          ...prev,
          processed: totalProcessed + totalFailed,
        }));

        // Se não processou nenhuma, pode ter acabado
        if ((data.processed || 0) === 0 && data.message === "No questions to process") {
          break;
        }

        // Delay entre requests
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
      }

      toast.success(`Processamento concluído! ${totalProcessed} questões processadas, ${totalFailed} falhas.`);
      
      // Recarrega as questões e estatísticas
      loadQuestions();
      loadYearStats();
    } catch (err) {
      console.error("[ClassifyAndDifficulty] Erro:", err);
      toast.error("Erro durante processamento");
    } finally {
      setIsProcessingAll(false);
      setProcessingAllPaused(false);
      setProcessingAllProgress({
        processed: 0,
        total: 0,
        isPaused: false,
        pauseCountdown: 0,
      });
    }
  };

  /**
   * Pausa/retoma processamento combinado
   */
  const toggleProcessingAllPause = () => {
    setProcessingAllPaused(prev => !prev);
    toast.info(processingAllPaused ? "Processamento retomado" : "Processamento pausado");
  };

  /**
   * Cancela processamento combinado
   */
  const cancelProcessingAll = () => {
    setIsProcessingAll(false);
    setProcessingAllPaused(false);
    setProcessingAllProgress({
      processed: 0,
      total: 0,
      isPaused: false,
      pauseCountdown: 0,
    });
    toast.info("Processamento cancelado");
  };

  /**
   * Classifica TODAS as questões pendentes do banco de dados
   * Processa ano por ano para dar feedback de progresso
   * 
   * LIMITES GROQ API (llama-3.3-70b-versatile):
   * - RPM: 30 requests/min
   * - TPM: 15K tokens/min  
   * - RPD: 7K requests/day
   * 
   * Estratégia: 2s entre requests (30 RPM), pausa apenas se houver rate limit
   */
  const runGlobalClassification = async () => {
    const totalPending = yearStats.reduce((acc, s) => acc + s.pending, 0);
    
    if (totalPending === 0) {
      toast.info("Todas as questões já foram classificadas!");
      return;
    }

    setIsGlobalClassifying(true);
    setGlobalClassificationPaused(false);
    const yearsWithPending = yearStats.filter(s => s.pending > 0);
    
    setGlobalProgress({
      currentYear: "",
      processedYears: 0,
      totalYears: yearsWithPending.length,
      processedQuestions: 0,
      totalPending,
      startTime: Date.now(),
      estimatedRemaining: "Calculando...",
      isPaused: false,
      pauseCountdown: 0
    });

    let totalProcessed = 0;
    let totalReady = 0;
    let totalNeedsReview = 0;
    let totalFailed = 0;
    
    // Rate limits: 30 RPM = 2s entre requests
    const QUESTIONS_PER_BATCH = 1;
    const DELAY_BETWEEN_REQUESTS_MS = 2100; // 2.1s = ~28 RPM
    const RATE_LIMIT_PAUSE_SECONDS = 65; // 1 min + 5s quando atingir limite

    const cancelled = false;

    try {
      for (let i = 0; i < yearsWithPending.length; i++) {
        if (cancelled) break;
        
        const yearStat = yearsWithPending[i];
        let yearPending = yearStat.pending;
        
        // Atualiza progresso
        setGlobalProgress(prev => ({
          ...prev,
          currentYear: yearStat.year,
          processedYears: i,
        }));

        // Processa todas as questões pendentes deste ano
        while (yearPending > 0 && !cancelled) {
          // Verifica se está pausado manualmente
          while (globalClassificationPaused && !cancelled) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          if (cancelled) break;
          
          const { data, error } = await supabase.functions.invoke("classify-questions", {
            body: { batchSize: QUESTIONS_PER_BATCH, year: yearStat.year },
          });

          if (error) {
            
            // Se for erro de rate limit ou tokens, pausa automaticamente
            const errorStr = error.message?.toLowerCase() || '';
            if (errorStr.includes("rate") || errorStr.includes("token") || errorStr.includes("429") || errorStr.includes("limit")) {
              toast.warning(`Limite de taxa atingido. Pausando por ${RATE_LIMIT_PAUSE_SECONDS} segundos...`);
              setGlobalProgress(prev => ({ ...prev, isPaused: true, pauseCountdown: RATE_LIMIT_PAUSE_SECONDS }));
              
              for (let countdown = RATE_LIMIT_PAUSE_SECONDS; countdown > 0 && !cancelled; countdown--) {
                setGlobalProgress(prev => ({ ...prev, pauseCountdown: countdown }));
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              
              setGlobalProgress(prev => ({ ...prev, isPaused: false, pauseCountdown: 0 }));
              continue; // Tenta novamente após a pausa
            }
            
            // Outros erros: incrementa failed e continua
            totalFailed++;
            yearPending--;
            continue;
          }

          totalProcessed += data.processed || 0;
          totalReady += data.ready || 0;
          totalNeedsReview += data.needsReview || 0;
          totalFailed += data.failed || 0;
          yearPending -= (data.processed || 0) + (data.failed || 0);

          // Calcula tempo restante estimado
          const elapsedMs = Date.now() - globalProgress.startTime;
          const avgTimePerQuestion = elapsedMs / Math.max(totalProcessed, 1);
          const remainingQuestions = totalPending - totalProcessed - totalFailed;
          const remainingMs = avgTimePerQuestion * remainingQuestions;
          const remainingMinutes = Math.ceil(remainingMs / 60000);
          const remainingHours = Math.floor(remainingMinutes / 60);

          setGlobalProgress(prev => ({
            ...prev,
            processedQuestions: totalProcessed,
            estimatedRemaining: remainingHours > 0
              ? `~${remainingHours}h ${remainingMinutes % 60}min`
              : `~${remainingMinutes} min`
          }));

          // Se não processou nenhuma, sai do loop
          if ((data.processed || 0) === 0 && (data.failed || 0) === 0) break;

          // Delay de 2.1s entre requests (28 RPM)
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
        }
      }

      toast.success(
        `Classificação global concluída!\n` +
        `${totalProcessed} questões processadas\n` +
        `${totalReady} prontas, ${totalNeedsReview} para revisão, ${totalFailed} falhas`
      );

      // Recarrega estatísticas
      loadYearStats();
    } catch (err) {
      console.error("[GlobalClassification] Erro:", err);
      toast.error("Erro durante classificação global");
    } finally {
      setIsGlobalClassifying(false);
      setGlobalClassificationPaused(false);
      setGlobalProgress({
        currentYear: "",
        processedYears: 0,
        totalYears: 0,
        processedQuestions: 0,
        totalPending: 0,
        startTime: 0,
        estimatedRemaining: "",
        isPaused: false,
        pauseCountdown: 0
      });
    }
  };

  /**
   * Pausa/retoma classificação global
   */
  const toggleGlobalClassificationPause = () => {
    setGlobalClassificationPaused(prev => !prev);
    toast.info(globalClassificationPaused ? "Classificação retomada" : "Classificação pausada");
  };

  /**
   * Cancela classificação global
   */
  const cancelGlobalClassification = () => {
    setIsGlobalClassifying(false);
    setGlobalClassificationPaused(false);
    setGlobalProgress({
      currentYear: "",
      processedYears: 0,
      totalYears: 0,
      processedQuestions: 0,
      totalPending: 0,
      startTime: 0,
      estimatedRemaining: "",
      isPaused: false,
      pauseCountdown: 0
    });
    toast.info("Classificação global cancelada");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 relative overflow-hidden app-layout-container">
      {/* Efeito de glow seguindo o cursor */}
      <CursorGlow color="hsl(217, 91%, 50%)" size={500} opacity={0.06} />
      
      {/* Elementos decorativos de fundo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 w-64 h-64 bg-primary/3 rounded-full blur-3xl" />
      </div>
      
      <Navbar />

      <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <PageLoader loading={loading} variant="list">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header com gradiente */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              {!showYearOverview && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowYearOverview(true)}
                  className="hover:bg-primary/10 transition-colors shrink-0"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              )}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    {showYearOverview ? "Gerenciar Questões ENEM" : `Questões ENEM ${selectedYear}`}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {showYearOverview 
                      ? "Selecione um ano para gerenciar as questões"
                      : "Edite manualmente ou automatize a classificação e formatação via IA"
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Visão geral por ano */}
          {showYearOverview ? (
            <Card className="p-6 backdrop-blur-sm bg-card/80 border-border/50 shadow-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Questões por Ano
                  </h2>
                  <div className="text-sm text-muted-foreground mt-1">
                    Total: {yearStats.reduce((acc, s) => acc + s.total, 0)} questões | 
                    {" "}{yearStats.reduce((acc, s) => acc + s.pending, 0)} pendentes de classificação
                  </div>
                </div>
                
                {/* Botões de Classificação Global */}
                <div className="flex gap-2">
                  {isGlobalClassifying ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={toggleGlobalClassificationPause}
                        className="gap-2"
                      >
                        {globalClassificationPaused ? (
                          <>
                            <Play className="h-4 w-4" />
                            Retomar
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4" />
                            Pausar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={cancelGlobalClassification}
                        className="gap-2"
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={runGlobalClassification}
                        disabled={yearStats.reduce((acc, s) => acc + s.pending, 0) === 0}
                        className="gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-md hover:shadow-lg transition-all"
                      >
                        <Wand2 className="h-4 w-4" />
                        Classificar Todas ({yearStats.reduce((acc, s) => acc + s.pending, 0)})
                      </Button>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Barra de progresso da classificação global */}
              <AnimatePresence>
                {isGlobalClassifying && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/20"
                  >
                    {/* Status de pausa */}
                    {globalProgress.isPaused ? (
                      <div className="flex items-center justify-center gap-3 py-4 text-amber-500">
                        <Pause className="h-5 w-5" />
                        <span className="text-lg font-medium">
                          Pausando por {globalProgress.pauseCountdown}s para evitar exceder limites...
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          Classificando ano {globalProgress.currentYear}... 
                          ({globalProgress.processedQuestions}/{globalProgress.totalPending})
                        </span>
                        <span className="text-primary font-medium">
                          {globalProgress.totalPending > 0 
                            ? `${Math.round((globalProgress.processedQuestions / globalProgress.totalPending) * 100)}%`
                            : "0%"
                          }
                        </span>
                      </div>
                    )}
                    <Progress 
                      value={globalProgress.totalPending > 0 
                        ? (globalProgress.processedQuestions / globalProgress.totalPending) * 100 
                        : 0
                      } 
                      className="h-3 mb-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Anos processados: {globalProgress.processedYears}/{globalProgress.totalYears}
                      </span>
                      <span>
                        Tempo restante: {globalProgress.estimatedRemaining}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {loadingStats ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {yearStats.map((stat) => (
                    <motion.div
                      key={stat.year}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (!isGlobalClassifying) {
                          setSelectedYear(stat.year);
                          setShowYearOverview(false);
                        }
                      }}
                      className={cn("cursor-pointer", isGlobalClassifying && "pointer-events-none opacity-70")}
                    >
                      <Card className={cn(
                        "p-4 border transition-all hover:shadow-md",
                        stat.total === 0 
                          ? "border-border/30 bg-muted/20 opacity-60" 
                          : stat.ready === stat.total 
                            ? "border-green-500/30 bg-green-500/5 hover:border-green-500/50"
                            : stat.pending > 0 
                              ? "border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50"
                              : "border-border/50 hover:border-primary/50",
                        isGlobalClassifying && globalProgress.currentYear === stat.year && "ring-2 ring-primary animate-pulse"
                      )}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-lg">ENEM {stat.year}</span>
                          <Badge 
                            variant={stat.total === 0 ? "secondary" : stat.ready === stat.total ? "default" : "outline"}
                            className={cn(
                              stat.ready === stat.total && stat.total > 0 && "bg-green-500 hover:bg-green-600",
                              stat.pending > 0 && "border-yellow-500 text-yellow-600 dark:text-yellow-400"
                            )}
                          >
                            {stat.total} questões
                          </Badge>
                        </div>
                        
                        {stat.total > 0 && (
                          <>
                            <Progress 
                              value={(stat.ready / stat.total) * 100} 
                              className="h-2 mb-3"
                            />
                            <div className="flex flex-wrap gap-2 text-xs">
                              {stat.ready > 0 && (
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <CheckCircle className="h-3 w-3" />
                                  {stat.ready} prontas
                                </span>
                              )}
                              {stat.pending > 0 && (
                                <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                                  <Loader2 className="h-3 w-3" />
                                  {stat.pending} pendentes
                                </span>
                              )}
                              {stat.needsReview > 0 && (
                                <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                  <AlertCircle className="h-3 w-3" />
                                  {stat.needsReview} revisão
                                </span>
                              )}
                            </div>
                          </>
                        )}
                        
                        {stat.total === 0 && (
                          <p className="text-xs text-muted-foreground">Nenhuma questão importada</p>
                        )}
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <>

          {/* Controles com visual aprimorado */}
          <Card className="p-6 mb-6 backdrop-blur-sm bg-card/80 border-border/50 shadow-lg">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Seletor de Ano com ícone */}
              <div className="flex-1">
                <Label htmlFor="year" className="mb-2 block text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  Ano da Prova
                </Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="year" className="bg-background/50 border-border/50 hover:border-primary/50 transition-colors">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_YEARS.map(year => (
                      <SelectItem key={year} value={year}>
                        <span className="flex items-center gap-2">
                          {parseInt(year) >= 2024 ? (
                            <Database className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Globe className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          ENEM {year}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Busca com visual aprimorado */}
              <div className="flex-1">
                <Label htmlFor="search" className="mb-2 block text-sm font-medium flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" />
                  Buscar Questão
                </Label>
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="search"
                    placeholder="Número, disciplina ou texto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                  />
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex items-end gap-2 flex-wrap">
                {/* Botão de Classificação Assíncrona */}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={runBatchClassification}
                    disabled={isClassifying || classificationStats.pending === 0 || isProcessingAll}
                    variant="outline"
                    className="gap-2 border-accent/30 hover:border-accent/50 hover:bg-accent/10"
                  >
                    {isClassifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Classificar IA ({classificationStats.pending})
                  </Button>
                </motion.div>

                {/* Botão de Automação de Dificuldade */}
                {!isAutomating ? (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={startAutomation}
                      disabled={difficultyStats.unset === 0 || isProcessingAll}
                      className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg transition-all"
                    >
                      <Wand2 className="h-4 w-4" />
                      Dificuldade ({difficultyStats.unset})
                    </Button>
                  </motion.div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={toggleAutomationPause}
                      variant="outline"
                      className="gap-2 border-primary/30 hover:border-primary/50"
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
                      className="shadow-sm"
                    >
                      ×
                    </Button>
                  </div>
                )}

                {/* Botão de Classificação + Dificuldade Combinada */}
                {!isProcessingAll ? (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={runClassifyAndDifficulty}
                      disabled={isClassifying || isAutomating || (classificationStats.pending === 0 && difficultyStats.unset === 0)}
                      className="gap-2 bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 shadow-md hover:shadow-lg transition-all"
                    >
                      <Sparkles className="h-4 w-4" />
                      <Wand2 className="h-4 w-4" />
                      Processar Tudo ({Math.max(classificationStats.pending, difficultyStats.unset)})
                    </Button>
                  </motion.div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={toggleProcessingAllPause}
                      variant="outline"
                      className="gap-2 border-accent/30 hover:border-accent/50"
                    >
                      {processingAllPaused ? (
                        <><Play className="h-4 w-4" /> Retomar</>
                      ) : (
                        <><Pause className="h-4 w-4" /> Pausar</>
                      )}
                    </Button>
                    <Button
                      onClick={cancelProcessingAll}
                      variant="destructive"
                      size="icon"
                      className="shadow-sm"
                    >
                      ×
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Barra de progresso da automação com animação */}
            <AnimatePresence>
              {isAutomating && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      Processando... ({automationProgress}/{automationTotal})
                    </span>
                    <span className="text-primary font-medium">
                      {Math.round((automationProgress / automationTotal) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={(automationProgress / automationTotal) * 100} 
                    className="h-2 bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Taxa: {REQUESTS_PER_MINUTE} requisições/min (1 a cada {REQUEST_INTERVAL_MS / 1000}s)
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Barra de progresso do processamento combinado */}
            <AnimatePresence>
              {isProcessingAll && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden p-4 rounded-lg bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20"
                >
                  {processingAllProgress.isPaused ? (
                    <div className="flex items-center justify-center gap-3 py-2 text-amber-500">
                      <Pause className="h-5 w-5" />
                      <span className="text-lg font-medium">
                        Pausando por {processingAllProgress.pauseCountdown}s (rate limit)...
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                        Classificando + Dificuldade... ({processingAllProgress.processed}/{processingAllProgress.total})
                      </span>
                      <span className="text-accent font-medium">
                        {processingAllProgress.total > 0 
                          ? `${Math.round((processingAllProgress.processed / processingAllProgress.total) * 100)}%`
                          : "0%"
                        }
                      </span>
                    </div>
                  )}
                  <Progress 
                    value={processingAllProgress.total > 0 
                      ? (processingAllProgress.processed / processingAllProgress.total) * 100 
                      : 0
                    } 
                    className="h-2 bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Taxa: ~24 requisições/min | Combina classificação + dificuldade em uma chamada
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Estatísticas de dificuldade com visual aprimorado */}
            <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-4">
              <motion.div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20"
                whileHover={{ scale: 1.02 }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_hsl(142,76%,40%/0.5)]" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Fácil: {difficultyStats.easy}</span>
              </motion.div>
              <motion.div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20"
                whileHover={{ scale: 1.02 }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_hsl(38,92%,50%/0.5)]" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Médio: {difficultyStats.medium}</span>
              </motion.div>
              <motion.div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20"
                whileHover={{ scale: 1.02 }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_hsl(0,84%,60%/0.5)]" />
                <span className="text-sm font-medium text-red-700 dark:text-red-400">Difícil: {difficultyStats.hard}</span>
              </motion.div>
              <motion.div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50"
                whileHover={{ scale: 1.02 }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
                <span className="text-sm font-medium text-muted-foreground">Sem dificuldade: {difficultyStats.unset}</span>
              </motion.div>
            </div>

            {/* Estatísticas de classificação */}
            <div className="mt-3 pt-3 border-t border-border/30 flex flex-wrap gap-4">
              <motion.div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20"
                whileHover={{ scale: 1.02 }}
              >
                <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Prontas: {classificationStats.ready}</span>
              </motion.div>
              <motion.div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20"
                whileHover={{ scale: 1.02 }}
              >
                <Loader2 className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Pendentes: {classificationStats.pending}</span>
              </motion.div>
              <motion.div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20"
                whileHover={{ scale: 1.02 }}
              >
                <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-400">Revisão: {classificationStats.needsReview}</span>
              </motion.div>
            </div>
          </Card>

          {/* Lista de Questões com visual aprimorado */}
          <Card className="overflow-hidden backdrop-blur-sm bg-card/80 border-border/50 shadow-lg">
            {loadingQuestions ? (
              <div className="p-12 flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div className="absolute inset-0 h-10 w-10 rounded-full bg-primary/20 animate-ping" />
                </div>
                <p className="text-muted-foreground text-sm">Carregando questões...</p>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-medium">Nenhuma questão encontrada</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Tente alterar os filtros de busca</p>
              </div>
            ) : (
              <ScrollArea className="h-[60vh] sm:h-[600px]">
                <div className="divide-y divide-border/50">
                  {filteredQuestions.map((question, index) => (
                    <motion.div
                      key={question.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.3) }}
                      className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all duration-300 group"
                    >
                      {/* Número da questão e info principal */}
                      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm sm:text-base group-hover:shadow-[0_0_15px_hsl(217,91%,50%/0.2)] transition-shadow">
                          {question.index}
                        </div>

                        {/* Info da questão - mobile first */}
                        <div className="flex-1 min-w-0 sm:hidden">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {question.title?.substring(0, 50) || "Sem título"}
                            {question.title && question.title.length > 50 && "..."}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs bg-secondary/50">
                              {formatDisciplineName(question.discipline)}
                            </Badge>
                            {question.difficulty && (
                              <DifficultyIndicator 
                                difficulty={question.difficulty} 
                                showLabel={false}
                                size="sm"
                              />
                            )}
                          </div>
                        </div>

                        {/* Botões mobile */}
                        <div className="flex items-center gap-1 sm:hidden">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => analyzeIndividualQuestion(question)}
                            disabled={question.isFromAPI || analyzingQuestionId === question.id}
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                          >
                            {analyzingQuestionId === question.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            ) : (
                              <Wand2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(question)}
                            disabled={question.isFromAPI}
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Info da questão - desktop */}
                      <div className="hidden sm:block flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {question.title?.substring(0, 100) || "Sem título"}
                          {question.title && question.title.length > 100 && "..."}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs bg-secondary/50">
                            {formatDisciplineName(question.discipline)}
                          </Badge>
                          {question.mainTopic && (
                            <Badge variant="outline" className="text-xs border-primary/30 bg-primary/5 text-primary">
                              {question.mainTopic}
                            </Badge>
                          )}
                          {question.language && (
                            <Badge variant="outline" className="text-xs border-border/50">
                              {question.language === "ingles" ? "Inglês" : "Espanhol"}
                            </Badge>
                          )}
                          {question.classificationStatus === "pending_classification" && (
                            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500/50 bg-yellow-500/5">
                              Pendente
                            </Badge>
                          )}
                          {question.classificationStatus === "needs_review" && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-500/50 bg-orange-500/5">
                              Revisão
                            </Badge>
                          )}
                          {question.isFromAPI && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/50 bg-amber-500/5">
                              <Globe className="h-3 w-3 mr-1" />
                              API Externa
                            </Badge>
                          )}
                          {question.isActive === false && (
                            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500/50 bg-yellow-500/10">
                              <Power className="h-3 w-3 mr-1" />
                              Desativada
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Indicador de dificuldade - desktop */}
                      <div className="hidden sm:block flex-shrink-0">
                        <DifficultyIndicator 
                          difficulty={question.difficulty} 
                          showLabel={true}
                          size="sm"
                        />
                      </div>

                      {/* Botão de análise individual - desktop */}
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="hidden sm:block">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => analyzeIndividualQuestion(question)}
                          disabled={question.isFromAPI || analyzingQuestionId === question.id}
                          title={question.isFromAPI ? "Questões da API não podem ser analisadas" : "Analisar dificuldade via IA"}
                          className="hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          {analyzingQuestionId === question.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Wand2 className={cn(
                              "h-4 w-4",
                              question.isFromAPI && "opacity-30"
                            )} />
                          )}
                        </Button>
                      </motion.div>

                      {/* Botão de edição - desktop */}
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="hidden sm:block">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(question)}
                          disabled={question.isFromAPI}
                          title={question.isFromAPI ? "Questões da API não podem ser editadas" : "Editar questão"}
                          className="hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <Edit className={cn(
                            "h-4 w-4",
                            question.isFromAPI && "opacity-30"
                          )} />
                        </Button>
                      </motion.div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>
          </>
          )}
        </motion.div>
        </PageLoader>
      </main>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 flex-shrink-0">
            <DialogTitle>
              Editar Questão {editingQuestion?.index} - ENEM {editingQuestion?.year}
            </DialogTitle>
          </DialogHeader>

          {editingQuestion && (
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="space-y-6 p-6">
                {/* Status Ativo/Desativado */}
                <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Status da Questão</Label>
                    <p className="text-xs text-muted-foreground">
                      Questões desativadas não aparecem para usuários
                    </p>
                  </div>
                  <Switch
                    checked={editingQuestion.isActive !== false}
                    onCheckedChange={(checked) => setEditingQuestion({
                      ...editingQuestion,
                      isActive: checked,
                    })}
                  />
                </div>

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
                {/* Assuntos (classificação) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mainTopic">Assunto Principal</Label>
                    <Input
                      id="mainTopic"
                      value={editingQuestion.mainTopic || ""}
                      onChange={(e) => setEditingQuestion({
                        ...editingQuestion,
                        mainTopic: e.target.value,
                      })}
                      placeholder="Ex: Revolução Industrial, Genética Mendeliana..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subtopics">Subassuntos (separados por vírgula)</Label>
                    <Input
                      id="subtopics"
                      value={editingQuestion.subtopics?.join(", ") || ""}
                      onChange={(e) => setEditingQuestion({
                        ...editingQuestion,
                        subtopics: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                      })}
                      placeholder="Ex: Máquina a vapor, Têxtil, Urbanização..."
                    />
                  </div>
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
                  {editingQuestion.alternatives?.map((alt: QuestionAlternative, idx: number) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex gap-3 items-start">
                        <div className={cn(
                          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2",
                          alt.letter === editingQuestion.correctAlternative
                            ? "bg-green-500 border-green-500 text-white"
                            : "bg-muted border-border"
                        )}>
                          {alt.letter?.toUpperCase()}
                        </div>
                        <div className="flex-1 space-y-2">
                          <Textarea
                            value={alt.text || ""}
                            onChange={(e) => updateAlternative(idx, "text", e.target.value)}
                            rows={2}
                            className="resize-none"
                          />
                          {/* Upload de imagem para a alternativa */}
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              id={`alt-image-${idx}`}
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                
                                // Validar tamanho (max 5MB)
                                if (file.size > 5 * 1024 * 1024) {
                                  toast.error("Imagem muito grande. Máximo 5MB.");
                                  return;
                                }
                                
                                try {
                                  const fileName = `${editingQuestion.id}-alt-${alt.letter}-${Date.now()}.${file.name.split('.').pop()}`;
                                  const filePath = `alternatives/${fileName}`;
                                  
                                  const { error: uploadError } = await supabase.storage
                                    .from('enem-images')
                                    .upload(filePath, file);
                                  
                                  if (uploadError) throw uploadError;
                                  
                                  const { data: { publicUrl } } = supabase.storage
                                    .from('enem-images')
                                    .getPublicUrl(filePath);
                                  
                                  // Atualiza a alternativa com a URL da imagem
                                  const newAlternatives = [...editingQuestion.alternatives];
                                  newAlternatives[idx] = {
                                    ...newAlternatives[idx],
                                    file: publicUrl,
                                  };
                                  setEditingQuestion({
                                    ...editingQuestion,
                                    alternatives: newAlternatives,
                                  });
                                  
                                  toast.success("Imagem carregada!");
                                } catch (error) {
                                  console.error("Erro ao enviar imagem:", error);
                                  toast.error("Erro ao enviar imagem");
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => document.getElementById(`alt-image-${idx}`)?.click()}
                            >
                              <Upload className="h-3.5 w-3.5" />
                              Adicionar Imagem
                            </Button>
                            {alt.file && (
                              <div className="flex items-center gap-2">
                                <a 
                                  href={alt.file} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  <Image className="h-3 w-3" />
                                  Ver imagem
                                </a>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => {
                                    const newAlternatives = [...editingQuestion.alternatives];
                                    newAlternatives[idx] = {
                                      ...newAlternatives[idx],
                                      file: null,
                                    };
                                    setEditingQuestion({
                                      ...editingQuestion,
                                      alternatives: newAlternatives,
                                    });
                                  }}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Preview da imagem */}
                      {alt.file && (
                        <div className="ml-11 mt-2">
                          <img 
                            src={alt.file} 
                            alt={`Imagem alternativa ${alt.letter}`}
                            className="max-h-32 rounded-lg border border-border/50 object-contain"
                          />
                        </div>
                      )}
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
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t border-border/50 flex-shrink-0 bg-background">
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

export const AdminQuestionsPage = AdminQuestions;
export default AdminQuestions;
