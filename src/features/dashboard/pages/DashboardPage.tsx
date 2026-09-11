import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Play, Pause, RotateCcw, Timer, BookOpen, Trophy, ArrowRight, Brain, Upload, Users, Settings2,
  Calendar, CheckSquare, Clock, GraduationCap, Flame, Target, Sparkles, MessageSquare, AlertCircle, Maximize2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import WelcomeBanner from "../components/WelcomeBanner";
import DailyGoalProgress from "../components/DailyGoalProgress";
import DynamicStudyPlan from "../components/DynamicStudyPlan";
import ErrorReviewCard from "../components/ErrorReviewCard";
import Leaderboard from "../components/Leaderboard";
import WeeklyChallenges from "../components/WeeklyChallenges";
import { PageLoader } from "@/components/ui/page-loader";
import { useHelpTooltips } from "@/contexts/HelpTooltipsContext";
import { usePomodoro } from "@/contexts/PomodoroContext";
import { getSubjectByDiscipline } from "@/lib/subjects";

// Tooltips de ajuda do novo Dashboard ENEM
const dashboardTooltips = [
  {
    id: "countdown-enem",
    title: "Foco no ENEM",
    description: "Acompanhe de perto quantos dias faltam para a prova mais importante do ano.",
    target: "[data-tour='countdown-enem']",
  },
  {
    id: "pomodoro-timer",
    title: "Timer Pomodoro",
    description: "Utilize sessões de foco (25 min) com pausas estruturadas diretamente no seu painel para turbinar sua concentração.",
    target: "[data-tour='pomodoro-timer']",
  },
  {
    id: "performance-areas",
    title: "Desempenho por Áreas",
    description: "Analise seu progresso de acertos e proficiência nas 4 grandes áreas oficiais do ENEM + Redação.",
    target: "[data-tour='performance-areas']",
  },
  {
    id: "study-planning",
    title: "Planejamento Diário",
    description: "Veja o que estudar hoje e organize suas tarefas e metas diárias no painel lateral.",
    target: "[data-tour='study-planning']",
  },
];

interface AreaPerformance {
  id: string;
  name: string;
  color: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
}

