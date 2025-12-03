import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChart3 } from "lucide-react";

interface ChartData {
  name: string;
  acertos: number;
  erros: number;
}

/**
 * Componente de gráfico para o dashboard
 * Mostra quantidade de questões respondidas com acertos e erros por dia
 */
const QuestionStatsChart = () => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Busca os últimos 7 dias de tentativas
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

        const { data, error } = await supabase
          .from("question_attempts")
          .select("created_at, is_correct")
          .eq("user_id", user.id)
          .gte("created_at", sevenDaysAgo.toISOString())
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

        // Preenche com dados reais
        data?.forEach((attempt) => {
          const date = new Date(attempt.created_at);
          const dateKey = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
          if (grouped[dateKey]) {
            if (attempt.is_correct) {
              grouped[dateKey].acertos++;
            } else {
              grouped[dateKey].erros++;
            }
          }
        });

        // Converte para array
        const chartArray = Object.entries(grouped).map(([name, values]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          acertos: values.acertos,
          erros: values.erros,
        }));

        setChartData(chartArray);
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            Questões Respondidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Carregando...
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = chartData.some(d => d.acertos > 0 || d.erros > 0);

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Questões Respondidas (Últimos 7 dias)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }} 
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }} 
                  className="text-muted-foreground"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="acertos" 
                  name="Acertos" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="erros" 
                  name="Erros" 
                  fill="hsl(var(--destructive))" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Nenhuma questão respondida ainda. Comece a praticar!
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuestionStatsChart;
