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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para acessar este recurso.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/question-explanation`,
        {
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
        }
      );

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
    <div className="mt-4 mb-4">
      {/* Botão para ver explicação */}
      <Button
        onClick={fetchExplanation}
        variant={isPremium ? "outline" : "secondary"}
        size="sm"
        disabled={loading}
        className={cn(
          "gap-2 w-full sm:w-auto",
          !isPremium && "opacity-80"
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPremium ? (
          <MessageCircle className="h-4 w-4" />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        {loading ? "Carregando..." : showExplanation && explanation ? "Ocultar Explicação" : "Ver Explicação"}
        {!isPremium && <Crown className="h-3 w-3 ml-1 text-yellow-500" />}
      </Button>

      {/* Explicação */}
      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm text-primary">Explicação</h4>
              </div>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Gerando explicação com IA...</span>
                </div>
              ) : (
                <p className="text-sm text-foreground leading-relaxed">
                  {explanation}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuestionExplanation;
