import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  FileText, 
  Clock, 
  Trophy, 
  AlertCircle, 
  Plus, 
  Calendar,
  ChevronRight,
  Lock,
  History,
  Target,
  ArrowLeft
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSimulados, Simulado } from "@/hooks/useSimulados";
import { usePremium } from "@/hooks/usePremium";
import { NewSimuladoDialog } from "@/components/simulados/NewSimuladoDialog";
import { SimuladoHistoryCard } from "@/components/simulados/SimuladoHistoryCard";
import { formatDisciplineName } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Navbar from "@/components/Navbar";

/**
 * Main Simulados page
 * Displays history of completed simulados and options to start new ones
 * Premium-only feature
 */
const Simulados = () => {
  const navigate = useNavigate();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const { simulados, loading } = useSimulados();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Check for premium access
  if (!premiumLoading && !isPremium) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-background p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="mb-4 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Card className="border-dashed">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Lock className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardTitle>Recurso Premium</CardTitle>
                <CardDescription>
                  Os Simulados são exclusivos para usuários Premium. 
                  Faça upgrade para acessar simulados completos do ENEM com correção detalhada.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button onClick={() => navigate("/subscription")}>
                  Ver Planos Premium
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </>
    );
  }

  // Separate completed and in-progress simulados
  const completedSimulados = simulados.filter(s => s.status === "completed");
  const inProgressSimulados = simulados.filter(s => s.status === "in_progress");

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto space-y-8"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/dashboard")}
                className="text-muted-foreground mt-1"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Simulados ENEM</h1>
                <p className="text-muted-foreground mt-1">
                  Pratique com simulados completos e acompanhe seu progresso
                </p>
              </div>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Simulado
            </Button>
          </div>

        {/* In Progress Simulados */}
        {inProgressSimulados.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Em Andamento
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {inProgressSimulados.map((simulado) => (
                <Card 
                  key={simulado.id} 
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/simulados/${simulado.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                        Em andamento
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-lg mt-2">
                      {getSimuladoTitle(simulado)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Iniciado em {format(new Date(simulado.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <Button variant="outline" className="w-full mt-4">
                      Continuar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Stats Summary */}
        {completedSimulados.length > 0 && (
          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total de Simulados</CardDescription>
                <CardTitle className="text-3xl">{completedSimulados.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Este Mês</CardDescription>
                <CardTitle className="text-3xl">
                  {completedSimulados.filter(s => {
                    const date = new Date(s.finished_at || s.created_at);
                    const now = new Date();
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                  }).length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Questões Respondidas</CardDescription>
                <CardTitle className="text-3xl">
                  {completedSimulados.reduce((acc, s) => acc + s.total_questions, 0)}
                </CardTitle>
              </CardHeader>
            </Card>
          </section>
        )}

        {/* History */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Histórico de Simulados
          </h2>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : completedSimulados.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  Você ainda não completou nenhum simulado.
                  <br />
                  Inicie seu primeiro simulado para começar a acompanhar seu progresso!
                </p>
                <Button onClick={() => setDialogOpen(true)} className="mt-4">
                  Iniciar Primeiro Simulado
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedSimulados.map((simulado) => (
                <SimuladoHistoryCard 
                  key={simulado.id} 
                  simulado={simulado}
                  onClick={() => navigate(`/simulados/${simulado.id}/resultado`)}
                />
              ))}
            </div>
          )}
        </section>

        {/* New Simulado Dialog */}
        <NewSimuladoDialog 
          open={dialogOpen} 
          onOpenChange={setDialogOpen}
        />
      </motion.div>
    </div>
    </>
  );
};

/**
 * Get human-readable title for a simulado
 */
function getSimuladoTitle(simulado: Simulado): string {
  const typeLabels: Record<string, string> = {
    official_day1: "ENEM Oficial - Dia 1",
    official_day2: "ENEM Oficial - Dia 2",
    custom_naturezas: "Ciências da Natureza",
    custom_humanas: "Ciências Humanas",
    custom_matematica: "Matemática",
    custom_mixed: "Simulado Misto"
  };

  let title = typeLabels[simulado.type] || "Simulado";
  
  if (simulado.year) {
    title += ` ${simulado.year}`;
  }
  
  title += ` (${simulado.total_questions} questões)`;
  
  return title;
}

export default Simulados;
