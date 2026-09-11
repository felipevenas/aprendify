import { useState, useMemo, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, ChevronRight, Loader2, ThumbsUp, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDisciplineName, cleanMarkdownArtifacts, separateTextAndReference } from "@/lib/formatters";
import QuestionExplanation from "./QuestionExplanation";
import DifficultyIndicator from "./DifficultyIndicator";
import { supabase } from "@/integrations/supabase/client";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ============= Cache de Dificuldade (localStorage) =============
// Usado para questões da API externa (2009-2023) que não têm banco de dados
const DIFFICULTY_CACHE_KEY = "enem_difficulty_cache";

interface DifficultyCache {
  [questionKey: string]: {
    difficulty: "easy" | "medium" | "hard";
    analyzedAt: number;
  };
}

/**
 * Gera uma chave única para a questão (funciona para banco local e API externa)
 */
const getQuestionKey = (question: any): string => {
  // Se tem ID do banco, usa ele
  if (question.id) return `db_${question.id}`;
  // Caso contrário, gera chave baseada em ano-disciplina-index
  return `api_${question.year}-${question.discipline}-${question.index}`;
};

/**
 * Recupera dificuldade do cache local
 */
const getCachedDifficulty = (questionKey: string): "easy" | "medium" | "hard" | null => {
  try {
    const cache = JSON.parse(localStorage.getItem(DIFFICULTY_CACHE_KEY) || "{}") as DifficultyCache;
    return cache[questionKey]?.difficulty || null;
  } catch {
    return null;
  }
};

/**
 * Salva dificuldade no cache local
 */
