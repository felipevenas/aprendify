import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  BookOpen, 
  Clock, 
  Target, 
  TrendingDown, 
  Sparkles,
  ChevronRight,
  Zap,
  Brain,
  CheckCircle2,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { formatDisciplineName } from "@/lib/formatters";

interface StudySuggestion {
  type: "weak_discipline" | "review" | "new_topic" | "challenge" | "break";
  title: string;
  description: string;
  discipline?: string;
  priority: "high" | "medium" | "low";
  estimatedMinutes: number;
  path: string;
  queryParams?: string;
}

interface TodayStats {
  questionsAnswered: number;
  correctAnswers: number;
  studyTimeMinutes: number;
  disciplinesCovered: string[];
}

interface DynamicStudyPlanProps {
  userId?: string;
}

const DAILY_GOAL = 20;

const getMotivationalMessage = (progress: number, accuracy: number) => {
  if (progress >= 100 && accuracy >= 80) return "🏆 Excelente! Meta batida com alta precisão!";
  if (progress >= 100) return "✅ Meta diária concluída! Continue firme!";
  if (progress >= 75) return "🔥 Quase lá! Falta pouco para a meta!";
  if (progress >= 50) return "💪 Metade do caminho! Não pare agora!";
  if (progress >= 25) return "📚 Bom começo! Mantenha o ritmo!";
  return "🚀 Hora de começar! Sua meta te espera!";
};

