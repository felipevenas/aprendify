import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calendar, Trophy, Lightbulb, Target, CheckCircle, AlertCircle, MessageSquare, PenTool } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";
import { AnnotatedEssayContent, AnnotatedSnippet, getRenderableAnnotatedSnippetCount } from "./AnnotatedEssayContent";
import { InterventionChecklist, InterventionChecklistData } from "./InterventionChecklist";
import { Essay } from "../types";

/**
 * Componente para exibir detalhes completos de uma redação corrigida
 */
interface EssayDetailProps {
  essay: Essay;
  onBack: () => void;
}

// Nomes das competências do ENEM
const competencyNames = [
  "Domínio da norma culta da língua portuguesa",
  "Compreensão da proposta e aplicação de conceitos",
  "Seleção, organização e interpretação de informações",
  "Conhecimento dos mecanismos linguísticos",
  "Elaboração de proposta de intervenção",
];

// Descrições curtas das competências
const competencyDescriptions = [
  "Ortografia, gramática, pontuação e registro formal",
  "Repertório sociocultural e desenvolvimento do tema",
  "Estrutura argumentativa e coerência textual",
  "Conectivos, coesão e articulação entre parágrafos",
  "Proposta com ação, agente, modo, efeito e detalhamento",
];

interface StructuredFeedback {
  competencies: {
    c1: string;
    c2: string;
    c3: string;
    c4: string;
    c5: string;
  };
  strengths: string;
  weaknesses: string;
  intervention_checklist?: InterventionChecklistData;
  annotated_snippets?: AnnotatedSnippet[];
}

const EssayDetail = ({ essay, onBack }: EssayDetailProps) => {
  // Tentar parsear feedback estruturado
  const structuredFeedback = useMemo<StructuredFeedback | null>(() => {
    if (!essay.feedback) return null;
    try {
      const parsed = JSON.parse(essay.feedback);
      if (parsed.competencies) {
        return parsed as StructuredFeedback;
      }
      return null;
    } catch {
      return null;
    }
  }, [essay.feedback]);

  // Cor baseada na nota
  const getScoreColor = (score: number) => {
    if (score >= 160) return "text-green-600";
    if (score >= 120) return "text-yellow-600";
    if (score >= 80) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 160) return "bg-green-500";
    if (score >= 120) return "bg-yellow-500";
    if (score >= 80) return "bg-orange-500";
    return "bg-red-500";
  };

  // Array com as notas das competências
  const competencyScores = [
    essay.score_competency_1,
    essay.score_competency_2,
    essay.score_competency_3,
    essay.score_competency_4,
    essay.score_competency_5,
  ];

  // Pegar feedback por competência
  const getCompetencyFeedback = (index: number): string | null => {
    if (!structuredFeedback) return null;
    const key = `c${index + 1}` as keyof StructuredFeedback['competencies'];
    return structuredFeedback.competencies[key];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{essay.title}</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(essay.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </div>
        </div>
      </div>

      {/* Nota Total */}
      <Card className="p-6 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
              <Trophy className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nota Total</p>
              <p className="text-3xl font-bold text-primary">{essay.score_total || 0}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">de 1000 pontos</p>
            <Progress 
              value={(essay.score_total || 0) / 10} 
              className="w-32 h-2 mt-2" 
            />
          </div>
        </div>
      </Card>

      {/* Pontos Fortes e Fracos */}
      {structuredFeedback && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pontos Fortes */}
          <Card className="p-4 bg-green-500/5 border-green-500/20">
            <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Pontos Fortes
            </h3>
            <p className="text-sm text-muted-foreground">
              {structuredFeedback.strengths}
            </p>
          </Card>

          {/* Pontos a Melhorar */}
          <Card className="p-4 bg-orange-500/5 border-orange-500/20">
            <h3 className="font-semibold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Pontos a Melhorar
            </h3>
            <p className="text-sm text-muted-foreground">
              {structuredFeedback.weaknesses}
            </p>
          </Card>
        </div>
      )}

      {/* Notas por Competência com Feedback Detalhado */}
      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Análise por Competência
        </h3>
        <div className="space-y-6">
          {competencyNames.map((name, index) => {
            const score = competencyScores[index] || 0;
            const percentage = (score / 200) * 100;
            const feedback = getCompetencyFeedback(index);
            
            return (
              <div key={index} className="space-y-3 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">C{index + 1}:</span>
                      <span className="text-foreground">{name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {competencyDescriptions[index]}
                    </p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`${getScoreColor(score)} shrink-0`}
                  >
                    {score}/200
                  </Badge>
                </div>
                
                <Progress 
                  value={percentage} 
                  className="h-2"
                />
                
                {/* Feedback específico da competência */}
                {feedback && (
                  <div className="bg-muted/30 rounded-lg p-3 mt-2">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {feedback}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Feedback Geral (fallback para redações antigas) */}
      {!structuredFeedback && essay.feedback && (
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Feedback da Correção
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            {essay.feedback}
          </p>
        </Card>
      )}

      {/* Dicas */}
      {essay.tips && (
        <Card className="p-6 bg-blue-500/5 border-blue-500/20">
          <h3 className="font-semibold text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Dicas para a Próxima Redação
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {essay.tips}
          </p>
        </Card>
      )}

      {/* Checklist Oficial dos 5 Elementos da C5 */}
      {structuredFeedback?.intervention_checklist && (
        <InterventionChecklist 
          checklist={structuredFeedback.intervention_checklist}
          score={essay.score_competency_5}
        />
      )}

      {/* Conteúdo da Redação com Trechos Anotados */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            Sua Redação Anotada pelo Corretor
          </h3>
          {structuredFeedback?.annotated_snippets?.length && getRenderableAnnotatedSnippetCount(essay.content, structuredFeedback.annotated_snippets) > 0 ? (
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              {getRenderableAnnotatedSnippetCount(essay.content, structuredFeedback.annotated_snippets)} destaques pedagógicos
            </Badge>
          ) : null}
        </div>
        <AnnotatedEssayContent
          content={essay.content}
          snippets={structuredFeedback?.annotated_snippets}
        />
      </Card>
    </motion.div>
  );
};

export default EssayDetail;