const setCachedDifficulty = (questionKey: string, difficulty: "easy" | "medium" | "hard"): void => {
  try {
    const cache = JSON.parse(localStorage.getItem(DIFFICULTY_CACHE_KEY) || "{}") as DifficultyCache;
    cache[questionKey] = {
      difficulty,
      analyzedAt: Date.now(),
    };
    localStorage.setItem(DIFFICULTY_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("[DifficultyCache] Erro ao salvar cache:", error);
  }
};

/**
 * Componente de prática de questões
 * Exibe a questão, alternativas e feedback visual após resposta
 */
interface QuestionPracticeProps {
  question: any;
  onNext: () => void;
  onAnswer?: (questionId: string, selectedAnswer: string, correctAnswer: string, isCorrect: boolean, hadDoubt?: boolean) => void;
  isPremium?: boolean;
}

const QuestionPractice = ({ question, onNext, onAnswer, isPremium = false }: QuestionPracticeProps) => {
  const { playCorrectSound, playIncorrectSound } = useSoundEffects();
  const [selectedAlternative, setSelectedAlternative] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | null>(null);
  const [hadDoubt, setHadDoubt] = useState<boolean | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [analyzingDifficulty, setAnalyzingDifficulty] = useState(false);
  const [previousFeedback, setPreviousFeedback] = useState<boolean | null>(null);

  // Gera chave única para esta questão
  const questionKey = useMemo(() => getQuestionKey(question), [question]);

  // Busca feedback anterior da questão
  useEffect(() => {
    const fetchPreviousFeedback = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const questionId = `${question.year}-${question.discipline}-${question.index}`;
        
        const { data } = await supabase
          .from("question_attempts")
          .select("had_doubt")
          .eq("user_id", user.id)
          .eq("question_id", questionId)
          .not("had_doubt", "is", null)
          .order("created_at", { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          setPreviousFeedback(data[0].had_doubt);
        } else {
          setPreviousFeedback(null);
        }
      } catch (error) {
        console.error("[PreviousFeedback] Erro ao buscar:", error);
        setPreviousFeedback(null);
      }
    };

    setPreviousFeedback(null);
    fetchPreviousFeedback();
  }, [question.year, question.discipline, question.index]);

  // Processa o contexto para separar texto da referência
  const processedContext = useMemo(() => {
    if (!question.context) return null;
    return separateTextAndReference(question.context);
  }, [question.context]);

  /**
   * Analisa dificuldade via IA Groq
   * Funciona para questões do banco local E da API externa
   * Usa cache localStorage para evitar chamadas repetidas
   */
  const analyzeDifficultyWithAI = useCallback(async () => {
    setAnalyzingDifficulty(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("analyze-question-difficulty", {
        body: {
          questionId: question.id || questionKey, // Usa questionKey se não tiver ID
          discipline: question.discipline,
          context: question.context || "",
          title: question.title || "",
          alternatives: question.alternatives || [],
          // Flag para indicar se deve salvar no banco (apenas se tiver ID)
          saveToDatabase: !!question.id,
        },
      });

      if (!error && data?.difficulty) {
        setDifficulty(data.difficulty);
        // Sempre salva no cache local (para questões da API externa)
        setCachedDifficulty(questionKey, data.difficulty);
      }
    } catch (err) {
      console.error("[DifficultyAnalysis] Erro ao analisar dificuldade:", err);
    } finally {
      setAnalyzingDifficulty(false);
    }
  }, [question, questionKey]);

  // Verifica e analisa dificuldade quando a questão muda
  useEffect(() => {
    // 1. Se a questão já tem dificuldade do banco, usa ela
    if (question.difficulty) {
      setDifficulty(question.difficulty);
      return;
    }

    // 2. Verifica se já está no cache local
    const cachedDifficulty = getCachedDifficulty(questionKey);
    if (cachedDifficulty) {
      setDifficulty(cachedDifficulty);
      return;
    }

    // 3. Não tem em nenhum lugar, analisa via IA
    setDifficulty(null);
    analyzeDifficultyWithAI();
  }, [questionKey, question.difficulty, analyzeDifficultyWithAI]);

  // Handler para selecionar alternativa
  const handleSelectAlternative = (letter: string) => {
    if (showResult) return; // Não permite mudar após mostrar resultado
    setSelectedAlternative(letter);
  };

  // Confirma a resposta e mostra resultado
  const handleConfirmAnswer = () => {
    if (!selectedAlternative) return;
    setShowResult(true);

    const correctAlt = question.correctAlternative;
    const isCorrectAnswer = selectedAlternative === correctAlt;

    // Toca som baseado no resultado
    if (isCorrectAnswer) {
      playCorrectSound();
    } else {
      playIncorrectSound();
    }

    // Salva a resposta se a callback foi fornecida (sem hadDoubt ainda)
    if (onAnswer) {
      const questionId = `${question.year}-${question.discipline}-${question.index}`;
      onAnswer(questionId, selectedAlternative, correctAlt, isCorrectAnswer);
    }
  };

  // Handler para feedback de dúvida (apenas para acertos)
  const handleFeedback = async (wasEasy: boolean) => {
    const doubtValue = !wasEasy;
    setHadDoubt(doubtValue);
    setFeedbackSubmitted(true);

    // Atualiza a última tentativa com o feedback
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const questionId = `${question.year}-${question.discipline}-${question.index}`;
      
      // Busca a última tentativa deste usuário para esta questão
      const { data: attempts } = await supabase
        .from("question_attempts")
        .select("id")
        .eq("user_id", user.id)
        .eq("question_id", questionId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (attempts && attempts.length > 0) {
        await supabase
          .from("question_attempts")
          .update({ had_doubt: doubtValue })
          .eq("id", attempts[0].id);
      }
    } catch (error) {
      console.error("[Feedback] Erro ao salvar feedback:", error);
    }
  };

  // Handler para próxima questão
  const handleNextQuestion = () => {
    setSelectedAlternative(null);
    setShowResult(false);
    setHadDoubt(null);
    setFeedbackSubmitted(false);
    onNext();
  };

  // Verifica se a alternativa está correta
  const isCorrect = selectedAlternative === question.correctAlternative;

  // Mapeia disciplinas para cores (usando nomes formatados)
  const getDisciplineColor = (discipline: string): string => {
    const normalized = discipline.toLowerCase();
    if (normalized.includes("linguagens")) return "bg-blue-500/10 text-blue-700 border-blue-500";
    if (normalized.includes("humanas")) return "bg-purple-500/10 text-purple-700 border-purple-500";
    if (normalized.includes("natureza")) return "bg-green-500/10 text-green-700 border-green-500";
    if (normalized.includes("matematica")) return "bg-orange-500/10 text-orange-700 border-orange-500";
    return "bg-primary/10 text-primary border-primary";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="p-6 sm:p-8 border-border/50 shadow-lg">
        {/* Header da questão */}
        <div className="mb-6 pb-6 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            {/* Lado esquerdo: Número da questão + badge de avaliação anterior */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm font-semibold bg-primary/5 border-primary/30">
                Questão {question.index} - ENEM {question.year || new Date().getFullYear()}
              </Badge>
              
              {/* Badge de avaliação anterior */}
              {previousFeedback !== null && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center",
                          previousFeedback
                            ? "bg-amber-100 dark:bg-amber-900/30"
                            : "bg-green-100 dark:bg-green-900/30"
                        )}
                      >
                        {previousFeedback ? (
                          <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
                        ) : (
                          <ThumbsUp className="h-3.5 w-3.5 text-green-600" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{previousFeedback ? "Teve dúvidas anteriormente" : "Respondeu tranquilamente"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            {/* Lado direito: Disciplina + Dificuldade + Idioma */}
            <div className="flex items-center gap-2">
              {question.discipline && (
                <Badge className={cn("border", getDisciplineColor(question.discipline))}>
                  {formatDisciplineName(question.discipline)}
                </Badge>
              )}
              
              {/* Indicador de Dificuldade - ao lado da disciplina */}
              <DifficultyIndicator 
                difficulty={difficulty} 
                showLabel={true}
                size="sm"
                className={analyzingDifficulty ? "opacity-50" : ""}
              />
              
              {question.language && (
                <Badge variant="secondary">{question.language === "ingles" ? "Inglês" : "Espanhol"}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Contexto da questão */}
        {processedContext && (
          <div className="mb-6 p-4 bg-muted/30 rounded-lg space-y-3">
            <p className="text-sm sm:text-base text-foreground whitespace-pre-wrap leading-relaxed">
              {processedContext.mainText}
            </p>
            {processedContext.reference && (
              <p className="text-xs sm:text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3 mt-2">
                {processedContext.reference}
              </p>
            )}
          </div>
        )}

        {/* Imagens da questão */}
        {question.files && question.files.length > 0 && (
          <div className="mb-6 space-y-4">
            {question.files.map((file: string, idx: number) => (
              <img
                key={idx}
                src={file}
                alt={`Imagem da questão ${idx + 1}`}
                className="w-full rounded-lg border border-border"
              />
            ))}
          </div>
        )}

        {/* Introdução das alternativas */}
        {question.alternativesIntroduction && (
          <div className="mb-4">
            <p className="font-medium text-foreground">{cleanMarkdownArtifacts(question.alternativesIntroduction)}</p>
          </div>
        )}

        {/* Alternativas */}
        <div className="space-y-3 mb-6">
          {question.alternatives.map((alt: any) => {
            const isSelected = selectedAlternative === alt.letter;
            const isCorrectAlt = alt.letter === question.correctAlternative;

            // Define cor da alternativa
            let bgColor = "bg-card hover:bg-muted/40";
            let borderColor = "border-border";
            let textColor = "text-foreground";

            if (showResult) {
              if (isCorrectAlt) {
                bgColor = "bg-green-500/10";
                borderColor = "border-green-500";
                textColor = "text-green-700 dark:text-green-400 font-medium";
              } else if (isSelected && !isCorrect) {
                bgColor = "bg-red-500/10";
                borderColor = "border-red-500";
                textColor = "text-red-700 dark:text-red-400 font-medium";
              }
            } else if (isSelected) {
              bgColor = "bg-primary/10 dark:bg-primary/20";
              borderColor = "border-primary";
              textColor = "text-foreground font-medium";
            }

            return (
              <button
                key={alt.letter}
                onClick={() => handleSelectAlternative(alt.letter)}
                disabled={showResult}
                className={cn(
                  "w-full text-left p-4 rounded-lg border-2 transition-all duration-200",
                  bgColor,
                  borderColor,
                  !showResult && "cursor-pointer hover:shadow-md",
                  showResult && "cursor-default",
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Letra da alternativa */}
                  <div
                    className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2",
                      showResult && isCorrectAlt && "bg-green-500 border-green-500 text-white",
                      showResult && isSelected && !isCorrect && "bg-red-500 border-red-500 text-white",
                      !showResult && isSelected && "bg-primary border-primary text-white",
                      !showResult && !isSelected && "bg-background border-border",
                    )}
                  >
                    {alt.letter?.toUpperCase()}
                  </div>

                  {/* Texto da alternativa */}
                  <div className="flex-1">
                    <p className={cn("text-sm sm:text-base", textColor)}>{cleanMarkdownArtifacts(alt.text)}</p>

                    {/* Imagens da alternativa */}
                    {alt.files && alt.files.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {alt.files.map((file: string, idx: number) => (
                          <img
                            key={idx}
                            src={file}
                            alt={`Alternativa ${alt.letter} - Imagem ${idx + 1}`}
                            className="w-full max-w-md rounded border border-border"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ícone de resultado */}
                  {showResult && (
                    <div className="flex-shrink-0">
                      {isCorrectAlt ? (
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      ) : isSelected ? (
                        <XCircle className="h-6 w-6 text-red-600" />
                      ) : null}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Feedback e ações */}
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-lg mb-6",
              isCorrect ? "bg-green-500/10 border border-green-500" : "bg-red-500/10 border border-red-500",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-green-700 mb-1">Parabéns! Resposta correta!</h4>
                      <p className="text-sm text-green-600">
                        Você selecionou a alternativa {selectedAlternative}, que é a resposta correta.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-8 w-8 text-red-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-red-700 mb-1">Ops! Resposta incorreta</h4>
                      <p className="text-sm text-red-600">
                        Você selecionou a alternativa {selectedAlternative}, mas a resposta correta é{" "}
                        {question.correctAlternative}.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Botões de feedback - apenas para acertos */}
              {isCorrect && !feedbackSubmitted && (
                <TooltipProvider>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-green-600 hidden sm:block">Como foi?</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleFeedback(true)}
                          className="w-10 h-10 rounded-full bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 flex items-center justify-center transition-colors"
                        >
                          <ThumbsUp className="h-5 w-5 text-green-600" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tranquilo, sem dúvidas</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleFeedback(false)}
                          className="w-10 h-10 rounded-full bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 flex items-center justify-center transition-colors"
                        >
                          <HelpCircle className="h-5 w-5 text-amber-600" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tive dúvidas (revisar depois)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              )}

              {/* Feedback salvo */}
              {isCorrect && feedbackSubmitted && (
                <div className="text-xs text-green-600">
                  {hadDoubt ? "📝 Marcado para revisão" : "✓ Registrado"}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Botão de Explicação - apenas após responder */}
        <QuestionExplanation question={question} isPremium={isPremium} showResult={showResult} />

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          {!showResult ? (
            <>
              <Button onClick={handleNextQuestion} variant="outline" size="lg" className="w-full sm:w-auto">
                Pular Questão
              </Button>
              <Button
                onClick={handleConfirmAnswer}
                disabled={!selectedAlternative}
                className="gap-2 w-full sm:w-auto"
                size="lg"
              >
                Confirmar Resposta
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button onClick={handleNextQuestion} className="gap-2 w-full sm:w-auto" size="lg">
              Próxima Questão
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

export default QuestionPractice;
