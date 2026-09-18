import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, ChevronRight, Calendar } from "lucide-react";
import { Simulado, SimuladoResult, useSimulados } from "@/hooks/useSimulados";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SimuladoHistoryCardProps {
  simulado: Simulado;
  onClick: () => void;
}

/**
 * Card component to display a completed simulado in history
 */
export const SimuladoHistoryCard = ({ simulado, onClick }: SimuladoHistoryCardProps) => {
  const { getSimuladoResults } = useSimulados();
  const [results, setResults] = useState<SimuladoResult | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      const data = await getSimuladoResults(simulado.id);
      setResults(data);
    };
    fetchResults();
  }, [simulado.id, getSimuladoResults]);

  // Calculate percentage
  const total = (results?.total_correct || 0) + (results?.total_incorrect || 0) + (results?.total_unanswered || 0);
  const percentage = total > 0 ? Math.round((results?.total_correct || 0) / total * 100) : 0;

  // Get title based on type
  const getTitle = () => {
    const typeLabels: Record<string, string> = {
      official_day1: "ENEM Oficial - Dia 1",
      official_day2: "ENEM Oficial - Dia 2",
      custom_naturezas: "Ciências da Natureza",
      custom_humanas: "Ciências Humanas",
      custom_linguagens: "Linguagens",
      custom_matematica: "Matemática",
      custom_mixed: "Simulado Misto"
    };
    return typeLabels[simulado.type] || "Simulado";
  };

  return (
    <Card 
      className="cursor-pointer hover:border-primary/50 transition-all group"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline">
            {simulado.year ? `ENEM ${simulado.year}` : "Personalizado"}
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <CardTitle className="text-lg">{getTitle()}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {simulado.finished_at && format(new Date(simulado.finished_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>

        {/* Progress */}
        {results && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Aproveitamento</span>
                <span className="font-medium">{percentage}%</span>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{results.total_correct}</span>
              </div>
              <div className="flex items-center gap-1 text-red-500">
                <XCircle className="h-4 w-4" />
                <span>{results.total_incorrect}</span>
              </div>
              <span className="text-muted-foreground">
                de {simulado.total_questions} questões
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SimuladoHistoryCard;
