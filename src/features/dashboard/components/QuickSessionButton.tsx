import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickSessionButtonProps {
  userId?: string;
}

interface WeakDiscipline {
  discipline: string;
  accuracy: number;
  total: number;
}

/**
 * Botão flutuante para iniciar uma sessão rápida de 5 questões
 * Seleciona automaticamente questões das disciplinas com menor taxa de acerto
 */
const QuickSessionButton = ({ userId }: QuickSessionButtonProps) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [weakDisciplines, setWeakDisciplines] = useState<WeakDiscipline[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchWeakDisciplines = async () => {
      try {
        // Busca estatísticas por disciplina das últimas 2 semanas
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const { data: attempts } = await supabase
          .from("question_attempts")
          .select("discipline, is_correct")
          .eq("user_id", userId)
          .gte("created_at", twoWeeksAgo.toISOString());

        if (!attempts || attempts.length === 0) {
          // Se não tem histórico, não mostra disciplinas fracas
          setWeakDisciplines([]);
          return;
        }

        // Agrupa por disciplina e calcula taxa de acerto
        const disciplineStats: Record<string, { correct: number; total: number }> = {};
        
        attempts.forEach((attempt) => {
          const disc = attempt.discipline || "Geral";
          if (!disciplineStats[disc]) {
            disciplineStats[disc] = { correct: 0, total: 0 };
          }
          disciplineStats[disc].total++;
          if (attempt.is_correct) {
            disciplineStats[disc].correct++;
          }
        });

        // Converte para array e ordena por taxa de acerto (menor primeiro)
        const sorted = Object.entries(disciplineStats)
          .map(([discipline, stats]) => ({
            discipline,
            accuracy: Math.round((stats.correct / stats.total) * 100),
            total: stats.total,
          }))
          .filter((d) => d.total >= 3) // Apenas disciplinas com pelo menos 3 tentativas
          .sort((a, b) => a.accuracy - b.accuracy)
          .slice(0, 3); // Top 3 piores

        setWeakDisciplines(sorted);
      } catch (error) {
        console.error("Error fetching weak disciplines:", error);
      }
    };

    fetchWeakDisciplines();
  }, [userId]);

  const handleStartQuickSession = async () => {
    setLoading(true);
    
    try {
      // Navega para a página de questões com filtro das disciplinas fracas
      const disciplineFilter = weakDisciplines.length > 0 
        ? weakDisciplines.map(d => d.discipline).join(",")
        : "";
      
      toast.success("Sessão rápida iniciada!", {
        description: weakDisciplines.length > 0 
          ? `Foco em: ${weakDisciplines.map(d => d.discipline).join(", ")}`
          : "5 questões aleatórias para você praticar",
      });
      
      // Navega para questões (o filtro pode ser implementado via query params ou estado)
      navigate("/questions", { 
        state: { 
          quickSession: true,
          targetDisciplines: weakDisciplines.map(d => d.discipline),
          questionCount: 5
        }
      });
    } finally {
      setLoading(false);
    }
  };

  // Não mostra se não tem userId
  if (!userId) return null;

  return (
    <>
      {/* Botão flutuante */}
      <motion.div
        className="fixed bottom-24 right-6 z-40"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 200 }}
      >
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="absolute bottom-16 right-0 w-72 p-4 bg-card border border-border rounded-xl shadow-xl"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <h4 className="font-semibold text-foreground">Sessão Rápida</h4>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              
              <p className="text-sm text-muted-foreground mb-3">
                5 questões focadas nas suas disciplinas mais fracas
              </p>

              {weakDisciplines.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Áreas para melhorar:
                  </p>
                  {weakDisciplines.map((disc) => (
                    <div 
                      key={disc.discipline}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-foreground truncate">{disc.discipline}</span>
                      <span className={`text-xs font-medium ${
                        disc.accuracy < 50 ? "text-red-500" : 
                        disc.accuracy < 70 ? "text-amber-500" : 
                        "text-green-500"
                      }`}>
                        {disc.accuracy}% acertos
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handleStartQuickSession}
                disabled={loading}
                className="w-full gap-2"
              >
                <Brain className="w-4 h-4" />
                {loading ? "Preparando..." : "Iniciar Sessão"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botão principal */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            relative w-14 h-14 rounded-full shadow-lg
            bg-gradient-to-br from-amber-400 to-amber-600
            flex items-center justify-center
            transition-shadow duration-300
            ${isExpanded ? "shadow-amber-500/40" : "hover:shadow-amber-500/50"}
          `}
        >
          <motion.div
            animate={isExpanded ? { rotate: 45 } : { rotate: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isExpanded ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <Zap className="w-6 h-6 text-white" />
            )}
          </motion.div>
          
          {/* Pulse animation quando fechado */}
          {!isExpanded && (
            <motion.div
              className="absolute inset-0 rounded-full bg-amber-400"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </motion.button>
      </motion.div>
    </>
  );
};

export default QuickSessionButton;
