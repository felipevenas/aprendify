import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  Calendar,
  CheckSquare,
  FileText,
  Brain,
  Sparkles,
  Upload,
  Layers,
  PenLine,
  Users,
  Settings2,
  ClipboardList,
  Crown,
} from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import QuestionStatsChart from "@/components/dashboard/QuestionStatsChart";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import QuickStats from "@/components/dashboard/QuickStats";
import ContextualCTA from "@/components/dashboard/ContextualCTA";
import { PageLoader } from "@/components/ui/page-loader";
import { useHelpTooltips } from "@/contexts/HelpTooltipsContext";

// Tooltips de ajuda do Dashboard
const dashboardTooltips = [
  {
    id: "welcome-banner",
    title: "Bem-vindo ao Aprendify!",
    description: "Aqui você verá suas metas diárias, streak de estudos e sugestões personalizadas de IA para otimizar seus estudos.",
    target: "[data-tour='welcome-banner']",
  },
  {
    id: "quick-stats",
    title: "Estatísticas Rápidas",
    description: "Acompanhe seu progresso diário: questões respondidas, taxa de acertos e tempo de estudo em um só lugar.",
    target: "[data-tour='quick-stats']",
  },
  {
    id: "question-bank",
    title: "Banco de Questões",
    description: "Pratique com milhares de questões reais do ENEM de 2009 até 2024. Filtre por disciplina, ano e dificuldade.",
    target: "[data-tour='question-bank']",
  },
  {
    id: "stats-chart",
    title: "Gráfico de Desempenho",
    description: "Visualize sua evolução ao longo do tempo. Identifique padrões e áreas que precisam de mais atenção.",
    target: "[data-tour='stats-chart']",
  },
  {
    id: "modules-grid",
    title: "Módulos de Estudo",
    description: "Acesse cronogramas, tarefas, anotações, flashcards, correção de redação e simulados. Cada módulo foi projetado para otimizar seu aprendizado.",
    target: "[data-tour='modules-grid']",
  },
];

/**
 * Dashboard principal da aplicação
 * Layout moderno com cards animados e gradientes
 */
