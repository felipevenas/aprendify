import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown, TrendingUp, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  user_id: string;
  username: string;
  questions_answered: number;
  questions_correct: number;
  points: number;
  rank: number;
}

interface LeaderboardProps {
  userId?: string;
}

const Leaderboard = ({ userId }: LeaderboardProps) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // Get current week start (Monday)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + mondayOffset);
        weekStart.setHours(0, 0, 0, 0);
        const weekStartStr = weekStart.toISOString().split("T")[0];

        // Fetch top 10 users for this week
        const { data: leaderboardData, error } = await supabase
          .from("leaderboard_stats")
          .select(`
            user_id,
            questions_answered,
            questions_correct,
            points
          `)
          .eq("week_start", weekStartStr)
          .order("points", { ascending: false })
          .limit(10);

        if (error) throw error;

        // Fetch usernames for these users
        const userIds = (leaderboardData || []).map((entry) => entry.user_id);
        
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", userIds);

        // Combine data with ranks
        const combinedData: LeaderboardEntry[] = (leaderboardData || []).map((entry, index) => {
          const profile = (profilesData || []).find((p) => p.id === entry.user_id);
          return {
            user_id: entry.user_id,
            username: profile?.full_name || profile?.username || "Estudante",
            questions_answered: entry.questions_answered,
            questions_correct: entry.questions_correct,
            points: entry.points,
            rank: index + 1,
          };
        });

        setEntries(combinedData);

        // Find current user's rank if not in top 10
        if (userId) {
          const userInTop = combinedData.find((e) => e.user_id === userId);
          if (userInTop) {
            setUserRank(userInTop);
          } else {
            // Check if user has stats this week
            const { data: userStats } = await supabase
              .from("leaderboard_stats")
              .select("*")
              .eq("user_id", userId)
              .eq("week_start", weekStartStr)
              .maybeSingle();

            if (userStats) {
              // Count how many users have more points
              const { count } = await supabase
                .from("leaderboard_stats")
                .select("*", { count: "exact", head: true })
                .eq("week_start", weekStartStr)
                .gt("points", userStats.points);

              const { data: userProfile } = await supabase
                .from("profiles")
                .select("full_name, username")
                .eq("id", userId)
                .maybeSingle();

              setUserRank({
                user_id: userId,
                username: userProfile?.full_name || userProfile?.username || "Você",
                questions_answered: userStats.questions_answered,
                questions_correct: userStats.questions_correct,
                points: userStats.points,
                rank: (count || 0) + 1,
              });
            }
          }
        }
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();

    // Subscribe to leaderboard updates
    const channel = supabase
      .channel("leaderboard_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leaderboard_stats",
        },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-4 w-4 text-warning" />;
      case 2:
        return <Medal className="h-4 w-4 text-muted-foreground" />;
      case 3:
        return <Medal className="h-4 w-4 text-warning" />;
      default:
        return <span className="text-xs font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankBg = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return "bg-primary/10 border-primary/30";
    switch (rank) {
      case 1:
        return "bg-warning/10 border-warning/30";
      case 2:
        return "bg-muted/50 border-border";
      case 3:
        return "bg-warning/5 border-warning/20";
      default:
        return "bg-muted/30 border-border/50";
    }
  };

  return (
    <div className="space-y-2">
      {entries.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma atividade esta semana</p>
            <p className="text-xs">Seja o primeiro a responder questões!</p>
          </div>
        ) : (
          <>
            {entries.slice(0, 5).map((entry, index) => {
              const isCurrentUser = entry.user_id === userId;

              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border ${getRankBg(
                    entry.rank,
                    isCurrentUser
                  )}`}
                >
                  <div className="w-6 flex justify-center">{getRankIcon(entry.rank)}</div>
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCurrentUser ? "text-primary" : ""}`}>
                      {isCurrentUser ? "Você" : entry.username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.questions_answered} questões •{" "}
                      {Math.round((entry.questions_correct / entry.questions_answered) * 100)}% acertos
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">{entry.points}</p>
                    <p className="text-xs text-muted-foreground">pts</p>
                  </div>
                </motion.div>
              );
            })}

            {/* Show user rank if not in top 5 */}
            {userRank && userRank.rank > 5 && (
              <>
                <div className="flex items-center justify-center py-1">
                  <span className="text-xs text-muted-foreground">• • •</span>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border ${getRankBg(
                    userRank.rank,
                    true
                  )}`}
                >
                  <div className="w-6 flex justify-center">{getRankIcon(userRank.rank)}</div>
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-primary">Você</p>
                    <p className="text-xs text-muted-foreground">
                      {userRank.questions_answered} questões •{" "}
                      {userRank.questions_answered > 0
                        ? Math.round((userRank.questions_correct / userRank.questions_answered) * 100)
                        : 0}
                      % acertos
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-primary">{userRank.points}</p>
                    <p className="text-xs text-muted-foreground">pts</p>
                  </div>
                </motion.div>
              </>
            )}
          </>
        )}
    </div>
  );
};

export default Leaderboard;
