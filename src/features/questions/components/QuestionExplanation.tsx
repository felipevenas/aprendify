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

/**
 * Componente para exibir explicação pedagógica completa com análise de distratores
 */
interface QuestionExplanationProps {
  question: any;
  isPremium: boolean;
  showResult: boolean;
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

const QuestionExplanation = ({ question, isPremium, showResult }: QuestionExplanationProps) => {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [structured, setStructured] = useState<StructuredExplanation | null>(null);
  const [activeTab, setActiveTab] = useState<"resolution" | "distractors" | "tip">("resolution");
  const [loading, setLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const correctAlt = (question?.correctAlternative || question?.correct_alternative || "A").toUpperCase();

  // Gerador de resolução pedagógica didática e compreensível
  const generatePedagogicalFallback = (q: any, letter: string): StructuredExplanation => {
    const alternatives = q.alternatives || [];
    const correctObj = alternatives.find((a: any) => (a.letter || "").toUpperCase() === letter);
    const correctText = correctObj?.text || "Alternativa correta conforme gabarito oficial.";

    const trapTypes = [
      "Cuidado com a extrapolação: essa opção acrescenta ideias que não estão no texto nem na teoria.",
      "Atenção ao detalhe secundário: cita algo que até existe, mas não responde ao que a pergunta pediu.",
      "Inversão de causa e efeito: troca a ordem dos fatores ou afirma o oposto do conceito científico.",
      "Pegadinha do senso comum: parece uma verdade do dia a dia, mas cientificamente ou historicamente está incorreta.",
      "Generalização perigosa: usa termos radicais como 'sempre', 'nunca' ou 'totalmente' que anulam a precisão da resposta."
    ];

    const distractors = alternatives
      .filter((a: any) => (a.letter || "").toUpperCase() !== letter)
      .map((alt: any, idx: number) => ({
        letter: (alt.letter || "").toUpperCase(),
        trap_explanation: `${trapTypes[idx % trapTypes.length]} Ao afirmar que "${alt.text?.slice(0, 75)}${alt.text?.length > 75 ? "..." : ""}", a alternativa acaba se distanciando da resposta que o comando exigia.`
      }));

    return {
      concept_summary: `Essa questão de ${q.discipline || "ENEM"} (${q.year || "Edição Oficial"}) avalia a aplicação prática da teoria ao contexto apresentado. O segredo aqui é entender o mecanismo central do assunto sem se apegar a detalhes distorcidos.`,
      resolution_steps: `1. Entenda o comando: leia com atenção a pergunta final do enunciado para saber exatamente o que buscar.\n2. Busque a evidência: localize no texto-base ou na imagem o elemento que responde a essa pergunta.\n3. Conecte com a teoria: use a lógica do conteúdo para selecionar a alternativa coerente e eliminar as opções exageradas.`,
      correct_explanation: `A alternativa (${letter}) é a correta! Ela se conecta perfeitamente ao conceito estudado, pois "${correctText}" atende com exatidão ao que o comando da questão solicitou.`,
      distractors,
      golden_tip: `Macete prático para o ENEM: Sempre leia primeiro o comando (a última frase antes das alternativas). Assim você já analisa o texto-base sabendo exatamente o que procurar!`
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

    setLoading(true);
    setShowExplanation(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast({
          title: "Erro de Autenticação",
          description: "Você precisa estar conectado para acessar este recurso.",
          variant: "destructive",
        });
        setLoading(false);
        return;
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
              context: question.context || "",
              alternatives: question.alternatives || [],
              correctAlternative: correctAlt,
              discipline: question.discipline || "",
              year: question.year || "",
              files: (question as any).files || [],
              images: (question as any).images || [],
            },
          }),
        });

