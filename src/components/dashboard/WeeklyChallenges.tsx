import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Target, Trophy, Flame, CheckCircle2, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { formatDisciplineName } from "@/lib/formatters";

interface Challenge {
  id: string;
  title: string;
  description: string;
  target_value: number;
  discipline: string | null;
  reward_points: number;
  current_value: number;
  completed: boolean;
}

interface WeeklyChallengesProps {
  userId?: string;
}

const WeeklyChallenges = ({ userId }: WeeklyChallengesProps) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchChallenges = async () => {
      try {
        // Fetch active challenges
        const { data: challengesData, error: challengesError } = await supabase
          .from("weekly_challenges")
          .select("*")
          .eq("is_active", true)
          .gte("end_date", new Date().toISOString().split("T")[0])
          .lte("start_date", new Date().toISOString().split("T")[0]);

        if (challengesError) throw challengesError;

        // Fetch user progress for these challenges
        const challengeIds = (challengesData || []).map((c) => c.id);
        
        const { data: progressData } = await supabase
          .from("user_challenge_progress")
          .select("*")
          .eq("user_id", userId)
          .in("challenge_id", challengeIds);

        // Combine challenges with progress
        const combinedChallenges = (challengesData || []).map((challenge) => {
          const progress = (progressData || []).find((p) => p.challenge_id === challenge.id);
          return {
            id: challenge.id,
            title: challenge.title,
            description: challenge.description,
            target_value: challenge.target_value,
            discipline: challenge.discipline,
            reward_points: challenge.reward_points,
            current_value: progress?.current_value || 0,
            completed: progress?.completed || false,
          };
        });

        setChallenges(combinedChallenges);
      } catch (error) {
        console.error("Error fetching challenges:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChallenges();

    // Subscribe to progress updates
    const channel = supabase
      .channel("challenge_progress")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_challenge_progress",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchChallenges();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse h-16 bg-muted rounded-lg" />
        <div className="animate-pulse h-16 bg-muted rounded-lg" />
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="p-3 rounded-full bg-muted/50 mb-3">
          <Trophy className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Novos desafios em breve!
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Fique atento para os próximos desafios semanais
        </p>
      </div>
    );
  }

  const getIcon = (discipline: string | null, completed: boolean) => {
    if (completed) return CheckCircle2;
    if (!discipline) return Flame;
    return Target;
  };

  const getIconColor = (discipline: string | null, completed: boolean) => {
    if (completed) return "text-success";
    if (!discipline) return "text-warning";
    return "text-primary";
  };

  return (
    <div className="space-y-3">
        {challenges.slice(0, 3).map((challenge, index) => {
          const progress = Math.min((challenge.current_value / challenge.target_value) * 100, 100);
          const Icon = getIcon(challenge.discipline, challenge.completed);
          const iconColor = getIconColor(challenge.discipline, challenge.completed);

          return (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-3 rounded-lg border ${
                challenge.completed
                  ? "bg-success/10 border-success/30"
                  : "bg-muted/30 border-border/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg bg-background ${iconColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-medium text-sm truncate">{challenge.title}</h4>
                    <div className="flex items-center gap-1 text-xs text-warning shrink-0">
                      <Zap className="h-3 w-3" />
                      <span>{challenge.reward_points}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {challenge.discipline
                      ? formatDisciplineName(challenge.discipline)
                      : "Qualquer disciplina"}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Progress
                        value={progress}
                        className="h-2"
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                      {challenge.current_value}/{challenge.target_value}
                    </span>
                  </div>
                </div>
                {challenge.completed && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-success"
                  >
                    <Trophy className="h-5 w-5" />
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
    </div>
  );
};

export default WeeklyChallenges;
