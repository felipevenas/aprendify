import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { formatDisciplineName, separateTextAndReference } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface QuestionData {
  id: string;
  title: string;
  context: string | null;
  alternatives: Array<{ letter: string; text: string }>;
  alternatives_introduction: string | null;
  discipline: string;
  year: string;
  index: number;
  files: string[] | null;
}

interface SimuladoQuestionProps {
  question: QuestionData;
  questionIndex: number;
  totalQuestions: number;
  selectedAnswer: string | null;
  onAnswerSelect: (answer: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onFlag?: () => void;
  isFlagged?: boolean;
}

/**
 * Question display component for simulados
 * Does NOT show correct/incorrect feedback (only shown at the end)
 */
export const SimuladoQuestion = ({
  question,
  questionIndex,
  totalQuestions,
  selectedAnswer,
  onAnswerSelect,
  onPrevious,
  onNext,
  onFlag,
  isFlagged
}: SimuladoQuestionProps) => {
  // Separate context text from references
  const { mainText, reference } = question.context 
    ? separateTextAndReference(question.context)
    : { mainText: "", reference: "" };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Question Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Questão {question.index} - ENEM {question.year}
          </Badge>
          <Badge variant="outline">
            {formatDisciplineName(question.discipline)}
          </Badge>
        </div>
        {onFlag && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(isFlagged && "text-yellow-500")}
            onClick={onFlag}
          >
            <Flag className="h-4 w-4 mr-1" />
            {isFlagged ? "Marcada" : "Marcar"}
          </Button>
        )}
      </div>

      {/* Question Content */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Images */}
          {question.files && question.files.length > 0 && (
            <div className="flex flex-wrap gap-4 justify-center">
              {question.files.map((file, idx) => (
                <img
                  key={idx}
                  src={file}
                  alt={`Imagem da questão ${idx + 1}`}
                  className="max-w-full h-auto rounded-lg border max-h-64 object-contain"
                />
              ))}
            </div>
          )}

          {/* Context */}
          {mainText && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {mainText}
              </p>
            </div>
          )}

          {/* Reference */}
          {reference && (
            <div className="border-l-2 border-muted pl-4 mt-4">
              <p className="text-sm text-muted-foreground italic">
                {reference}
              </p>
            </div>
          )}

          {/* Question Title/Statement */}
          <div className="font-medium text-foreground">
            {question.title}
          </div>

          {/* Alternatives Introduction */}
          {question.alternatives_introduction && (
            <p className="text-sm text-muted-foreground">
              {question.alternatives_introduction}
            </p>
          )}

          {/* Alternatives */}
          <div className="space-y-2 pt-2">
            {question.alternatives.map((alt) => (
              <button
                key={alt.letter}
                onClick={() => onAnswerSelect(alt.letter)}
                className={cn(
                  "w-full text-left p-4 rounded-lg border transition-all",
                  "hover:border-primary/50 hover:bg-primary/5",
                  selectedAnswer === alt.letter 
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20" 
                    : "border-border"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                    selectedAnswer === alt.letter
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {alt.letter.toUpperCase()}
                  </span>
                  <span className="flex-1 pt-1">{alt.text}</span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={questionIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Anterior
        </Button>

        <span className="text-sm text-muted-foreground">
          {questionIndex + 1} / {totalQuestions}
        </span>

        <Button
          variant="outline"
          onClick={onNext}
          disabled={questionIndex === totalQuestions - 1}
        >
          Próxima
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
};
