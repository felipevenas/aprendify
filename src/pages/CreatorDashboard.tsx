import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Users, TrendingUp, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import Navbar from "@/components/Navbar";

interface CouponData {
  id: string;
  coupon_code: string;
  is_active: boolean;
  created_at: string;
}

interface RedemptionData {
  id: string;
  created_at: string;
}

const CreatorDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  const [coupon, setCoupon] = useState<CouponData | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionData[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkCreatorStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user has creator subscription
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan_type, status")
        .eq("user_id", user.id)
        .eq("status", "authorized")
        .maybeSingle();

      if (subscription?.plan_type !== "creator") {
        toast.error("Acesso negado. Esta página é exclusiva para criadores.");
        navigate("/dashboard");
        return;
      }

      setIsCreator(true);

      // Fetch creator's coupon
      const { data: couponData } = await supabase
        .from("creator_coupons")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (couponData) {
        setCoupon(couponData);

        // Fetch redemptions for this coupon
        const { data: redemptionsData } = await supabase
          .from("coupon_redemptions")
          .select("id, created_at")
          .eq("coupon_id", couponData.id)
          .order("created_at", { ascending: true });

        setRedemptions(redemptionsData || []);
      }

      setLoading(false);
    };

    checkCreatorStatus();
  }, [navigate]);

  const copyToClipboard = () => {
    if (coupon?.coupon_code) {
      navigator.clipboard.writeText(coupon.coupon_code);
      setCopied(true);
      toast.success("Cupom copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Process data for chart - group by day
  const getChartData = () => {
    const last30Days: { date: string; count: number }[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      
      const count = redemptions.filter((r) => {
        const redemptionDate = new Date(r.created_at).toISOString().split("T")[0];
        return redemptionDate === dateStr;
      }).length;

      last30Days.push({
        date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        count,
      });
    }

    return last30Days;
  };

  const chartConfig = {
    count: {
      label: "Resgates",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  if (loading || !isCreator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const chartData = getChartData();
  const totalRedemptions = redemptions.length;
  const thisMonthRedemptions = redemptions.filter((r) => {
    const date = new Date(r.created_at);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground flex items-center gap-3">
                <Sparkles className="h-8 w-8 text-primary" />
                Painel do Criador
              </h1>
              <p className="text-muted-foreground mt-1">
                Acompanhe as métricas do seu cupom de afiliado
              </p>
            </div>

            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2">
              <Sparkles className="h-4 w-4 mr-2" />
              Criador de Conteúdo
            </Badge>
          </div>

          {/* Coupon Card */}
          {coupon && (
            <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Seu Cupom de Afiliado
                </CardTitle>
                <CardDescription>
                  Compartilhe este cupom com sua audiência para ganhar comissões
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <code className="flex-1 bg-muted px-4 py-3 rounded-lg text-lg font-mono font-bold text-primary">
                    {coupon.coupon_code}
                  </code>
                  <Button onClick={copyToClipboard} variant="outline" size="icon">
                    {copied ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {coupon.is_active ? "✓ Cupom ativo" : "✗ Cupom inativo"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Resgates</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalRedemptions}</div>
                <p className="text-xs text-muted-foreground">
                  Pessoas que usaram seu cupom
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resgates este Mês</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{thisMonthRedemptions}</div>
                <p className="text-xs text-muted-foreground">
                  Novos resgates em {new Date().toLocaleDateString("pt-BR", { month: "long" })}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Resgates nos Últimos 30 Dias</CardTitle>
              <CardDescription>
                Acompanhe a evolução dos resgates do seu cupom
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={12}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={12}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      allowDecimals={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#colorCount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {!coupon && (
            <Card className="mt-6">
              <CardContent className="py-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhum cupom configurado ainda. Entre em contato com o suporte.
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default CreatorDashboard;