const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { setTooltips, hasSeenTour, startTour } = useHelpTooltips();

  // Configurar tooltips do dashboard
  useEffect(() => {
    setTooltips(dashboardTooltips);
  }, [setTooltips]);

  // Mostrar tour automaticamente para novos usuários
  useEffect(() => {
    if (!loading && !hasSeenTour) {
      // Pequeno delay para garantir que os elementos estão renderizados
      const timer = setTimeout(() => {
        startTour();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, hasSeenTour, startTour]);

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

  // Configuração dos cards do dashboard
  const cards = [
    {
      title: "Banco de Questões",
      description: "Pratique com questões reais do ENEM",
      icon: Brain,
      path: "/questions",
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary",
      featured: true,
    },
    {
      title: "Desempenho",
      description: "Acompanhe seu desempenho e evolução",
      icon: Sparkles,
      path: "/statistics",
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary",
      featured: false,
      isPremium: true,
    },
    {
      title: "Cronograma Mensal",
      description: "Organize suas aulas e sessões de estudo",
      icon: Calendar,
      path: "/schedule",
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary",
    },
    {
      title: "Minhas Tarefas",
      description: "Gerencie suas atividades e trabalhos",
      icon: CheckSquare,
      path: "/tasks",
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary",
    },
    {
      title: "Anotações",
      description: "Faça anotações organizadas por matéria",
      icon: FileText,
      path: "/notes",
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary",
    },
    {
      title: "Flashcards",
      description: "Memorize conteúdos com cartões de estudo",
      icon: Layers,
      path: "/flashcards",
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary",
    },
    {
      title: "Correção de Redação",
      description: "Escreva e receba correção automática com IA",
      icon: PenLine,
      path: "/essays",
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary",
    },
    {
      title: "Simulados",
      description: "Simule provas completas do ENEM",
      icon: ClipboardList,
      path: "/simulados",
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary",
      isPremium: true,
    },
  ];

  // Cards de admin para ferramentas administrativas
  const adminCards = [
    {
      title: "Importar Questões",
      description: "Importe questões do ENEM em formato JSON",
      icon: Upload,
      path: "/admin/import",
      gradient: "from-amber-500 to-orange-500",
      iconBg: "bg-amber-500",
      adminOnly: true,
    },
    {
      title: "Gerenciar Usuários",
      description: "Gerencie usuários, assinaturas e permissões",
      icon: Users,
      path: "/admin/users",
      gradient: "from-amber-500 to-orange-500",
      iconBg: "bg-amber-500",
      adminOnly: true,
    },
    {
      title: "Gerenciar Questões",
      description: "Edite questões e automatize classificação via IA",
      icon: Settings2,
      path: "/admin/questions",
      gradient: "from-amber-500 to-orange-500",
      iconBg: "bg-amber-500",
      adminOnly: true,
    },
  ];

  // Stagger animation variants for cards
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

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
        <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {/* Welcome Banner Dinâmico */}
          <div data-tour="welcome-banner">
            <WelcomeBanner 
              userName={user?.user_metadata?.full_name?.split(" ")[0] || "Estudante"}
              userId={user?.id}
            />
          </div>

          {/* Quick Stats Row - 4 mini-cards */}
          <div data-tour="quick-stats">
            <QuickStats userId={user?.id} />
          </div>

          {/* CTA Contextual */}
          <ContextualCTA userId={user?.id} />

          {/* Grid de cards - primeira linha com Banco de Questões + Gráfico */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mb-5 sm:mb-6"
          >
            {/* Banco de Questões - ocupa 2 colunas */}
            <motion.div variants={itemVariants} className="md:col-span-2" data-tour="question-bank">
              <Card
                className="group cursor-pointer border-primary/20 overflow-hidden relative h-full bg-card"
                onClick={() => navigate("/questions")}
              >
                {/* Efeito de brilho no hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors duration-500" />

                <CardHeader className="relative pb-2">
                  <div className="flex items-start justify-between">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                      <Brain className="h-7 w-7 sm:h-8 sm:w-8 text-primary-foreground" />
                    </div>
                    <span className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-full tracking-wide uppercase">
                      Destaque
                    </span>
                  </div>
                  <CardTitle className="text-xl sm:text-2xl group-hover:text-primary transition-colors duration-300">
                    Banco de Questões
                  </CardTitle>
                  <CardDescription className="text-base sm:text-lg">
                    Pratique com questões reais do ENEM
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative pt-4">
                  <div className="flex items-center text-primary font-semibold group-hover:gap-3 gap-2 transition-all duration-300">
                    <span>Começar a praticar</span>
                    <motion.div
                      className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      →
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Gráfico de estatísticas */}
            <motion.div variants={itemVariants} data-tour="stats-chart">
              <div className="h-full">
                <QuestionStatsChart />
              </div>
            </motion.div>
          </motion.div>

          {/* Grid de cards - demais cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
            data-tour="modules-grid"
          >
            {cards
              .filter((card) => !card.featured)
              .map((card, index) => (
                <motion.div key={card.path} variants={itemVariants}>
                  <Card
                    className="group cursor-pointer border-border/50 overflow-hidden relative h-full bg-card hover:border-primary/30"
                    onClick={() => navigate(card.path)}
                  >
                    {/* Gradiente de fundo animado no hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-accent/3 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <CardHeader className="relative pb-2">
                      <div className="flex items-start justify-between">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300">
                          <card.icon className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
                        </div>
                        {card.isPremium && (
                          <span className="px-2.5 py-1 bg-gradient-to-r from-amber-400/20 to-amber-600/20 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-full flex items-center gap-1">
                            <Crown className="h-3 w-3" />
                            Premium
                          </span>
                        )}
                      </div>
                      <CardTitle className="text-lg sm:text-xl group-hover:text-primary transition-colors duration-300">
                        {card.title}
                      </CardTitle>
                      <CardDescription className="text-sm sm:text-base">{card.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="relative pt-2">
                      <div className="flex items-center text-primary font-medium group-hover:gap-3 gap-2 transition-all duration-300 text-sm">
                        <span>Acessar</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">→</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
          </motion.div>

          {/* Cards de Admin */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-10"
            >
              <div className="flex items-center gap-3 mb-5">
                <span className="px-3 py-1.5 bg-gradient-to-r from-amber-400/20 to-amber-600/20 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-full uppercase tracking-wide">
                  Admin
                </span>
                <h2 className="text-xl font-semibold text-foreground">Ferramentas de Administração</h2>
              </div>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
              >
                {adminCards.map((card) => (
                  <motion.div key={card.path} variants={itemVariants} className="h-full">
                    <Card
                      className="h-full group cursor-pointer border-amber-500/30 overflow-hidden relative bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 hover:border-amber-500/50"
                      onClick={() => navigate(card.path)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <CardHeader className="relative pb-2">
                        <div className="flex items-start justify-between">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                            <card.icon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                          </div>
                        </div>
                        <CardTitle className="text-lg sm:text-xl group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors duration-300">
                          {card.title}
                        </CardTitle>
                        <CardDescription className="text-sm sm:text-base">{card.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="relative pt-2">
                        <div className="flex items-center text-amber-600 dark:text-amber-400 font-medium group-hover:gap-3 gap-2 transition-all duration-300 text-sm">
                          <span>Acessar</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">→</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </main>
      </div>
    </PageLoader>
  );
};

export default Dashboard;
