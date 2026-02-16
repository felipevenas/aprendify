import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

interface PerformanceOverviewProps {
  userId?: string;
}

interface DayData {
  name: string;
  date: string;
  acertos: number;
  erros: number;
  total: number;
  accuracy: number;
}

const PerformanceOverview = ({ userId }: PerformanceOverviewProps) => {
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"accuracy" | "volume">("accuracy");
  const [trend, setTrend] = useState<{ direction: "up" | "down" | "stable"; value: number }>({ direction: "stable", value: 0 });

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);

      const { data: attempts } = await supabase
        .from("question_attempts")
        .select("created_at, is_correct")
        .eq("user_id", userId)
        .gte("created_at", fourteenDaysAgo.toISOString())
        .order("created_at");

      // Group by day for last 14 days
      const grouped: Record<string, { acertos: number; erros: number }> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        grouped[key] = { acertos: 0, erros: 0 };
      }

      (attempts || []).forEach((a) => {
        const key = new Date(a.created_at).toISOString().split("T")[0];
        if (grouped[key]) {
          if (a.is_correct) grouped[key].acertos++;
          else grouped[key].erros++;
        }
      });

      const chartData = Object.entries(grouped).map(([date, v]) => {
        const total = v.acertos + v.erros;
        return {
          name: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          date,
          acertos: v.acertos,
          erros: v.erros,
          total,
          accuracy: total > 0 ? Math.round((v.acertos / total) * 100) : 0,
        };
      });

      // Calculate trend (last 7 vs previous 7)
      const last7 = chartData.slice(-7);
      const prev7 = chartData.slice(0, 7);
      const last7Total = last7.reduce((s, d) => s + d.total, 0);
      const prev7Total = prev7.reduce((s, d) => s + d.total, 0);

      if (prev7Total > 0) {
        const change = Math.round(((last7Total - prev7Total) / prev7Total) * 100);
        setTrend({
          direction: change > 5 ? "up" : change < -5 ? "down" : "stable",
          value: Math.abs(change),
        });
      }

      setData(chartData);
      setLoading(false);
    };

    fetchData();
  }, [userId]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm">
        <p className="font-semibold text-foreground mb-1.5">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Acertos:</span>
            <span className="font-medium text-green-500">{d.acertos}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
            <span className="text-muted-foreground">Erros:</span>
            <span className="font-medium text-destructive">{d.erros}</span>
          </div>
          <div className="pt-1 border-t border-border">
            <span className="text-muted-foreground">Precisão: </span>
            <span className={`font-bold ${d.accuracy >= 70 ? "text-green-500" : d.accuracy >= 50 ? "text-warning" : "text-destructive"}`}>
              {d.accuracy}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="h-5 w-40 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-[240px] bg-muted/50 animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some((d) => d.total > 0);
  const TrendIcon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Desempenho</CardTitle>
            {hasData && trend.direction !== "stable" && (
              <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                trend.direction === "up" ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"
              }`}>
                <TrendIcon className="h-3 w-3" />
                {trend.value}%
              </div>
            )}
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="h-7">
              <TabsTrigger value="accuracy" className="text-xs h-6 px-2.5">Precisão</TabsTrigger>
              <TabsTrigger value="volume" className="text-xs h-6 px-2.5">Volume</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="text-xs text-muted-foreground">Últimos 14 dias</p>
      </CardHeader>
      <CardContent className="pb-3 px-3">
        {!hasData ? (
          <div className="h-[240px] flex flex-col items-center justify-center text-muted-foreground gap-2">
            <BarChart3 className="h-10 w-10 text-muted-foreground/30" />
            <span className="text-sm">Comece a praticar para ver seu desempenho</span>
          </div>
        ) : (
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="h-[240px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              {view === "accuracy" ? (
                <AreaChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                  <defs>
                    <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="text-muted-foreground" axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="accuracy"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#accuracyGradient)"
                    dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    animationDuration={800}
                  />
                </AreaChart>
              ) : (
                <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="acertos" stackId="a" fill="hsl(142, 76%, 36%)" radius={[0, 0, 0, 0]} animationDuration={600} />
                  <Bar dataKey="erros" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} animationDuration={600} animationBegin={200} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceOverview;