const DynamicStudyPlan = ({ userId }: DynamicStudyPlanProps) => {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<StudySuggestion[]>([]);
  const [todayStats, setTodayStats] = useState<TodayStats>({
    questionsAnswered: 0,
    correctAnswers: 0,
    studyTimeMinutes: 0,
    disciplinesCovered: [],
  });
  const [loading, setLoading] = useState(true);
  const [weeklyProgress, setWeeklyProgress] = useState<{ day: string; count: number }[]>([]);

  useEffect(() => {
    if (!userId) return;

    const generateSuggestions = async () => {
      try {
        const suggestionsList: StudySuggestion[] = [];

        // Get today's date at start of day
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Get last 14 days of attempts for analysis
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        // Fetch today's attempts and recent attempts in parallel
        const [todayResult, recentResult] = await Promise.all([
          supabase
            .from("question_attempts")
            .select("discipline, is_correct, created_at")
            .eq("user_id", userId)
            .gte("created_at", todayStart.toISOString()),
          supabase
            .from("question_attempts")
            .select("discipline, is_correct, created_at, topic")
            .eq("user_id", userId)
            .gte("created_at", twoWeeksAgo.toISOString())
            .order("created_at", { ascending: false })
        ]);

        const todayAttempts = todayResult.data || [];
        const recentAttempts = recentResult.data || [];

        // Calculate today's stats
        const uniqueDisciplines = [...new Set(todayAttempts.map(a => a.discipline))];
        const correctToday = todayAttempts.filter(a => a.is_correct).length;
        
        setTodayStats({
          questionsAnswered: todayAttempts.length,
          correctAnswers: correctToday,
          studyTimeMinutes: Math.round(todayAttempts.length * 2), // Estimate 2 min per question
          disciplinesCovered: uniqueDisciplines,
        });

        // Calculate weekly progress (last 7 days)
        const weekData: { day: string; count: number }[] = [];
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);
          
          const dayCount = recentAttempts.filter(a => {
            const attemptDate = new Date(a.created_at);
            return attemptDate >= date && attemptDate < nextDate;
          }).length;
          
          weekData.push({
            day: dayNames[date.getDay()],
            count: dayCount,
          });
        }
        setWeeklyProgress(weekData);

        // Calculate discipline performance
        const disciplineStats: Record<string, { correct: number; total: number; lastAttempt: Date }> = {};
        
        (recentAttempts || []).forEach((attempt) => {
          if (!disciplineStats[attempt.discipline]) {
            disciplineStats[attempt.discipline] = { correct: 0, total: 0, lastAttempt: new Date(attempt.created_at) };
          }
          disciplineStats[attempt.discipline].total++;
          if (attempt.is_correct) {
            disciplineStats[attempt.discipline].correct++;
          }
          const attemptDate = new Date(attempt.created_at);
          if (attemptDate > disciplineStats[attempt.discipline].lastAttempt) {
            disciplineStats[attempt.discipline].lastAttempt = attemptDate;
          }
        });

        // Find weak disciplines (accuracy < 60%)
        const weakDisciplines = Object.entries(disciplineStats)
          .filter(([_, stats]) => stats.total >= 5 && (stats.correct / stats.total) < 0.6)
          .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));

        if (weakDisciplines.length > 0) {
          const [discipline, stats] = weakDisciplines[0];
          const accuracy = Math.round((stats.correct / stats.total) * 100);
          
          suggestionsList.push({
            type: "weak_discipline",
            title: `Reforçar ${formatDisciplineName(discipline)}`,
            description: `Acertando ${accuracy}% - vamos melhorar!`,
            discipline,
            priority: "high",
            estimatedMinutes: 30,
            path: "/questions",
            queryParams: `?discipline=${encodeURIComponent(discipline)}`,
          });
        }

        // Find neglected disciplines (not studied in 5+ days)
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        
        const neglectedDisciplines = Object.entries(disciplineStats)
          .filter(([_, stats]) => stats.lastAttempt < fiveDaysAgo)
          .sort((a, b) => a[1].lastAttempt.getTime() - b[1].lastAttempt.getTime());

        if (neglectedDisciplines.length > 0) {
          const [discipline, stats] = neglectedDisciplines[0];
          const daysSince = Math.floor((Date.now() - stats.lastAttempt.getTime()) / (1000 * 60 * 60 * 24));
          
          suggestionsList.push({
            type: "review",
            title: `Revisar ${formatDisciplineName(discipline)}`,
            description: `${daysSince} dias sem praticar`,
            discipline,
            priority: "medium",
            estimatedMinutes: 20,
            path: "/questions",
            queryParams: `?discipline=${encodeURIComponent(discipline)}`,
          });
        }

        // Check for pending challenges
        const { data: pendingChallenges } = await supabase
          .from("user_challenge_progress")
          .select(`
            current_value,
            challenge:weekly_challenges (
              title,
              target_value,
              discipline
            )
          `)
          .eq("user_id", userId)
          .eq("completed", false);

        if (pendingChallenges && pendingChallenges.length > 0) {
          const challenge = pendingChallenges[0];
          const challengeData = challenge.challenge as any;
          if (challengeData) {
            const remaining = challengeData.target_value - challenge.current_value;
            
            suggestionsList.push({
              type: "challenge",
              title: challengeData.title,
              description: `Faltam ${remaining} para completar`,
              discipline: challengeData.discipline,
              priority: "medium",
              estimatedMinutes: remaining * 2,
              path: "/questions",
              queryParams: challengeData.discipline 
                ? `?discipline=${encodeURIComponent(challengeData.discipline)}` 
                : "",
            });
          }
        }

        // Add general suggestion if we don't have weak areas
        if (suggestionsList.length === 0) {
          const allDisciplines = ["matematica", "linguagens", "humanas", "natureza"];
          const practiced = Object.keys(disciplineStats);
          const notPracticed = allDisciplines.filter(d => !practiced.includes(d));
          
          if (notPracticed.length > 0) {
            suggestionsList.push({
              type: "new_topic",
              title: `Explorar ${formatDisciplineName(notPracticed[0])}`,
              description: "Disciplina nova para você!",
              discipline: notPracticed[0],
              priority: "low",
              estimatedMinutes: 20,
              path: "/questions",
              queryParams: `?discipline=${encodeURIComponent(notPracticed[0])}`,
            });
          } else {
            suggestionsList.push({
              type: "review",
              title: "Revisão Geral",
              description: "Pratique questões variadas",
              priority: "low",
              estimatedMinutes: 25,
              path: "/questions",
            });
          }
        }

        setSuggestions(suggestionsList.slice(0, 3));
      } catch (error) {
        console.error("Error generating study suggestions:", error);
      } finally {
        setLoading(false);
      }
    };

    generateSuggestions();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse h-20 bg-muted rounded-lg" />
        <div className="animate-pulse h-14 bg-muted rounded-lg" />
      </div>
    );
  }

  const goalProgress = Math.min((todayStats.questionsAnswered / DAILY_GOAL) * 100, 100);
  const accuracy = todayStats.questionsAnswered > 0 
    ? Math.round((todayStats.correctAnswers / todayStats.questionsAnswered) * 100) 
    : 0;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-destructive/30 bg-destructive/5 hover:bg-destructive/10";
      case "medium":
        return "border-warning/30 bg-warning/5 hover:bg-warning/10";
      default:
        return "border-success/30 bg-success/5 hover:bg-success/10";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "weak_discipline":
        return TrendingDown;
      case "review":
        return BookOpen;
      case "challenge":
        return Target;
      case "new_topic":
        return Brain;
      default:
        return Sparkles;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "weak_discipline":
        return "text-destructive";
      case "review":
        return "text-info";
      case "challenge":
        return "text-warning";
      case "new_topic":
        return "text-success";
      default:
        return "text-primary";
    }
  };

  const maxWeekCount = Math.max(...weeklyProgress.map(d => d.count), 1);

  return (
    <div className="space-y-3">
        {/* Today's Progress Section */}
        <div className="p-3 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <Target className="h-4 w-4 text-primary" />
              Meta Diária
            </span>
            <span className="text-sm font-bold text-primary">
              {todayStats.questionsAnswered}/{DAILY_GOAL}
            </span>
          </div>
          <Progress value={goalProgress} className="h-2 mb-2" />
          <p className="text-[11px] text-muted-foreground mb-2">
            {getMotivationalMessage(goalProgress, accuracy)}
          </p>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-md bg-background/50">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                <CheckCircle2 className="h-3 w-3" />
                Acertos
              </div>
              <span className="text-sm font-bold text-success">
                {accuracy}%
              </span>
            </div>
            <div className="text-center p-2 rounded-md bg-background/50">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                <Clock className="h-3 w-3" />
                Tempo
              </div>
              <span className="text-sm font-bold">
                {todayStats.studyTimeMinutes}min
              </span>
            </div>
            <div className="text-center p-2 rounded-md bg-background/50">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                <BookOpen className="h-3 w-3" />
                Matérias
              </div>
              <span className="text-sm font-bold">
                {todayStats.disciplinesCovered.length}
              </span>
            </div>
          </div>
        </div>

        {/* Weekly Activity Mini Chart */}
        <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Atividade da Semana
            </span>
            <span className="text-xs text-muted-foreground">
              {weeklyProgress.reduce((sum, d) => sum + d.count, 0)} questões
            </span>
          </div>
          <div className="flex items-end justify-between gap-1 h-10">
            {weeklyProgress.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full rounded-sm bg-primary/20 transition-all"
                  style={{ 
                    height: `${Math.max((day.count / maxWeekCount) * 100, 8)}%`,
                    backgroundColor: day.count > 0 ? undefined : 'var(--muted)',
                  }}
                >
                  <div 
                    className="w-full h-full rounded-sm bg-primary transition-all"
                    style={{ opacity: day.count > 0 ? 1 : 0.2 }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{day.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Study Suggestions */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Recomendações
          </h4>
          {suggestions.map((suggestion, index) => {
            const Icon = getTypeIcon(suggestion.type);
            const iconColor = getTypeColor(suggestion.type);

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${getPriorityColor(suggestion.priority)}`}
                onClick={() => navigate(suggestion.path + (suggestion.queryParams || ""))}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md bg-background ${iconColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{suggestion.title}</h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        {suggestion.description}
                        <span className="text-muted-foreground/50">•</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {suggestion.estimatedMinutes}min
                        </span>
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </motion.div>
            );
          })}
        </div>

        <Button 
          variant="outline" 
          className="w-full gap-2 border-dashed"
          onClick={() => navigate("/questions")}
        >
          <Zap className="h-4 w-4" />
          {todayStats.questionsAnswered >= DAILY_GOAL 
            ? "Continuar estudando" 
            : "Completar meta (" + (DAILY_GOAL - todayStats.questionsAnswered) + " restantes)"
          }
        </Button>
    </div>
  );
};

export default DynamicStudyPlan;