// Componente de ícone auxiliar para Coffee/Pausa
const CoffeeIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
    <line x1="6" x2="6" y1="2" y2="4" />
    <line x1="10" x2="10" y1="2" y2="4" />
    <line x1="14" x2="14" y1="2" y2="4" />
  </svg>
);

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const { setTooltips } = useHelpTooltips();

  // Estados da Contagem Regressiva para o ENEM
  const [daysToEnem, setDaysToEnem] = useState(0);
  const [enemProgress, setEnemProgress] = useState(0);

  // Consome o Timer Pomodoro Global
  const {
    timeLeft,
    timerActive,
    pomodoroMode,
    toggleTimer,
    resetTimer,
    changePomodoroMode,
    formatTime,
    setIsExpanded,
  } = usePomodoro();

  // Estados de Desempenho do Aluno por Área
  const [areaStats, setAreaStats] = useState<AreaPerformance[]>([
    { id: "linguagens", name: "Linguagens e Códigos", color: "#3B82F6", totalAttempts: 0, correctAttempts: 0, accuracy: 0 },
    { id: "ciencias-humanas", name: "Ciências Humanas", color: "#8B5CF6", totalAttempts: 0, correctAttempts: 0, accuracy: 0 },
    { id: "ciencias-natureza", name: "Ciências da Natureza", color: "#22C55E", totalAttempts: 0, correctAttempts: 0, accuracy: 0 },
    { id: "matematica", name: "Matemática e suas Tecnologias", color: "#F97316", totalAttempts: 0, correctAttempts: 0, accuracy: 0 },
    { id: "redacao", name: "Redação", color: "#EF4444", totalAttempts: 0, correctAttempts: 0, accuracy: 0 },
  ]);

  // Configurar tooltips
  useEffect(() => {
    setTooltips(dashboardTooltips);
  }, [setTooltips]);

  // Efeito de Inicialização e Autenticação
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

      // Busca o papel do usuário
      const { data: roleData } = await supabase.rpc("get_user_role", { _user_id: session.user.id });
      setIsAdmin(roleData === "admin");

      // Buscar tentativas de questões para cálculo de desempenho por área
      try {
        const { data: attempts } = await supabase
          .from("question_attempts")
          .select("is_correct, discipline")
          .eq("user_id", session.user.id);

        if (attempts && attempts.length > 0) {
          const statsMap = {
            "linguagens": { totalAttempts: 0, correctAttempts: 0 },
            "ciencias-humanas": { totalAttempts: 0, correctAttempts: 0 },
            "ciencias-natureza": { totalAttempts: 0, correctAttempts: 0 },
            "matematica": { totalAttempts: 0, correctAttempts: 0 },
            "redacao": { totalAttempts: 0, correctAttempts: 0 },
          };

          attempts.forEach((attempt) => {
            const subject = getSubjectByDiscipline(attempt.discipline);
            const subjectId = subject?.id;
            if (subjectId && statsMap[subjectId as keyof typeof statsMap]) {
              statsMap[subjectId as keyof typeof statsMap].totalAttempts += 1;
              if (attempt.is_correct) {
                statsMap[subjectId as keyof typeof statsMap].correctAttempts += 1;
              }
            }
          });

          setAreaStats(prev => prev.map(stat => {
            const data = statsMap[stat.id as keyof typeof statsMap];
            return {
              ...stat,
              totalAttempts: data ? data.totalAttempts : 0,
              correctAttempts: data ? data.correctAttempts : 0,
              accuracy: data && data.totalAttempts > 0
                ? Math.round((data.correctAttempts / data.totalAttempts) * 100)
                : 0
            };
          }));
        }
      } catch (error) {
        console.error("Erro ao carregar estatísticas do usuário:", error);
      }

      // Calcula os dias para o ENEM (Próxima Prova: 8 de Novembro de 2026)
      const enemDate = new Date("2026-11-08T13:00:00-03:00");
      const startDate = new Date("2026-01-01T00:00:00-03:00");
      const now = new Date();
      const diffTime = enemDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const totalYearMs = enemDate.getTime() - startDate.getTime();
      const currentPassedMs = now.getTime() - startDate.getTime();
      const progress = Math.min(Math.max(Math.round((currentPassedMs / totalYearMs) * 100), 0), 100);

      setDaysToEnem(diffDays > 0 ? diffDays : 0);
      setEnemProgress(progress);

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





  return (
    <div className="min-h-screen bg-background app-layout-container">
      <div className="fixed inset-0 bg-gradient-to-br from-primary/3 via-transparent to-accent/3 pointer-events-none" />

      <Navbar />

      {/* Conteúdo Principal do Painel */}
      <main className="relative max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <PageLoader loading={loading} variant="dashboard">
          {/* Banner de Boas-Vindas */}
          <WelcomeBanner userName={user?.user_metadata?.full_name?.split(" ")[0] || "Estudante"} userId={user?.id} />

          {/* Grid Geral do Dashboard */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">

            {/* ─── COLUNA PRINCIPAL (ESQUERDA - COLSPAN 2) ───────────────────── */}
            <div className="xl:col-span-2 space-y-6">

              {/* Card de Impacto: Regressiva ENEM */}
              <div data-tour="countdown-enem">
                <Card className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 border-primary/20 shadow-md">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6 relative">
                    <div className="space-y-2 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <span className="px-2 py-0.5 bg-primary/15 text-primary text-xs font-bold rounded-full uppercase tracking-wider">
                          ENEM 2026
                        </span>
                        <span className="text-xs text-muted-foreground">Provas em 08 e 15 de Nov</span>
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight">O tempo está correndo!</h2>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Cada hora de estudo focada coloca você mais perto da sua vaga na universidade dos sonhos. Mantenha a constância!
                      </p>
                    </div>

                    <div className="flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm px-6 py-4 rounded-2xl border border-border/50 shadow-sm shrink-0">
                      <span className="text-5xl font-black text-primary tracking-tight">{daysToEnem}</span>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Dias Restantes</span>
                    </div>
                  </CardContent>
                  <div className="px-6 pb-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Início do ano letivo</span>
                      <span>{enemProgress}% do ano concluído</span>
                    </div>
                    <Progress value={enemProgress} className="h-2 bg-muted-foreground/10" />
                  </div>
                </Card>
              </div>

              {/* Card de Foco: Timer Pomodoro */}
              <div data-tour="pomodoro-timer">
                <Card className="border-border/50 shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary animate-pulse" />
                        <CardTitle className="text-lg">Foco ENEM | Timer Pomodoro</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsExpanded(true)}
                        className="h-8 w-8 rounded-full hover:bg-muted/60"
                        title="Maximizar Cronômetro"
                      >
                        <Maximize2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                    <CardDescription>Configure sessões de foco alternadas com descansos curtos</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Seleção do Modo */}
                    <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto">
                      <Button
                        variant={pomodoroMode === "focus" ? "default" : "outline"}
                        onClick={() => changePomodoroMode("focus")}
                        className="flex-1 text-xs justify-center md:justify-start gap-2"
                      >
                        <Timer className="h-4 w-4" />
                        <span>Sessão de Foco</span>
                      </Button>
                      <Button
                        variant={pomodoroMode === "shortBreak" ? "default" : "outline"}
                        onClick={() => changePomodoroMode("shortBreak")}
                        className="flex-1 text-xs justify-center md:justify-start gap-2"
                      >
                        <CoffeeIcon className="h-4 w-4" />
                        <span>Pausa Curta</span>
                      </Button>
                      <Button
                        variant={pomodoroMode === "longBreak" ? "default" : "outline"}
                        onClick={() => changePomodoroMode("longBreak")}
                        className="flex-1 text-xs justify-center md:justify-start gap-2"
                      >
                        <CoffeeIcon className="h-4 w-4" />
                        <span>Pausa Longa</span>
                      </Button>
                    </div>

                    {/* Exibição Digital do Tempo */}
                    <div className="flex flex-col items-center justify-center flex-1">
                      <span className="text-6xl font-black font-mono tracking-wider text-foreground">
                        {formatTime(timeLeft)}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mt-1.5">
                        {pomodoroMode === "focus" ? "🔥 Modo Concentração" : "☕ Tempo de Descanso"}
                      </span>
                    </div>

                    {/* Controles de Play/Pause */}
                    <div className="flex gap-3 w-full md:w-auto justify-center">
                      <Button
                        size="lg"
                        onClick={toggleTimer}
                        className="rounded-full w-14 h-14 flex items-center justify-center p-0 shadow-md transition-transform hover:scale-105"
                      >
                        {timerActive ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={resetTimer}
                        className="rounded-full w-14 h-14 border-border/50 shadow-sm"
                      >
                        <RotateCcw className="h-5 w-5 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Seção de Análise: Desempenho por Áreas do ENEM */}
              <div data-tour="performance-areas">
                <Card className="border-border/50 shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Estatísticas e Desempenho por Área</CardTitle>
                    </div>
                    <CardDescription>
                      Proficiência calculada com base no histórico de questões respondidas
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {areaStats.map((area) => (
                      <div key={area.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: area.color }} />
                            <span className="font-semibold text-foreground">{area.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{area.totalAttempts} respondidas</span>
                            <span className="font-bold text-foreground text-sm">{area.accuracy}% acertos</span>
                          </div>
                        </div>
                        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: area.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${area.accuracy}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Caderno de Erros */}
              <ErrorReviewCard userId={user?.id} />

            </div>

            {/* ─── COLUNA LATERAL (DIREITA - COLSPAN 1) ───────────────────────── */}
            <div className="space-y-6" data-tour="study-planning">

              {/* Meta Diária */}
              <DailyGoalProgress userId={user?.id} />

              {/* Plano de Estudos do Dia */}
              <DynamicStudyPlan userId={user?.id} showGoal={false} />

              {/* Competição: Ranking & Desafios */}
              <Card className="border-border/50 shadow-md">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                    <Trophy className="h-4 w-4 text-amber-500 animate-bounce" />
                    <span className="font-bold text-sm">Competição Semanal</span>
                  </div>

                  {/* Desafios Semanais */}
                  <WeeklyChallenges userId={user?.id} />

                  {/* Leaderboard Compacto */}
                  <div className="pt-2 border-t border-border/50">
                    <Leaderboard userId={user?.id} />
                  </div>
                </CardContent>
              </Card>

            </div>

          </div>



        </PageLoader>
      </main>
    </div>
  );
};



export const DashboardPage = Dashboard;
export default Dashboard;
