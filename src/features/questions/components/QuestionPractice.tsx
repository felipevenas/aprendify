import { useState, useMemo, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, ChevronRight, Loader2, ThumbsUp, HelpCircle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDisciplineName, cleanMarkdownArtifacts, hasContextContent, separateTextAndReference } from "@/lib/formatters";
import QuestionExplanation from "./QuestionExplanation";
import DifficultyIndicator from "./DifficultyIndicator";
import { supabase } from "@/integrations/supabase/client";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { StudyQuestion, QuestionAlternative } from "../types";
import QuestionMedia from "./question-media";
import { getAlternativeImages, getQuestionImages } from "./question-media-utils";

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
const getQuestionKey = (question: StudyQuestion): string => {
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
  question: StudyQuestion;
  onNext: () => void;
  onAnswer?: (questionId: string, selectedAnswer: string, correctAnswer?: string, isCorrect?: boolean, hadDoubt?: boolean) => void;
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

        const questionId = question.id || `${question.year}-${question.discipline}-${question.index}`;
        
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
    const context = separateTextAndReference(question.context);
    return hasContextContent(context) ? context : null;
  }, [question.context]);

  const questionTitle = useMemo(() => {
    const title = question.title ? cleanMarkdownArtifacts(question.title) : "";
    if (/^Questão\s+\d+\s+-\s+ENEM\s+\d{4}$/i.test(title)) return null;
    return title || null;
  }, [question.title]);

  const questionImages = useMemo(
    () => getQuestionImages(question),
    [question.files, question.images],
  );

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
      const questionId = question.id || `${question.year}-${question.discipline}-${question.index}`;
      onAnswer(questionId, selectedAlternative);
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
      <Card className="w-full overflow-hidden rounded-2xl border-border/70 bg-card shadow-card">
        {/* Header da questão */}
        <div className="border-b border-border/70 bg-muted/15 px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Lado esquerdo: Número da questão + badge de avaliação anterior */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-background text-primary">
                ENEM {question.year || new Date().getFullYear()} • Questão {question.index}
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
            
            {/* Metadados da questão */}
            <div className="flex flex-wrap items-center gap-2">
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

          {question.topic && (
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Tópico:</span> {question.topic}
            </p>
          )}
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          {/* Contexto da questão */}
          {processedContext && (
            <blockquote className="mb-6 rounded-r-2xl border-l-2 border-primary bg-muted/35 px-4 py-4 text-sm leading-relaxed text-muted-foreground sm:px-5 sm:py-4 sm:text-[0.9375rem]">
              <p className="whitespace-pre-wrap italic">
                {processedContext.mainText}
              </p>
              {processedContext.reference && (
                <footer className="mt-4 border-l border-primary/25 pl-3 text-xs italic text-muted-foreground sm:text-sm">
                  {processedContext.reference}
                </footer>
              )}
            </blockquote>
          )}

          {questionTitle && (
            <p className="mb-6 text-base font-semibold leading-relaxed text-foreground sm:text-lg">
              {questionTitle}
            </p>
          )}

          {/* Imagens da questão */}
        {questionImages.length > 0 && (
          <div className="mb-6">
            <QuestionMedia images={questionImages} altPrefix="Imagem do enunciado" />
          </div>
        )}

        {/* Introdução das alternativas */}
          {question.alternativesIntroduction && (
            <p className="mb-5 text-base font-semibold leading-relaxed text-foreground">
              {cleanMarkdownArtifacts(question.alternativesIntroduction)}
            </p>
          )}

        {/* Alternativas */}
        <div className="space-y-2.5" role="radiogroup" aria-label="Alternativas da questão">
          {question.alternatives.map((alt: QuestionAlternative) => {
            const isSelected = selectedAlternative === alt.letter;
            const isCorrectAlt = alt.letter === question.correctAlternative;
            const alternativeImages = getAlternativeImages(alt);

            // Define cor da alternativa
            let bgColor = "bg-card";
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
                type="button"
                onClick={() => handleSelectAlternative(alt.letter)}
                disabled={showResult}
                role="radio"
                aria-checked={isSelected}
                className={cn(
                  "w-full rounded-xl border px-3.5 py-3.5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:px-4 sm:py-4",
                  bgColor,
                  borderColor,
                  !showResult && "cursor-pointer hover:border-primary/45 hover:bg-muted/20",
                  !showResult && isSelected && "shadow-sm",
                  showResult && "cursor-default",
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Letra da alternativa */}
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors sm:h-8 sm:w-8 sm:text-sm",
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
                    <p className={cn("text-sm leading-relaxed sm:text-[0.9375rem]", textColor)}>{cleanMarkdownArtifacts(alt.text)}</p>

                    {/* Imagens da alternativa */}
                    {alternativeImages.length > 0 && (
                      <div className="mt-4">
                        <QuestionMedia
                          images={alternativeImages}
                          altPrefix={`Alternativa ${alt.letter} - imagem`}
                          compact
                        />
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
              "mt-4 p-4 rounded-lg mb-6",
              isCorrect ? "bg-green-500/10 border border-green-500" : "bg-red-500/10 border border-red-500",
            )}
          >
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
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
        <QuestionExplanation
          question={question}
          isPremium={isPremium}
          showResult={showResult}
          selectedAlternative={selectedAlternative}
        />

        {/* Rodapé de ação no mesmo ritmo visual da landing page */}
        <div className="mt-8 flex flex-col gap-4 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          {!showResult && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lightbulb className="h-4 w-4 flex-shrink-0 text-warning" aria-hidden="true" />
              <span>Selecione uma alternativa para habilitar o envio.</span>
            </div>
          )}

          <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:justify-end sm:gap-3">
            {!showResult ? (
              <>
                <Button onClick={handleNextQuestion} variant="outline" size="lg" className="w-full sm:w-auto">
                  Pular Questão
                </Button>
                <Button
                  onClick={handleConfirmAnswer}
                  disabled={!selectedAlternative}
                  className="w-full gap-2 sm:w-auto"
                  size="lg"
                >
                  Confirmar Resposta
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button onClick={handleNextQuestion} className="w-full gap-2 sm:w-auto" size="lg">
                Próxima Questão
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default QuestionPractice;
