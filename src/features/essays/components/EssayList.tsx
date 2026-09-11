import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Calendar, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CardGridSkeleton } from "@/components/ui/page-skeletons";

/**
 * Lista de redações do usuário com histórico
 */
interface EssayListProps {
  onSelectEssay: (essay: any) => void;
}

const EssayList = ({ onSelectEssay }: EssayListProps) => {
  const [essays, setEssays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar redações do usuário
  const loadEssays = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("essays")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setEssays(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEssays();

    // Configura realtime para atualizações automáticas de redações
    const channel = supabase
      .channel("essays_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "essays",
        },
        () => {
          // Recarrega redações quando houver mudanças
          loadEssays();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Cor baseada na nota
  const getScoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 800) return "text-green-600";
    if (score >= 600) return "text-yellow-600";
    if (score >= 400) return "text-orange-500";
    return "text-red-500";
  };

  // Badge de status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "corrected":
        return <Badge variant="default" className="bg-green-500">Corrigida</Badge>;
      case "pending":
        return <Badge variant="secondary">Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return <CardGridSkeleton count={3} />;
  }

  if (essays.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhuma redação ainda</h3>
        <p className="text-muted-foreground text-sm">
          Escreva sua primeira redação e receba uma correção completa no padrão ENEM.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {essays.map((essay, index) => (
        <motion.div
          key={essay.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className="p-4 hover:bg-muted/30 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Info da redação */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground truncate">
                    {essay.title}
                  </h3>
                  {getStatusBadge(essay.status)}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(essay.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </span>
                  
                  {essay.score_total !== null && (
                    <span className={`flex items-center gap-1 font-semibold ${getScoreColor(essay.score_total)}`}>
                      <Trophy className="h-3 w-3" />
                      {essay.score_total} pontos
                    </span>
                  )}
                </div>

                {/* Preview do conteúdo */}
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {essay.content.substring(0, 150)}...
                </p>
              </div>

              {/* Botão ver detalhes */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectEssay(essay)}
                className="gap-2 flex-shrink-0"
              >
                <Eye className="h-4 w-4" />
                Ver Detalhes
              </Button>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default EssayList;
