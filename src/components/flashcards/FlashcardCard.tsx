import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";

interface FlashcardCardProps {
  front: string;
  back: string;
  subjectName?: string;
  subjectColor?: string;
}

/**
 * Componente de cartão de flashcard com animação de flip
 * Clique para virar entre frente (pergunta) e verso (resposta)
 */
const FlashcardCard = ({ front, back, subjectName, subjectColor }: FlashcardCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="perspective-1000 w-full max-w-lg mx-auto">
      <motion.div
        className="relative w-full h-72 sm:h-80 cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
      >
        {/* Frente do cartão (Pergunta) */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-6 flex flex-col shadow-xl"
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* Badge da matéria */}
          {subjectName && (
            <div
              className="self-start px-3 py-1 rounded-full text-xs font-medium mb-4"
              style={{
                backgroundColor: `${subjectColor}20`,
                color: subjectColor,
                border: `1px solid ${subjectColor}40`,
              }}
            >
              {subjectName}
            </div>
          )}
          
          {/* Conteúdo */}
          <div className="flex-1 flex items-center justify-center">
            <p className="text-lg sm:text-xl text-center font-medium text-foreground leading-relaxed">
              {front}
            </p>
          </div>

          {/* Indicador de flip */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <RotateCcw className="h-4 w-4" />
            <span>Clique para ver a resposta</span>
          </div>
        </div>

        {/* Verso do cartão (Resposta) */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl border-2 border-accent/20 bg-gradient-to-br from-card via-card to-accent/5 p-6 flex flex-col shadow-xl"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {/* Label de resposta */}
          <div className="self-start px-3 py-1 rounded-full text-xs font-medium mb-4 bg-accent/10 text-accent border border-accent/20">
            Resposta
          </div>

          {/* Conteúdo */}
          <div className="flex-1 flex items-center justify-center">
            <p className="text-lg sm:text-xl text-center font-medium text-foreground leading-relaxed">
              {back}
            </p>
          </div>

          {/* Indicador de flip */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <RotateCcw className="h-4 w-4" />
            <span>Clique para ver a pergunta</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FlashcardCard;
