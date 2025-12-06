import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2, Lock, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Componente para exibir explicação de questão via IA
 * Apenas usuários premium podem acessar
 */
interface QuestionExplanationProps {
  question: any;
  isPremium: boolean;
  showResult: boolean;
}

/**
 * Formata o texto da explicação para exibição com parágrafos e negrito
 * Converte **texto** para <strong> e quebras de linha para parágrafos
 */
const formatExplanationText = (text: string): JSX.Element[] => {
  // Divide por linhas em branco para criar parágrafos
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  
  return paragraphs.map((paragraph, index) => {
    // Processa negrito (**texto**)
    const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
    
    const formattedContent = parts.map((part, partIndex) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Remove os asteriscos e retorna em negrito
        const boldText = part.slice(2, -2);
        return (
          <strong key={partIndex} className="font-semibold text-primary">
            {boldText}
          </strong>
        );
      }
      return <span key={partIndex}>{part}</span>;
    });

    return (
      <p key={index} className="text-sm text-foreground leading-relaxed mb-3 last:mb-0">
        {formattedContent}
      </p>
    );
  });
};

const QuestionExplanation = ({ question, isPremium, showResult }: QuestionExplanationProps) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // Busca explicação da questão via edge function
  const fetchExplanation = async () => {
    if (!isPremium) {
      toast({
        title: "Recurso Premium",
        description: "Assine o Premium para ter acesso às explicações das questões.",
        variant: "destructive",
      });
      return;
    }

    if (explanation) {
      setShowExplanation(!showExplanation);
      return;
    }

    setLoading(true);
    setShowExplanation(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para acessar este recurso.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/question-explanation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          question: {
            title: question.title || question.alternativesIntroduction,
            context: question.context,
            alternatives: question.alternatives,
            correctAlternative: question.correctAlternative,
            discipline: question.discipline,
            year: question.year,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao buscar explicação");
      }

      setExplanation(data.explanation);
    } catch (error: any) {
      console.error("Erro ao buscar explicação:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível carregar a explicação.",
        variant: "destructive",
      });
      setShowExplanation(false);
    } finally {
      setLoading(false);
    }
  };

  // Só mostra após o usuário responder
  if (!showResult) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-4 mb-4 p-4 bg-primary/5 border border-primary/20 rounded-lg"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <span className="font-medium text-foreground">
            {isPremium ? "Quer entender a resolução?" : "Explicação detalhada"}
          </span>
        </div>

        {/* Botão para ver explicação */}
        <Button
          onClick={fetchExplanation}
          variant={isPremium ? "default" : "secondary"}
          size="sm"
          disabled={loading}
          className={cn("gap-2", isPremium && "bg-primary hover:bg-primary/90")}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPremium ? (
            <MessageCircle className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          {loading ? "Carregando..." : showExplanation && explanation ? "Ocultar" : "Ver Explicação"}
          {!isPremium && <Crown className="h-3 w-3 ml-1 text-yellow-500" />}
        </Button>
      </div>

      {/* Explicação formatada */}
      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-4 bg-background border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm text-primary">Explicação</h4>
              </div>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Buscando a melhor explicação para você...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {explanation && formatExplanationText(explanation)}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default QuestionExplanation;
