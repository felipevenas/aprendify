import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface ErrorReviewCardProps {
  userId?: string;
}

interface ReviewStats {
  todayCount: number;
  totalPending: number;
  reviewedToday: number;
}

/**
 * Card que mostra questões pendentes de revisão (spaced repetition)
 * Exibe quantas questões precisam ser revisadas hoje baseado no algoritmo de repetição espaçada
 */
const ErrorReviewCard = ({ userId }: ErrorReviewCardProps) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchReviewStats = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Intervalos de repetição espaçada: 1, 3, 7, 14 dias
        const intervals = [1, 3, 7, 14];
        const reviewDates = intervals.map(days => {
          const date = new Date();
          date.setDate(date.getDate() - days);
          date.setHours(0, 0, 0, 0);
          return date.toISOString().split('T')[0];
        });

        // Buscar erros que devem ser revisados hoje
        const { data: errors, error } = await supabase
          .from("question_attempts")
          .select("id, created_at, question_id")
          .eq("user_id", userId)
          .eq("is_correct", false);

        if (error) throw error;

        // Filtrar erros que se encaixam nos intervalos de revisão
        const todayErrors = (errors || []).filter(err => {
          const errorDate = new Date(err.created_at).toISOString().split('T')[0];
          return reviewDates.includes(errorDate);
        });

        // Contar questões únicas para revisão hoje
        const uniqueQuestionIds = new Set(todayErrors.map(e => e.question_id));
        const todayCount = uniqueQuestionIds.size;

        // Total de erros pendentes (últimos 14 dias)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
        const recentErrors = (errors || []).filter(err => 
          new Date(err.created_at) >= fourteenDaysAgo
        );
        const totalPending = new Set(recentErrors.map(e => e.question_id)).size;

        // Questões já revisadas hoje (acertos de hoje em questões previamente erradas)
        const { data: todayCorrect } = await supabase
          .from("question_attempts")
          .select("question_id")
          .eq("user_id", userId)
          .eq("is_correct", true)
          .gte("created_at", today.toISOString());

        const reviewedIds = new Set(todayCorrect?.map(c => c.question_id) || []);
        const reviewedToday = [...uniqueQuestionIds].filter(id => reviewedIds.has(id)).length;

        setStats({
          todayCount,
          totalPending,
          reviewedToday
        });
      } catch (error) {
        console.error("Error fetching review stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviewStats();
  }, [userId]);

  if (loading || !stats) {
    return null;
  }

  // Não mostrar se não há questões para revisar
  if (stats.todayCount === 0 && stats.totalPending === 0) {
    return null;
  }

  const progress = stats.todayCount > 0 
    ? Math.round((stats.reviewedToday / stats.todayCount) * 100) 
    : 100;

  const allReviewed = stats.todayCount > 0 && stats.reviewedToday >= stats.todayCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mb-6"
    >
      <Card className={`overflow-hidden border-border/50 ${allReviewed ? 'bg-green-500/5' : 'bg-gradient-to-r from-amber-500/5 to-orange-500/5'}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className={`p-2.5 rounded-xl ${allReviewed ? 'bg-green-500/10' : 'bg-amber-500/10'}`}
                animate={{ rotate: allReviewed ? 0 : [0, -10, 10, 0] }}
                transition={{ duration: 0.5, repeat: allReviewed ? 0 : Infinity, repeatDelay: 3 }}
              >
                {allReviewed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <RotateCcw className="h-5 w-5 text-amber-500" />
                )}
              </motion.div>
              <div>
                <CardTitle className="text-base">
                  {allReviewed ? "Revisão concluída! 🎉" : "Revisão de Erros"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {allReviewed 
                    ? "Você revisou todas as questões de hoje" 
                    : "Questões para revisar hoje (repetição espaçada)"}
                </CardDescription>
              </div>
            </div>
            {stats.todayCount > 0 && !allReviewed && (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3 w-3 mr-1" />
                {stats.todayCount - stats.reviewedToday} pendentes
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.todayCount > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso de hoje</span>
                <span className="font-medium">{stats.reviewedToday}/{stats.todayCount}</span>
              </div>
              <Progress 
                value={progress} 
                className={`h-2 ${allReviewed ? '[&>div]:bg-green-500' : '[&>div]:bg-amber-500'}`} 
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {stats.totalPending} questões no ciclo de revisão
            </span>
            <Button 
              size="sm" 
              variant={allReviewed ? "outline" : "default"}
              onClick={() => navigate("/review-errors")}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {allReviewed ? "Ver detalhes" : "Revisar agora"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ErrorReviewCard;
