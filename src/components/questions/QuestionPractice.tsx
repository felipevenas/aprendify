import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDisciplineName, cleanMarkdownArtifacts, separateTextAndReference } from "@/lib/formatters";
import QuestionExplanation from "./QuestionExplanation";

/**
 * Componente de prática de questões
 * Exibe a questão, alternativas e feedback visual após resposta
 */
interface QuestionPracticeProps {
  question: any;
  onNext: () => void;
  onAnswer?: (questionId: string, selectedAnswer: string, correctAnswer: string, isCorrect: boolean) => void;
  isPremium?: boolean;
}

const QuestionPractice = ({ question, onNext, onAnswer, isPremium = false }: QuestionPracticeProps) => {
  const [selectedAlternative, setSelectedAlternative] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Processa o contexto para separar texto da referência
  const processedContext = useMemo(() => {
    if (!question.context) return null;
    return separateTextAndReference(question.context);
  }, [question.context]);

  // Handler para selecionar alternativa
  const handleSelectAlternative = (letter: string) => {
    if (showResult) return; // Não permite mudar após mostrar resultado
    setSelectedAlternative(letter);
  };

  // Confirma a resposta e mostra resultado
  const handleConfirmAnswer = () => {
    if (!selectedAlternative) return;
    setShowResult(true);
    
    // Salva a resposta se a callback foi fornecida
    if (onAnswer) {
      const correctAlt = question.correctAlternative;
      const isCorrect = selectedAlternative === correctAlt;
      
      // Cria ID único da questão: ano-disciplina-index
      // Ex: "2023-ciencias-natureza-99"
      const questionId = `${question.year}-${question.discipline}-${question.index}`;
      
      console.log("Confirmando resposta:", {
        questionId,
        selectedAlternative,
        correctAlt,
        isCorrect,
        questionData: { year: question.year, discipline: question.discipline, index: question.index }
      });
      
      onAnswer(questionId, selectedAlternative, correctAlt, isCorrect);
    }
  };

  // Handler para próxima questão
  const handleNextQuestion = () => {
    setSelectedAlternative(null);
    setShowResult(false);
    onNext();
  };

  // Verifica se a alternativa está correta
  const isCorrect = selectedAlternative === question.correctAlternative;

  // Mapeia disciplinas para cores (usando nomes formatados)
  const getDisciplineColor = (discipline: string): string => {
    const normalized = discipline.toLowerCase();
    if (normalized.includes('linguagens')) return "bg-blue-500/10 text-blue-700 border-blue-500";
    if (normalized.includes('humanas')) return "bg-purple-500/10 text-purple-700 border-purple-500";
    if (normalized.includes('natureza')) return "bg-green-500/10 text-green-700 border-green-500";
    if (normalized.includes('matematica')) return "bg-orange-500/10 text-orange-700 border-orange-500";
    return "bg-primary/10 text-primary border-primary";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="p-6 sm:p-8 border-border/50 shadow-lg">
        {/* Header da questão */}
        <div className="mb-6 pb-6 border-b border-border">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Badge com número da questão e ano do ENEM */}
            <Badge variant="outline" className="text-sm font-semibold bg-primary/5 border-primary/30">
              Questão {question.index} - ENEM {question.year || new Date().getFullYear()}
            </Badge>
            {question.discipline && (
              <Badge 
                className={cn(
                  "border",
                  getDisciplineColor(question.discipline)
                )}
              >
                {formatDisciplineName(question.discipline)}
              </Badge>
            )}
            {question.language && (
              <Badge variant="secondary">
                {question.language === "ingles" ? "Inglês" : "Espanhol"}
              </Badge>
            )}
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
            <p className="font-medium text-foreground">
              {cleanMarkdownArtifacts(question.alternativesIntroduction)}
            </p>
          </div>
        )}

        {/* Alternativas */}
        <div className="space-y-3 mb-6">
          {question.alternatives.map((alt: any) => {
              const isSelected = selectedAlternative === alt.letter;
              const isCorrectAlt = alt.letter === question.correctAlternative;
              
              // Define cor da alternativa
              let bgColor = "bg-card hover:bg-muted/30";
              let borderColor = "border-border";
              let textColor = "text-foreground";

              if (showResult) {
                if (isCorrectAlt) {
                  bgColor = "bg-green-500/10";
                  borderColor = "border-green-500";
                  textColor = "text-green-700";
                } else if (isSelected && !isCorrect) {
                  bgColor = "bg-red-500/10";
                  borderColor = "border-red-500";
                  textColor = "text-red-700";
                }
              } else if (isSelected) {
                bgColor = "bg-primary/5";
                borderColor = "border-primary";
                textColor = "text-primary";
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
                    showResult && "cursor-default"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Letra da alternativa */}
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2",
                      showResult && isCorrectAlt && "bg-green-500 border-green-500 text-white",
                      showResult && isSelected && !isCorrect && "bg-red-500 border-red-500 text-white",
                      !showResult && isSelected && "bg-primary border-primary text-white",
                      !showResult && !isSelected && "bg-background border-border"
                    )}>
                      {alt.letter?.toUpperCase()}
                    </div>

                    {/* Texto da alternativa */}
                    <div className="flex-1">
                      <p className={cn("text-sm sm:text-base", textColor)}>
                        {cleanMarkdownArtifacts(alt.text)}
                      </p>
                      
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
              isCorrect ? "bg-green-500/10 border border-green-500" : "bg-red-500/10 border border-red-500"
            )}
          >
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
                      Você selecionou a alternativa {selectedAlternative}, mas a resposta correta é {question.correctAlternative}.
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Botão de Explicação - apenas após responder */}
        <QuestionExplanation 
          question={question} 
          isPremium={isPremium} 
          showResult={showResult} 
        />

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
          {!showResult ? (
            <>
              <Button
                onClick={handleNextQuestion}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
              >
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
            <Button
              onClick={handleNextQuestion}
              className="gap-2 w-full sm:w-auto"
              size="lg"
            >
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
