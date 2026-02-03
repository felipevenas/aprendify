import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Upload, Users, Settings2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import QuestionStatsChart from "@/components/dashboard/QuestionStatsChart";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import QuickStats from "@/components/dashboard/QuickStats";
import ErrorReviewCard from "@/components/dashboard/ErrorReviewCard";
import GamificationTabs from "@/components/dashboard/GamificationTabs";
import ModulesGrid from "@/components/dashboard/ModulesGrid";
import { PageLoader } from "@/components/ui/page-loader";
import { useHelpTooltips } from "@/contexts/HelpTooltipsContext";
import { Button } from "@/components/ui/button";

// Tooltips de ajuda do Dashboard
const dashboardTooltips = [
  {
    id: "welcome-banner",
    title: "Bem-vindo ao Aprendify!",
    description:
      "Aqui você verá suas metas diárias, streak de estudos e sugestões personalizadas.",
    target: "[data-tour='welcome-banner']",
  },
  {
    id: "quick-stats",
    title: "Estatísticas Rápidas",
    description:
      "Acompanhe seu progresso diário: questões respondidas, taxa de acertos e streak.",
    target: "[data-tour='quick-stats']",
  },
  {
    id: "question-bank",
    title: "Banco de Questões",
    description:
      "Pratique com milhares de questões reais do ENEM de 2009 até 2025.",
    target: "[data-tour='question-bank']",
  },
  {
    id: "gamification",
    title: "Estudo e Desafios",
    description:
      "Veja seu plano de estudo personalizado, desafios semanais e ranking.",
    target: "[data-tour='gamification']",
  },
  {
    id: "modules-grid",
    title: "Ferramentas de Estudo",
    description:
      "Acesse simulados, redação, cronograma e outras ferramentas.",
    target: "[data-tour='modules-grid']",
  },
];

/**
 * Dashboard principal da aplicação
 * Layout minimalista com foco em ações principais
 */
const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { setTooltips } = useHelpTooltips();

  // Configurar tooltips do dashboard
  useEffect(() => {
    setTooltips(dashboardTooltips);
  }, [setTooltips]);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // Verifica se o usuário é admin
      const { data: roleData } = await supabase.rpc("get_user_role", { _user_id: session.user.id });
      setIsAdmin(roleData === "admin");

      setLoading(false);
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      } else if (session) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Cards de admin para ferramentas administrativas
  const adminCards = [
    {
      title: "Importar Questões",
      description: "Importe questões do ENEM em formato JSON",
      icon: Upload,
      path: "/admin/import",
    },
    {
      title: "Gerenciar Usuários",
      description: "Gerencie usuários, assinaturas e permissões",
      icon: Users,
      path: "/admin/users",
    },
    {
      title: "Gerenciar Questões",
      description: "Edite questões e automatize classificação via IA",
      icon: Settings2,
      path: "/admin/questions",
    },
  ];

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut" as const,
      },
    },
  };

  return (
    <PageLoader loading={loading} message="Preparando seu dashboard...">
      <div className="min-h-screen bg-background">
        {/* Gradiente sutil de fundo */}
        <div className="fixed inset-0 bg-gradient-to-br from-primary/3 via-transparent to-accent/3 pointer-events-none" />

        <Navbar />

        {/* Conteúdo principal */}
        <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          {/* Welcome Banner */}
          <div data-tour="welcome-banner">
            <WelcomeBanner userName={user?.user_metadata?.full_name?.split(" ")[0] || "Estudante"} userId={user?.id} />
          </div>

          {/* Quick Stats Row */}
          <div data-tour="quick-stats">
            <QuickStats userId={user?.id} />
          </div>

          {/* Layout principal: 2 colunas em desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6 mb-6">
            {/* Coluna esquerda: Banco de Questões + Gráfico */}
            <div className="lg:col-span-3 flex flex-col gap-5">
              {/* Banco de Questões - Card destacado */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                data-tour="question-bank"
              >
                <Card
                  className="group cursor-pointer border-primary/30 overflow-hidden relative bg-gradient-to-br from-primary/5 to-primary/10 hover:border-primary/50 hover:shadow-xl transition-all duration-300"
                  onClick={() => navigate("/questions")}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/20 transition-colors duration-500" />

                  <motion.div
                    className="absolute top-4 right-4"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <span className="px-2.5 py-1 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-[10px] sm:text-xs font-bold rounded-full tracking-wide uppercase shadow-lg">
                      ⚡ Comece Aqui
                    </span>
                  </motion.div>

                  <CardHeader className="relative pb-2">
                    <div className="flex items-start justify-between">
                      <motion.div
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-3 shadow-lg"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <Brain className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
                      </motion.div>
                    </div>
                    <CardTitle className="text-xl sm:text-2xl group-hover:text-primary transition-colors duration-300">
                      Banco de Questões
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base">
                      +2700 questões reais do ENEM de 2009 a 2025
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative pt-2 pb-5">
                    <Button variant="default" size="default" className="gap-2 group-hover:gap-3 transition-all duration-300">
                      <span>Começar a praticar</span>
                      <motion.div
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </motion.div>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Gráfico de estatísticas - cresce para preencher */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                data-tour="stats-chart"
                className="flex-1"
              >
                <QuestionStatsChart />
              </motion.div>
            </div>

            {/* Coluna direita: Gamificação em Tabs - mesma altura que coluna esquerda */}
            <div className="lg:col-span-2 flex" data-tour="gamification">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="w-full flex"
              >
                <GamificationTabs userId={user?.id} />
              </motion.div>
            </div>
          </div>

          {/* Card de Revisão de Erros */}
          <ErrorReviewCard userId={user?.id} />

          {/* Grid de Módulos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            data-tour="modules-grid"
          >
            <ModulesGrid />
          </motion.div>

          {/* Cards de Admin */}
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
                <h2 className="text-lg font-semibold text-foreground">Ferramentas de Administração</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {adminCards.map((card) => (
                  <motion.div key={card.path} variants={itemVariants} className="h-full">
                    <Card
                      className="h-full group cursor-pointer border-amber-500/30 overflow-hidden relative bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 hover:border-amber-500/50"
                      onClick={() => navigate(card.path)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <CardHeader className="relative pb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-all duration-300">
                          <card.icon className="h-5 w-5 text-white" />
                        </div>
                        <CardTitle className="text-base group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors duration-300">
                          {card.title}
                        </CardTitle>
                        <CardDescription className="text-xs">{card.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="relative pt-1 pb-4">
                        <div className="flex items-center text-amber-600 dark:text-amber-400 font-medium gap-1 text-xs">
                          <span>Acessar</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">→</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
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
