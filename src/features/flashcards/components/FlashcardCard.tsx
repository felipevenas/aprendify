import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { studyActivityTracker } from "@/features/gamification/services/studyActivityTracker";

interface FlashcardCardProps {
  front?: string;
  back?: string;
  subjectName?: string;
  subjectColor?: string;
  flashcard?: {
    id?: string;
    front_content?: string;
    back_content?: string;
    front?: string;
    back?: string;
    subject_id?: string | null;
  };
  onNext?: () => void;
}

/**
 * Componente de cartão de flashcard com animação de flip
 * Clique para virar entre frente (pergunta) e verso (resposta)
 * Contabiliza como estudo real no mapa de calor ao virar o cartão
 */
const FlashcardCard = ({ 
  front, 
  back, 
  subjectName, 
  subjectColor, 
  flashcard,
  onNext 
}: FlashcardCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // Resetar flip ao mudar o flashcard
  useEffect(() => {
    setIsFlipped(false);
  }, [flashcard?.id, front]);

  const displayFront = front || flashcard?.front_content || flashcard?.front || "";
  const displayBack = back || flashcard?.back_content || flashcard?.back || "";

  const handleFlip = async () => {
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);

    // Se virou para ler o verso (resposta), contabiliza ação de estudo
    if (nextFlipped) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          studyActivityTracker.recordAction(user.id, "flashcard");
        }
      } catch (err) {
        console.warn("Não foi possível registrar atividade de flashcard:", err);
      }
    }
  };

  return (
    <div className="perspective-1000 w-full max-w-lg mx-auto">
      <motion.div
        className="relative w-full h-72 sm:h-80 cursor-pointer"
        onClick={handleFlip}
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
          <div className="flex-1 flex items-center justify-center p-2 text-center">
            <p className="text-lg sm:text-xl font-medium text-foreground leading-relaxed break-words max-h-48 overflow-y-auto">
              {displayFront}
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
          <div className="flex-1 flex items-center justify-center p-2 text-center">
            <p className="text-lg sm:text-xl font-medium text-foreground leading-relaxed break-words max-h-48 overflow-y-auto">
              {displayBack}
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
