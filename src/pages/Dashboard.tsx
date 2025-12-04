import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, CheckSquare, FileText, Brain, Sparkles, Upload, Layers, PenLine, Users } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import QuestionStatsChart from "@/components/dashboard/QuestionStatsChart";

/**
 * Dashboard principal da aplicação
 * Layout moderno com cards animados e gradientes
 */
const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      
      // Verifica se o usuário é admin
      const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: session.user.id });
      setIsAdmin(roleData === 'admin');
      
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      } else if (session) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Configuração dos cards do dashboard
  const cards = [
    {
      title: "Banco de Questões",
      description: "Pratique com questões reais do ENEM",
      icon: Brain,
      path: "/questions",
      gradient: "from-primary via-primary to-primary/80",
      iconBg: "bg-primary",
      featured: true,
    },
    {
      title: "Estatísticas",
      description: "Acompanhe seu desempenho e evolução",
      icon: Sparkles,
      path: "/statistics",
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary",
      featured: false,
    },
    {
      title: "Cronograma Semanal",
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
      title: "Matérias",
      description: "Cadastre e organize suas disciplinas",
      icon: BookOpen,
      path: "/subjects",
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
      title: "Redação ENEM",
      description: "Escreva e receba correção automática com IA",
      icon: PenLine,
      path: "/essays",
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary",
      isNew: true,
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
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Navbar />

      {/* Conteúdo principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header com boas-vindas e animação */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 sm:mb-12"
        >
          <motion.div 
            className="flex items-center gap-2 mb-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles className="h-5 w-5 text-primary" />
            </motion.div>
            <motion.span 
              className="text-sm font-medium text-primary"
              animate={{ opacity: [1, 0.7, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Bem-vindo de volta!
            </motion.span>
          </motion.div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3">
            Olá, {user?.user_metadata?.full_name?.split(' ')[0] || "Estudante"}!
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl">
            Continue sua jornada de estudos. Gerencie suas atividades e pratique com questões reais do ENEM.
          </p>
        </motion.div>

        {/* Grid de cards - primeira linha com Banco de Questões + Gráfico */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Banco de Questões - ocupa 2 colunas */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="md:col-span-2"
          >
            <Card
              className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-border/50 overflow-hidden relative h-full"
              onClick={() => navigate("/questions")}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
              
              <CardHeader className="relative">
                <div className="flex items-start justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Brain className="h-7 w-7 text-white" />
                  </div>
                  <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                    Destaque
                  </span>
                </div>
                <CardTitle className="text-xl sm:text-2xl group-hover:text-primary transition-colors">
                  Banco de Questões
                </CardTitle>
                <CardDescription className="text-base sm:text-lg">
                  Pratique com questões reais do ENEM
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="flex items-center text-primary font-medium group-hover:gap-3 gap-2 transition-all">
                  <span>Acessar</span>
                  <motion.div
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
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
          >
            <div className="h-full">
              <QuestionStatsChart />
            </div>
          </motion.div>
        </div>

        {/* Grid de cards - demais cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {cards.filter(card => !card.featured).map((card, index) => (
            <motion.div
              key={card.path}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.5, 
                delay: index * 0.08,
                ease: "easeOut" 
              }}
            >
              <Card
                className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-border/50 overflow-hidden relative"
                onClick={() => navigate(card.path)}
              >
                {/* Gradiente de fundo animado no hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                
                <CardHeader className="relative">
                  <div className="flex items-start justify-between">
                    <div className={`w-14 h-14 rounded-2xl ${card.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <card.icon className="h-7 w-7 text-white" />
                    </div>
                    {(card as any).isNew && (
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-full animate-pulse">
                        Novidade
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">
                    {card.title}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {card.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative">
                  <div className="flex items-center text-primary font-medium group-hover:gap-3 gap-2 transition-all">
                    <span>Acessar</span>
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      →
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Cards de Admin */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-8"
          >
            <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <span className="px-2 py-1 bg-amber-500/10 text-amber-600 text-xs font-semibold rounded-full">Admin</span>
              Ferramentas de Administração
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {adminCards.map((card, index) => (
                <motion.div
                  key={card.path}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 + index * 0.08 }}
                >
                  <Card
                    className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-amber-500/30 overflow-hidden relative"
                    onClick={() => navigate(card.path)}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                    
                    <CardHeader className="relative">
                      <div className="flex items-start justify-between">
                        <div className={`w-14 h-14 rounded-2xl ${card.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                          <card.icon className="h-7 w-7 text-white" />
                        </div>
                      </div>
                      <CardTitle className="text-xl group-hover:text-amber-500 transition-colors">
                        {card.title}
                      </CardTitle>
                      <CardDescription className="text-base">
                        {card.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="relative">
                      <div className="flex items-center text-amber-500 font-medium group-hover:gap-3 gap-2 transition-all">
                        <span>Acessar</span>
                        <motion.div
                          animate={{ x: [0, 4, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          →
                        </motion.div>
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
  );
};

export default Dashboard;
