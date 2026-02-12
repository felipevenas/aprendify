import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

interface ChartData {
  name: string;
  acertos: number;
  erros: number;
  total: number;
}

/**
 * Componente de gráfico para o dashboard
 * Mostra quantidade de questões respondidas com acertos e erros por dia
 * Com animações de entrada e tooltips melhorados
 */
interface QuestionStatsChartProps {
  embedded?: boolean;
}

const QuestionStatsChart = ({ embedded = false }: QuestionStatsChartProps = {}) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyTrend, setWeeklyTrend] = useState<"up" | "down" | "stable">("stable");
  const [weeklyChange, setWeeklyChange] = useState(0);

  // Função para buscar estatísticas
  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Busca os últimos 7 dias de tentativas
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

      // Busca os 7 dias anteriores para comparação
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

      const { data, error } = await supabase
        .from("question_attempts")
        .select("created_at, is_correct")
        .eq("user_id", user.id)
        .gte("created_at", fourteenDaysAgo.toISOString())
        .order("created_at");

      if (error) throw error;

      // Agrupa por dia
      const grouped: Record<string, { acertos: number; erros: number }> = {};
      
      // Inicializa os últimos 7 dias
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
        grouped[dateKey] = { acertos: 0, erros: 0 };
      }

      // Conta para semana atual e anterior
      let currentWeekTotal = 0;
      let previousWeekTotal = 0;
      const currentWeekStart = new Date();
      currentWeekStart.setDate(currentWeekStart.getDate() - 6);
      currentWeekStart.setHours(0, 0, 0, 0);

      // Preenche com dados reais
      data?.forEach((attempt) => {
        const date = new Date(attempt.created_at);
        const dateKey = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
        
        if (date >= currentWeekStart) {
          currentWeekTotal++;
          if (grouped[dateKey]) {
            if (attempt.is_correct) {
              grouped[dateKey].acertos++;
            } else {
              grouped[dateKey].erros++;
            }
          }
        } else {
          previousWeekTotal++;
        }
      });

      // Calcula tendência
      if (previousWeekTotal > 0) {
        const change = ((currentWeekTotal - previousWeekTotal) / previousWeekTotal) * 100;
        setWeeklyChange(Math.round(change));
        setWeeklyTrend(change > 5 ? "up" : change < -5 ? "down" : "stable");
      }

      // Converte para array
      const chartArray = Object.entries(grouped).map(([name, values]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        acertos: values.acertos,
        erros: values.erros,
        total: values.acertos + values.erros,
      }));

      setChartData(chartArray);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Configura realtime para atualizar gráfico quando houver novas tentativas
    const channel = supabase
      .channel("question_attempts_chart")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "question_attempts",
        },
        () => {
          // Atualiza gráfico quando nova tentativa é registrada
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Custom tooltip com mais informações
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const acertos = payload.find((p: any) => p.dataKey === "acertos")?.value || 0;
      const erros = payload.find((p: any) => p.dataKey === "erros")?.value || 0;
      const total = acertos + erros;
      const taxa = total > 0 ? Math.round((acertos / total) * 100) : 0;

      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Acertos:</span>
              <span className="font-medium text-green-500">{acertos}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-muted-foreground">Erros:</span>
              <span className="font-medium text-red-400">{erros}</span>
            </div>
            <div className="pt-1 border-t border-border mt-1">
              <span className="text-muted-foreground">Taxa: </span>
              <span className={`font-bold ${taxa >= 70 ? "text-green-500" : taxa >= 50 ? "text-yellow-500" : "text-red-400"}`}>
                {taxa}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    if (embedded) {
      return (
        <div className="flex items-center justify-center h-full min-h-[120px] text-muted-foreground text-sm">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
            Carregando...
          </motion.div>
        </div>
      );
    }
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2 pt-3 px-4 shrink-0">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="h-4 w-4 text-primary" />
            Seu Progresso
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-3 px-4 flex-1 flex items-center justify-center">
          <div className="text-muted-foreground text-sm">
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
              Carregando...
            </motion.div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = chartData.some(d => d.acertos > 0 || d.erros > 0);

  const chartContent = hasData ? (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="h-full w-full min-h-[120px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
          <Bar dataKey="acertos" name="Acertos" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} animationDuration={800} animationBegin={200} />
          <Bar dataKey="erros" name="Erros" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} animationDuration={800} animationBegin={400} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  ) : (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full min-h-[120px] flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
      <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
      <span>Comece a praticar!</span>
    </motion.div>
  );

  if (embedded) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-end px-4 py-1">
          {weeklyTrend !== "stable" && hasData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                weeklyTrend === "up" ? "bg-green-500/10 text-green-500" : "bg-red-400/10 text-red-400"
              }`}
            >
              {weeklyTrend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(weeklyChange)}%
            </motion.div>
          )}
          <span className="text-xs text-muted-foreground ml-2">7 dias</span>
        </div>
        <div className="flex-1 min-h-0 px-4 pb-2">
          {chartContent}
        </div>
      </div>
    );
  }

  return (
    <Card className="h-full overflow-hidden flex flex-col">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="h-4 w-4 text-primary" />
            Seu Progresso
          </CardTitle>
          <div className="flex items-center gap-2">
            {weeklyTrend !== "stable" && hasData && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  weeklyTrend === "up" ? "bg-green-500/10 text-green-500" : "bg-red-400/10 text-red-400"
                }`}
              >
                {weeklyTrend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(weeklyChange)}%
              </motion.div>
            )}
            <span className="text-xs text-muted-foreground">7 dias</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3 px-4 flex-1 min-h-0">
        {chartContent}
      </CardContent>
    </Card>
  );
};

export default QuestionStatsChart;
