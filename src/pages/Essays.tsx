import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, PenLine, FileText, Crown, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { usePremium } from "@/hooks/usePremium";
import EssayForm from "@/components/essays/EssayForm";
import EssayList from "@/components/essays/EssayList";
import EssayDetail from "@/components/essays/EssayDetail";
import { toast } from "@/hooks/use-toast";

/**
 * Página de Redações ENEM
 * Permite escrever, enviar para correção e visualizar histórico
 */
const Essays = () => {
  const navigate = useNavigate();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const [loading, setLoading] = useState(true);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [selectedEssay, setSelectedEssay] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("write");

  // Limites de redações
  const limit = isPremium ? 12 : 1;
  const remaining = Math.max(0, limit - monthlyCount);

  // Verificar autenticação e carregar dados
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      await loadMonthlyCount();
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  // Carregar contagem de redações do mês
  const loadMonthlyCount = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.rpc("get_monthly_essay_count", { _user_id: user.id });

    if (!error && data !== null) {
      setMonthlyCount(data);
    }
  };

  // Handler após correção bem sucedida
  const handleCorrectionComplete = () => {
    loadMonthlyCount();
    setActiveTab("history");
    toast({
      title: "Redação corrigida!",
      description: "Sua redação foi corrigida com sucesso. Confira o resultado no histórico.",
    });
  };

  // Selecionar redação para visualizar detalhes
  const handleSelectEssay = (essay: any) => {
    setSelectedEssay(essay);
    setActiveTab("detail");
  };

  // Voltar para lista de redações
  const handleBackToList = () => {
    setSelectedEssay(null);
    setActiveTab("history");
  };

  if (loading || premiumLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Redação ENEM</h1>
                <p className="text-muted-foreground text-sm">Escreva e receba correção automática no padrão ENEM</p>
              </div>
            </div>

            {/* Badge de limite */}
            <div className="flex items-center gap-2">
              <Badge variant={remaining > 0 ? "default" : "destructive"} className="gap-1">
                <FileText className="h-3 w-3" />
                {remaining} de {limit} restantes este mês
              </Badge>
              {!isPremium && (
                <Badge variant="secondary" className="gap-1">
                  <Crown className="h-3 w-3 text-yellow-500" />
                  Premium: 4/mês
                </Badge>
              )}
            </div>
          </div>

          {/* Info Card */}
          <Card className="p-4 bg-muted/30 border-border/50">
            <div className="flex items-start gap-3">
              <PenLine className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">Correção inteligente com IA</p>
                <p className="text-muted-foreground">
                  Sua redação será avaliada nas 5 competências do ENEM, recebendo nota de 0 a 1000, feedback detalhado e
                  dicas para melhorar.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="write" className="gap-2">
              <PenLine className="h-4 w-4" />
              Escrever
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <FileText className="h-4 w-4" />
              Histórico
            </TabsTrigger>
            {selectedEssay && (
              <TabsTrigger value="detail" className="gap-2">
                Detalhes
              </TabsTrigger>
            )}
          </TabsList>

          {/* Tab: Escrever redação */}
          <TabsContent value="write">
            <EssayForm onComplete={handleCorrectionComplete} canSubmit={remaining > 0} isPremium={isPremium} />
          </TabsContent>

          {/* Tab: Histórico */}
          <TabsContent value="history">
            <EssayList onSelectEssay={handleSelectEssay} />
          </TabsContent>

          {/* Tab: Detalhes da redação */}
          <TabsContent value="detail">
            {selectedEssay && <EssayDetail essay={selectedEssay} onBack={handleBackToList} />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Essays;
