import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Users, Settings2 } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import TodayOverview from "@/components/dashboard/TodayOverview";
import PerformanceOverview from "@/components/dashboard/PerformanceOverview";
import DisciplineBreakdown from "@/components/dashboard/DisciplineBreakdown";
import ErrorReviewCard from "@/components/dashboard/ErrorReviewCard";
import GamificationTabs from "@/components/dashboard/GamificationTabs";
import StudyHeatmap from "@/components/dashboard/StudyHeatmap";
import ModulesGrid from "@/components/dashboard/ModulesGrid";
import { PageLoader } from "@/components/ui/page-loader";
import { useHelpTooltips } from "@/contexts/HelpTooltipsContext";

const dashboardTooltips = [
  { id: "welcome-banner", title: "Bem-vindo ao Aprendify!", description: "Acompanhe suas metas, streak e progresso.", target: "[data-tour='welcome-banner']" },
  { id: "quick-stats", title: "Visão Geral", description: "Métricas rápidas do seu dia e semana.", target: "[data-tour='quick-stats']" },
  { id: "performance", title: "Desempenho", description: "Gráficos de evolução e precisão.", target: "[data-tour='performance']" },
  { id: "modules-grid", title: "Ferramentas", description: "Acesse simulados, redação e mais.", target: "[data-tour='modules-grid']" },
];

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { setTooltips } = useHelpTooltips();

  useEffect(() => {
    setTooltips(dashboardTooltips);
  }, [setTooltips]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      setUser(session.user);
      const { data: roleData } = await supabase.rpc("get_user_role", { _user_id: session.user.id });
      setIsAdmin(roleData === "admin");
      setLoading(false);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") navigate("/auth");
      else if (session) setUser(session.user);
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const adminCards = [
    { title: "Importar Questões", description: "Importe questões em JSON", icon: Upload, path: "/admin/import" },
    { title: "Gerenciar Usuários", description: "Usuários, assinaturas e permissões", icon: Users, path: "/admin/users" },
    { title: "Gerenciar Questões", description: "Edite e classifique questões", icon: Settings2, path: "/admin/questions" },
  ];

  return (
    <PageLoader loading={loading} message="Preparando seu dashboard...">
      <div className="min-h-screen bg-background">
        <div className="fixed inset-0 bg-gradient-to-br from-primary/3 via-transparent to-accent/3 pointer-events-none" />
        <Navbar />

        <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Header */}
          <div data-tour="welcome-banner">
            <DashboardHeader
              userName={user?.user_metadata?.full_name?.split(" ")[0] || "Estudante"}
              userId={user?.id}
            />
          </div>

          {/* Row 1: Today Overview + Performance Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5" data-tour="quick-stats">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="lg:col-span-4"
            >
              <TodayOverview userId={user?.id} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="lg:col-span-8"
              data-tour="performance"
            >
              <PerformanceOverview userId={user?.id} />
            </motion.div>
          </div>

          {/* Row 2: Discipline Breakdown + Gamification + Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="lg:col-span-5"
            >
              <DisciplineBreakdown userId={user?.id} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="lg:col-span-4"
            >
              <GamificationTabs userId={user?.id} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="lg:col-span-3"
            >
              <Card className="h-full">
                <CardHeader className="pb-1 pt-4 px-5">
                  <CardTitle className="text-base font-semibold">Frequência</CardTitle>
                  <p className="text-xs text-muted-foreground">Atividade de estudos</p>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <StudyHeatmap userId={user?.id} embedded />
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Error Review */}
          <ErrorReviewCard userId={user?.id} />

          {/* Modules */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            data-tour="modules-grid"
          >
            <ModulesGrid />
          </motion.div>

          {/* Admin */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-8"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="px-2.5 py-1 bg-gradient-to-r from-amber-400/20 to-amber-600/20 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-full uppercase tracking-wide">
                  Admin
                </span>
                <h2 className="text-lg font-semibold text-foreground">Administração</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {adminCards.map((card) => (
                  <Card
                    key={card.path}
                    className="group cursor-pointer border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 hover:border-amber-500/50 transition-all"
                    onClick={() => navigate(card.path)}
                  >
                    <CardHeader className="pb-2">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <card.icon className="h-5 w-5 text-white" />
                      </div>
                      <CardTitle className="text-base group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{card.title}</CardTitle>
                      <CardDescription className="text-xs">{card.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </main>
      </div>
    </PageLoader>
  );
};

export default Dashboard;
