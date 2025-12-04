import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calendar, Trophy, Lightbulb, Target } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Componente para exibir detalhes completos de uma redação corrigida
 */
interface EssayDetailProps {
  essay: any;
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

const EssayDetail = ({ essay, onBack }: EssayDetailProps) => {
  // Cor baseada na nota
  const getScoreColor = (score: number) => {
    if (score >= 160) return "text-green-600 bg-green-500";
    if (score >= 120) return "text-yellow-600 bg-yellow-500";
    if (score >= 80) return "text-orange-500 bg-orange-500";
    return "text-red-500 bg-red-500";
  };

  // Array com as notas das competências
  const competencyScores = [
    essay.score_competency_1,
    essay.score_competency_2,
    essay.score_competency_3,
    essay.score_competency_4,
    essay.score_competency_5,
  ];

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

      {/* Notas por Competência */}
      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Notas por Competência
        </h3>
        <div className="space-y-4">
          {competencyNames.map((name, index) => {
            const score = competencyScores[index] || 0;
            const percentage = (score / 200) * 100;
            const colorClass = getScoreColor(score);
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    <span className="font-medium">C{index + 1}:</span> {name}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={colorClass.split(" ")[0]}
                  >
                    {score}/200
                  </Badge>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-2"
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Feedback */}
      {essay.feedback && (
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
        <Card className="p-6 bg-green-500/5 border-green-500/20">
          <h3 className="font-semibold text-green-700 mb-3">
            💡 Dicas para Melhorar
          </h3>
          <ul className="space-y-2">
            {essay.tips.split(";").map((tip: string, index: number) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-green-600 font-bold">•</span>
                <span>{tip.trim()}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Conteúdo da Redação */}
      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-3">Sua Redação</h3>
        <div className="bg-muted/30 rounded-lg p-4 max-h-96 overflow-y-auto">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed font-mono">
            {essay.content}
          </p>
        </div>
      </Card>
    </motion.div>
  );
};

export default EssayDetail;
