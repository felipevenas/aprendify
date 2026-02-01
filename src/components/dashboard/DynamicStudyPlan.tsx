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
  Brain
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface DynamicStudyPlanProps {
  userId?: string;
}

const DynamicStudyPlan = ({ userId }: DynamicStudyPlanProps) => {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<StudySuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const generateSuggestions = async () => {
      try {
        const suggestionsList: StudySuggestion[] = [];

        // Get last 14 days of attempts for analysis
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const { data: recentAttempts } = await supabase
          .from("question_attempts")
          .select("discipline, is_correct, created_at, topic")
          .eq("user_id", userId)
          .gte("created_at", twoWeeksAgo.toISOString())
          .order("created_at", { ascending: false });

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
            title: `Foco em ${formatDisciplineName(discipline)}`,
            description: `Taxa de acerto: ${accuracy}%. Pratique para melhorar!`,
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
            description: `Faz ${daysSince} dias que você não pratica. Hora de revisar!`,
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
              title: `Desafio: ${challengeData.title}`,
              description: `Faltam ${remaining} questões para completar!`,
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
        if (suggestionsList.length === 0 || !weakDisciplines.length) {
          const allDisciplines = ["Matemática", "Linguagens", "Ciências Humanas", "Ciências da Natureza"];
          const practiced = Object.keys(disciplineStats);
          const notPracticed = allDisciplines.filter(d => !practiced.includes(d));
          
          if (notPracticed.length > 0) {
            suggestionsList.push({
              type: "new_topic",
              title: `Explorar ${formatDisciplineName(notPracticed[0])}`,
              description: "Você ainda não praticou esta disciplina. Comece agora!",
              discipline: notPracticed[0],
              priority: "low",
              estimatedMinutes: 20,
              path: "/questions",
              queryParams: `?discipline=${encodeURIComponent(notPracticed[0])}`,
            });
          } else {
            suggestionsList.push({
              type: "review",
              title: "Sessão de Revisão Geral",
              description: "Pratique questões variadas para manter o conhecimento fresco.",
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
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            O que estudar hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-red-500/30 bg-red-500/5";
      case "medium":
        return "border-yellow-500/30 bg-yellow-500/5";
      default:
        return "border-green-500/30 bg-green-500/5";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return { text: "Prioridade Alta", color: "bg-red-500/20 text-red-600" };
      case "medium":
        return { text: "Recomendado", color: "bg-yellow-500/20 text-yellow-600" };
      default:
        return { text: "Opcional", color: "bg-green-500/20 text-green-600" };
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

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          O que estudar hoje
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion, index) => {
          const Icon = getTypeIcon(suggestion.type);
          const badge = getPriorityBadge(suggestion.priority);

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${getPriorityColor(
                suggestion.priority
              )}`}
              onClick={() => navigate(suggestion.path + (suggestion.queryParams || ""))}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-background">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{suggestion.title}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.color}`}>
                        {badge.text}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{suggestion.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        ~{suggestion.estimatedMinutes} min
                      </span>
                      {suggestion.discipline && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {formatDisciplineName(suggestion.discipline)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </motion.div>
          );
        })}

        <Button 
          variant="outline" 
          className="w-full gap-2"
          onClick={() => navigate("/questions")}
        >
          <Zap className="h-4 w-4" />
          Sessão rápida (10 questões)
        </Button>
      </CardContent>
    </Card>
  );
};

export default DynamicStudyPlan;
