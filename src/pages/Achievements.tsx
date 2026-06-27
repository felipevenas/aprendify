import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { Trophy, Lock, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import Navbar from "@/components/Navbar";
import { PageLoader } from "@/components/ui/page-loader";
import { useAchievements, Achievement } from "@/hooks/useAchievements";
import { cn } from "@/lib/utils";

const AchievementCard = ({ achievement, index }: { achievement: Achievement; index: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Card
        className={cn(
          "overflow-hidden transition-all duration-300 h-full",
          achievement.unlocked
            ? "border-primary/20 hover:border-primary/40 hover:shadow-lg"
            : "border-border/30 opacity-60 hover:opacity-80"
        )}
      >
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            {/* Badge Icon */}
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className={cn(
                "relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl flex-shrink-0",
                achievement.unlocked
                  ? `bg-gradient-to-br ${achievement.color} shadow-lg`
                  : "bg-muted"
              )}
            >
              {achievement.unlocked ? (
                <>
                  <span>{achievement.icon}</span>
                  <motion.div
                    className="absolute inset-0 rounded-2xl bg-white/20"
                    animate={{ opacity: [0, 0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
                  />
                </>
              ) : (
                <Lock className="h-8 w-8 text-muted-foreground/50" />
              )}
            </motion.div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={cn(
                  "font-bold text-lg",
                  achievement.unlocked ? "text-foreground" : "text-muted-foreground"
                )}>
                  {achievement.name}
                </h3>
                {achievement.unlocked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"
                  >
                    <span className="text-white text-xs">✓</span>
                  </motion.div>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                {achievement.description}
              </p>

              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full",
                  achievement.unlocked
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {achievement.requirement}
                </span>

                {achievement.unlocked && achievement.unlockedAt && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(achievement.unlockedAt).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const Achievements = () => {
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
  }, [navigate]);

  const { achievements, unlockedCount, totalCount, loading: achievementsLoading } = useAchievements(user?.id);

  const progressPercentage = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  const unlockedAchievements = achievements.filter((a) => a.unlocked);
  const lockedAchievements = achievements.filter((a) => !a.unlocked);

  return (
    <PageLoader loading={loading || achievementsLoading} message="Carregando conquistas...">
      <div className="min-h-screen bg-background app-layout-container">
        <div className="fixed inset-0 bg-gradient-to-br from-primary/3 via-transparent to-accent/3 pointer-events-none" />

        <Navbar />

        <main className="relative max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
                className="p-3 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg text-white shrink-0"
              >
                <Trophy className="h-6 w-6" />
              </motion.div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Conquistas
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Desbloqueie todas as conquistas e mostre sua dedicação!
                </p>
              </div>
            </div>

            {/* Overall Progress */}
            <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Progresso Geral</span>
                  </div>
                  <span className="text-2xl font-bold text-primary">
                    {unlockedCount}/{totalCount}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-3" />
                <p className="text-sm text-muted-foreground mt-2">
                  {progressPercentage.toFixed(0)}% das conquistas desbloqueadas
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Unlocked Achievements */}
          {unlockedAchievements.length > 0 && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-10"
            >
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Desbloqueadas ({unlockedAchievements.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {unlockedAchievements.map((achievement, index) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    index={index}
                  />
                ))}
              </div>
            </motion.section>
          )}

          {/* Locked Achievements */}
          {lockedAchievements.length > 0 && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-xl font-semibold text-muted-foreground mb-4 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Bloqueadas ({lockedAchievements.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lockedAchievements.map((achievement, index) => (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    index={index}
                  />
                ))}
              </div>
            </motion.section>
          )}
        </main>
      </div>
    </PageLoader>
  );
};

export default Achievements;
