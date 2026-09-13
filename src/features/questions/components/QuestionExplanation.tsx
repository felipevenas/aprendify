import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, Loader2, Lock, Crown, CheckCircle2, 
  AlertTriangle, Lightbulb, Sparkles, HelpCircle, ArrowRight, BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { normalizeHttpFailure, normalizeRemoteFailure, RemoteFailure, retryAfterLabel } from "@/features/auth/services/remoteErrors";

/**
 * Componente para exibir explicação pedagógica completa com análise de distratores
 */
interface QuestionExplanationProps {
  question: any;
  isPremium: boolean;
  showResult: boolean;
  selectedAlternative?: string | null;
}

interface Distractor {
  letter: string;
  trap_explanation: string;
}

interface StructuredExplanation {
  concept_summary?: string;
  resolution_steps?: string;
  correct_explanation?: string;
  distractors?: Distractor[];
  golden_tip?: string;
}

/**
 * Formata texto com parágrafos e negrito
 */
const formatExplanationText = (text: string): JSX.Element[] => {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  
  return paragraphs.map((paragraph, index) => {
    const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
    
    const formattedContent = parts.map((part, partIndex) => {
      if (part.startsWith('**') && part.endsWith('**')) {
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
      <p key={index} className="text-sm text-foreground leading-relaxed mb-2.5 last:mb-0">
        {formattedContent}
      </p>
    );
  });
};

const QuestionExplanation = ({ question, isPremium, showResult, selectedAlternative }: QuestionExplanationProps) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [structured, setStructured] = useState<StructuredExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [remoteError, setRemoteError] = useState<RemoteFailure | null>(null);

  const correctAlt = (question?.correctAlternative || question?.correct_alternative || "A").toUpperCase();

  // Fallback curto e específico, sem dicas genéricas de prova
  const generatePedagogicalFallback = (q: any, letter: string): StructuredExplanation => {
    const alternatives = q.alternatives || [];
    const correctObj = alternatives.find((a: any) => (a.letter || "").toUpperCase() === letter);
    const correctText = correctObj?.text || "Alternativa correta conforme gabarito oficial.";

    const distractors = alternatives
      .filter((a: any) => (a.letter || "").toUpperCase() !== letter)
      .map((alt: any, idx: number) => ({
        letter: (alt.letter || "").toUpperCase(),
        trap_explanation: `A alternativa afirma "${alt.text?.slice(0, 100)}${alt.text?.length > 100 ? "..." : ""}", mas não atende ao que o enunciado pede.`
      }));

    return {
      concept_summary: `Essa questão de ${q.discipline || "ENEM"} (${q.year || "Edição Oficial"}) avalia a aplicação prática da teoria ao contexto apresentado. O segredo aqui é entender o mecanismo central do assunto sem se apegar a detalhes distorcidos.`,
      resolution_steps: `O texto-base apresenta a situação que deve ser interpretada. A alternativa (${letter}) é a que traduz essa situação de acordo com o conceito cobrado no comando.`,
      correct_explanation: `A alternativa (${letter}) é a correta porque "${correctText}" responde diretamente ao que a questão pergunta.`,
      distractors,
      golden_tip: ""
    };
  };

  // Busca explicação da questão via Edge Function com fallback resiliente
  const fetchExplanation = async () => {
    if (!isPremium) {
      toast({
        title: "Recurso Exclusivo",
        description: "Assine o plano para desbloquear resoluções completas com análise de distratores.",
        variant: "destructive",
      });
      return;
    }

    if (explanation || structured) {
      setShowExplanation(!showExplanation);
      return;
    }

    setRemoteError(null);
    setLoading(true);
    setShowExplanation(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new RemoteFailure(401, "Sua sessão expirou. Entre novamente para continuar.", "unauthorized");
      }

      let data: any = null;
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/question-explanation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            question: {
              title: question.title || question.alternativesIntroduction || "",
              alternativesIntroduction: question.alternativesIntroduction || "",
              context: question.context || "",
              alternatives: question.alternatives || [],
              correctAlternative: correctAlt,
              selectedAlternative: selectedAlternative || "",
              discipline: question.discipline || "",
              year: question.year || "",
              files: (question as any).files || [],
              images: (question as any).images || [],
            },
          }),
        });

        if (!response.ok) throw normalizeHttpFailure(response, { operation: "explanation" });
        data = await response.json();
      } catch (requestError) {
        throw requestError instanceof RemoteFailure ? requestError : normalizeRemoteFailure(requestError, { operation: "explanation" });
      }

      if (data?.structuredExplanation) {
        setExplanation(data.explanation || "");
        setStructured(data.structuredExplanation);
      } else {
        throw new RemoteFailure(502, "A explicação ainda não está disponível. Tente novamente.", "unavailable");
      }
    } catch (error) {
      const failure = error instanceof RemoteFailure ? error : normalizeRemoteFailure(error, { operation: "explanation" });
      setRemoteError(failure);
      toast({
        title: "Não foi possível carregar a explicação",
        description: failure.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!showResult) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-4 mb-4 p-4 bg-primary/5 border border-primary/20 rounded-xl"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground text-sm sm:text-base">
            {isPremium ? "Pergunte ao professor" : "Explicação da questão"}
          </span>
          {isPremium && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
              IA
            </Badge>
          )}
        </div>

        <Button
          onClick={fetchExplanation}
          variant={isPremium ? "default" : "secondary"}
          size="sm"
          disabled={loading}
          className={cn("gap-2 shadow-sm", isPremium && "bg-primary hover:bg-primary/90")}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPremium ? (
            <Sparkles className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          {loading ? "Preparando explicação..." : showExplanation && (explanation || structured) ? "Ocultar Explicação" : "Por que essa é a resposta?"}
          {!isPremium && <Crown className="h-3.5 w-3.5 ml-1 text-yellow-500" />}
        </Button>
      </div>

      {/* Conteúdo da Explicação */}
      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-4 sm:p-5 bg-card border border-border/80 rounded-xl shadow-sm space-y-4">
              {loading ? (
                <div className="flex items-center justify-center gap-3 py-6 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm font-medium">Lendo o enunciado e preparando a explicação...</span>
                </div>
              ) : remoteError ? (
                <Alert variant="destructive" role="alert" aria-live="assertive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p>{remoteError.message}</p>
                    {retryAfterLabel(remoteError.retryAfterSeconds) && <p className="mt-1 text-xs">{retryAfterLabel(remoteError.retryAfterSeconds)}</p>}
                    <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void fetchExplanation()} disabled={loading}>
                      Tentar novamente
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : structured ? (
                <div className="space-y-4">
                  <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Resposta do professor</p>
                    <div className="text-sm leading-relaxed text-foreground">
                      {formatExplanationText(structured.correct_explanation || explanation || "A alternativa correta é a que responde ao comando da questão.")}
                    </div>
                  </div>
                  {structured.concept_summary && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conceito envolvido</p>
                      {formatExplanationText(structured.concept_summary)}
                    </div>
                  )}
                  {structured.resolution_steps && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Como isso se aplica à questão</p>
                      {formatExplanationText(structured.resolution_steps)}
                    </div>
                  )}
                </div>
              ) : explanation ? (
                /* Fallback para explicações em texto simples */
                <div className="space-y-2">
                  {formatExplanationText(explanation)}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default QuestionExplanation;
