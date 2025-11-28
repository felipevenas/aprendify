import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, CheckSquare, LogOut, FileText, Brain, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

/**
 * Dashboard principal da aplicação
 * Layout moderno com cards animados e gradientes
 */
const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

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
      gradient: "from-primary via-primary-light to-accent",
      iconBg: "bg-gradient-to-br from-primary to-accent",
      featured: true,
    },
    {
      title: "Cronograma Semanal",
      description: "Organize suas aulas e sessões de estudo",
      icon: Calendar,
      path: "/schedule",
      gradient: "from-primary to-primary-dark",
      iconBg: "bg-primary",
    },
    {
      title: "Minhas Tarefas",
      description: "Gerencie suas atividades e trabalhos",
      icon: CheckSquare,
      path: "/tasks",
      gradient: "from-accent to-primary-light",
      iconBg: "bg-accent",
    },
    {
      title: "Matérias",
      description: "Cadastre e organize suas disciplinas",
      icon: BookOpen,
      path: "/subjects",
      gradient: "from-primary-light to-primary",
      iconBg: "bg-primary-light",
    },
    {
      title: "Anotações",
      description: "Faça anotações organizadas por matéria",
      icon: FileText,
      path: "/notes",
      gradient: "from-primary-dark to-primary",
      iconBg: "bg-primary-dark",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Navbar */}
      <nav className="bg-card/80 backdrop-blur-md border-b border-border shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                StudyFlow
              </span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Button 
                variant="outline" 
                onClick={handleLogout} 
                className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Conteúdo principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header com boas-vindas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 sm:mb-12"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Bem-vindo de volta!</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3">
            Olá, {user?.user_metadata?.full_name || "Estudante"}!
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl">
            Continue sua jornada de estudos. Gerencie suas atividades e pratique com questões reais do ENEM.
          </p>
        </motion.div>

        {/* Grid de cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {cards.map((card, index) => (
            <motion.div
              key={card.path}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.5, 
                delay: index * 0.08,
                ease: "easeOut" 
              }}
              className={card.featured ? "md:col-span-2 lg:col-span-3" : ""}
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
                    {card.featured && (
                      <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                        Destaque
                      </span>
                    )}
                  </div>
                  <CardTitle className={`text-xl ${card.featured ? "sm:text-2xl" : ""} group-hover:text-primary transition-colors`}>
                    {card.title}
                  </CardTitle>
                  <CardDescription className={`text-base ${card.featured ? "sm:text-lg" : ""}`}>
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
      </main>
    </div>
  );
};

export default Dashboard;
