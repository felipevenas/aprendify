import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenLine, FileText, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { usePremium } from "@/hooks/usePremium";
import { toast } from "@/hooks/use-toast";
import { PageLoader } from "@/components/ui/page-loader";
import EssayForm from "../components/EssayForm";
import EssayList from "../components/EssayList";
import EssayDetail from "../components/EssayDetail";
import { essayService } from "../services/essayService";

export const EssaysPage = () => {
  const navigate = useNavigate();
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const [loading, setLoading] = useState(true);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [selectedEssay, setSelectedEssay] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("write");

  const limit = isPremium ? 12 : 1;
  const remaining = Math.max(0, limit - monthlyCount);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      await loadMonthlyCount(user.id);
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  const loadMonthlyCount = async (userId?: string) => {
    try {
      let uid = userId;
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        uid = user.id;
      }
      const count = await essayService.getMonthlyEssayCount(uid);
      setMonthlyCount(count);
    } catch (e) {
      console.error("Error loading essay count:", e);
    }
  };

  const handleCorrectionComplete = () => {
    loadMonthlyCount();
    setActiveTab("history");
    toast({
      title: "Redação corrigida!",
      description: "Sua redação foi corrigida com sucesso. Confira o resultado no histórico.",
    });
  };

  const handleSelectEssay = (essay: any) => {
    setSelectedEssay(essay);
    setActiveTab("detail");
  };

  const handleBackToList = () => {
    setSelectedEssay(null);
    setActiveTab("history");
  };

  return (
    <div className="min-h-screen bg-background app-layout-container">
      <Navbar />

      <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageLoader loading={loading || premiumLoading} variant="cards">
          {/* Header Minimalista Padronizado */}
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-6">
            <PageHeader
              title="Redação ENEM"
              description="Escreva e receba correção nas 5 competências no padrão ENEM de 0 a 1000 pontos"
              icon={PenLine}
              actions={
                <div className="flex items-center gap-2" data-tour="essays-limits">
                  <Badge variant={remaining > 0 ? "outline" : "destructive"} className="gap-1 bg-muted/50">
                    <FileText className="h-3 w-3 text-primary" />
                    <span>{remaining} de {limit} restantes este mês</span>
                  </Badge>
                  {!isPremium && (
                    <Badge variant="secondary" className="gap-1">
                      <Crown className="h-3 w-3 text-yellow-500" />
                      Premium: 4/mês
                    </Badge>
                  )}
                </div>
              }
              className="mb-2"
            />
          </motion.div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6" data-tour="essays-tabs">
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

            <TabsContent value="write" data-tour="essays-write-area">
              <EssayForm onComplete={handleCorrectionComplete} canSubmit={remaining > 0} isPremium={isPremium} />
            </TabsContent>

            <TabsContent value="history">
              <EssayList onSelectEssay={handleSelectEssay} />
            </TabsContent>

            <TabsContent value="detail">
              {selectedEssay && <EssayDetail essay={selectedEssay} onBack={handleBackToList} />}
            </TabsContent>
          </Tabs>
        </PageLoader>
      </main>
    </div>
  );
};

export default EssaysPage;
