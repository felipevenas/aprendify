import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Lock, ChevronRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAchievements, Achievement } from "@/hooks/useAchievements";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface AchievementBadgesProps {
  userId?: string;
  compact?: boolean;
}

const AchievementBadge = ({ achievement, index }: { achievement: Achievement; index: number }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05, type: "spring", stiffness: 300 }}
            className={cn(
              "relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-xl sm:text-2xl cursor-pointer transition-all duration-300",
              achievement.unlocked
                ? `bg-gradient-to-br ${achievement.color} shadow-lg hover:scale-110 hover:shadow-xl`
                : "bg-muted/50 grayscale opacity-50 hover:opacity-70"
            )}
          >
            {achievement.unlocked ? (
              <>
                <span>{achievement.icon}</span>
                <motion.div
                  className="absolute inset-0 rounded-xl bg-white/20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                />
              </>
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground/50" />
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <div className="text-center">
            <p className="font-semibold">{achievement.name}</p>
            <p className="text-xs text-muted-foreground">{achievement.description}</p>
            {!achievement.unlocked && (
              <p className="text-xs text-primary mt-1">{achievement.requirement}</p>
            )}
            {achievement.unlocked && achievement.unlockedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Desbloqueado em{" "}
                {new Date(achievement.unlockedAt).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const AchievementBadges = ({ userId, compact = false }: AchievementBadgesProps) => {
  const { achievements, loading, unlockedCount, totalCount, newlyUnlocked } = useAchievements(userId);
  const navigate = useNavigate();

  const progressPercentage = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  // For compact mode, show only unlocked + a few locked
  const displayedAchievements = compact
    ? [...achievements.filter((a) => a.unlocked).slice(0, 5), ...achievements.filter((a) => !a.unlocked).slice(0, 3)]
    : achievements;

  if (loading) {
    return (
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-12 h-12 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Newly unlocked achievement celebration */}
      <AnimatePresence>
        {newlyUnlocked && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
          >
            <Card className={`bg-gradient-to-r ${newlyUnlocked.color} text-white shadow-2xl border-0`}>
              <CardContent className="flex items-center gap-4 p-4">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                  className="text-4xl"
                >
                  {newlyUnlocked.icon}
                </motion.div>
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-medium opacity-90">Conquista Desbloqueada!</span>
                  </div>
                  <p className="font-bold text-lg">{newlyUnlocked.name}</p>
                  <p className="text-sm opacity-80">{newlyUnlocked.description}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="bg-card border-border/50 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
              >
                <Trophy className="h-5 w-5 text-primary" />
              </motion.div>
              Conquistas
            </CardTitle>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/achievements")}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
            >
              Ver todas
              <ChevronRight className="h-3 w-3" />
            </motion.button>
          </div>

          {/* Progress bar */}
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progresso</span>
              <span className="font-medium text-foreground">
                {unlockedCount}/{totalCount}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {displayedAchievements.map((achievement, index) => (
              <AchievementBadge key={achievement.id} achievement={achievement} index={index} />
            ))}
            
            {compact && achievements.length > displayedAchievements.length && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate("/achievements")}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-muted/30 border border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs font-medium">+{achievements.length - displayedAchievements.length}</span>
              </motion.button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default AchievementBadges;