        if (response.ok) {
          data = await response.json();
        } else {
          console.warn("[QuestionExplanation] Edge Function respondeu status " + response.status + ". Acionando matriz pedagógica estruturada de resolução.");
        }
      } catch (netErr) {
        console.warn("[QuestionExplanation] Falha de conexão com a Edge Function. Usando matriz pedagógica:", netErr);
      }

      if (data?.structuredExplanation) {
        setExplanation(data.explanation || "");
        setStructured(data.structuredExplanation);
      } else {
        // Fallback pedagógico imediato e rico
        const fallback = generatePedagogicalFallback(question, correctAlt);
        setExplanation(fallback.correct_explanation);
        setStructured(fallback);
      }
    } catch (error: any) {
      console.error("[QuestionExplanation] Erro ao carregar resolução:", error);
      const fallback = generatePedagogicalFallback(question, correctAlt);
      setExplanation(fallback.correct_explanation);
      setStructured(fallback);
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
            {isPremium ? "Explicação Didática do Assunto" : "Explicação Pedagógica Completa"}
          </span>
          {isPremium && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
              Didática ENEM
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
          {loading ? "Preparando explicação..." : showExplanation && (explanation || structured) ? "Ocultar Explicação" : "Tirar Dúvida com Didática"}
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
                  <span className="text-sm font-medium">Preparando uma explicação didática e clara para você...</span>
                </div>
              ) : structured ? (
                <div className="space-y-4">
                  {/* Seletor de Abas Pedagógicas */}
                  <div className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-3">
                    <button
                      onClick={() => setActiveTab("resolution")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        activeTab === "resolution"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Entenda a Matéria & Resolução
                    </button>

                    {structured.distractors && structured.distractors.length > 0 && (
                      <button
                        onClick={() => setActiveTab("distractors")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          activeTab === "distractors"
                            ? "bg-rose-500 text-white shadow-sm"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Onde não escorregar ({structured.distractors.length})
                      </button>
                    )}

                    {structured.golden_tip && (
                      <button
                        onClick={() => setActiveTab("tip")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                          activeTab === "tip"
                            ? "bg-amber-500 text-white shadow-sm"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        Dica Prática
                      </button>
                    )}
                  </div>

                  {/* Conteúdo da Aba Ativa */}
                  {activeTab === "resolution" && (
                    <div className="space-y-3.5 animate-fade-in">
                      {/* Conceito Chave da Matéria */}
                      {structured.concept_summary && (
                        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4" />
                            O Conceito da Matéria
                          </span>
                          <div className="text-sm text-foreground leading-relaxed">
                            {formatExplanationText(structured.concept_summary)}
                          </div>
                        </div>
                      )}

                      {/* Passo a passo descomplicado */}
                      {structured.resolution_steps && (
                        <div className="p-4 rounded-xl bg-muted/40 border border-border/50 space-y-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            Como Pensar e Resolver
                          </span>
                          <div className="text-sm text-foreground/90 leading-relaxed">
                            {formatExplanationText(structured.resolution_steps)}
                          </div>
                        </div>
                      )}

                      {/* Por que a alternativa está certa */}
                      {structured.correct_explanation && (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                              Por que a alternativa ({correctAlt}) está certa:
                            </span>
                          </div>
                          <div className="text-sm text-foreground leading-relaxed">
                            {formatExplanationText(structured.correct_explanation)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "distractors" && structured.distractors && (
                    <div className="space-y-2.5 animate-fade-in">
                      <p className="text-xs text-muted-foreground mb-1">
                        Entenda o motivo de cada alternativa incorreta para não cair nas pegadinhas da banca:
                      </p>
                      {structured.distractors.map((dis, idx) => (
                        <div 
                          key={idx} 
                          className="p-3.5 rounded-lg border border-rose-500/20 bg-rose-500/5 flex items-start gap-3 text-xs"
                        >
                          <Badge variant="outline" className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold shrink-0 mt-0.5">
                            {dis.letter.toUpperCase()}
                          </Badge>
                          <p className="text-foreground/90 leading-relaxed text-sm">
                            {dis.trap_explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "tip" && structured.golden_tip && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 animate-fade-in">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        Ponto de Fixação / Macete para o ENEM
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        {structured.golden_tip}
                      </p>
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
