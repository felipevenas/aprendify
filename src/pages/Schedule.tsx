import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Calendar, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Navbar from "@/components/Navbar";
import MonthlyCalendar from "@/components/schedule/MonthlyCalendar";
import DayScheduleDetail from "@/components/schedule/DayScheduleDetail";
import GenerateScheduleButton from "@/components/schedule/GenerateScheduleButton";
import AddScheduleItemDialog from "@/components/schedule/AddScheduleItemDialog";
import WeeklyAdherenceReport from "@/components/schedule/WeeklyAdherenceReport";

interface ScheduleItem {
  id: string;
  title: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  topic?: string;
  activities?: string;
  study_tips?: string;
  priority?: string;
  estimated_duration?: number;
  is_ai_generated?: boolean;
  completed?: boolean;
  completed_at?: string;
  subject_id?: string;
  subjects?: {
    name: string;
    color: string;
  };
}

interface ScheduleGeneration {
  generated_at: string;
  next_regeneration_at: string;
}

const Schedule = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ScheduleItem | null>(null);
  const [lastGeneration, setLastGeneration] = useState<ScheduleGeneration | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      await Promise.all([fetchSchedule(), fetchLastGeneration()]);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  // Auto-regeneração: verifica se passou o período de 7 dias e regenera automaticamente
  useEffect(() => {
    const checkAutoRegeneration = async () => {
      if (!lastGeneration) return;
      
      const nextRegen = new Date(lastGeneration.next_regeneration_at);
      const now = new Date();
      
      if (now >= nextRegen) {
        console.log("[Schedule] Auto-regeneração ativada - período de 7 dias completado");
        toast.info("Gerando novo cronograma baseado no seu desempenho...");
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const accessToken = session?.access_token;

          const { data, error } = await supabase.functions.invoke("generate-study-schedule", {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          });

          if (error) {
            console.error("Erro na auto-regeneração:", error);
            return;
          }

          if (data?.success) {
            toast.success(`Novo cronograma gerado com ${data.itemsCreated} sessões!`);
            fetchSchedule();
            fetchLastGeneration();
          }
        } catch (error) {
          console.error("Erro na auto-regeneração:", error);
        }
      }
    };

    if (!loading && lastGeneration) {
      checkAutoRegeneration();
    }
  }, [loading, lastGeneration]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("schedule_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_items",
        },
        () => {
          fetchSchedule();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSchedule = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("schedule_items")
        .select("*, subjects(name, color)")
        .eq("user_id", user.id)
        .not("scheduled_date", "is", null)
        .order("scheduled_date")
        .order("start_time");

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      toast.error("Erro ao carregar cronograma");
    }
  };

  const fetchLastGeneration = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("schedule_generations")
        .select("generated_at, next_regeneration_at")
        .eq("user_id", user.id)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLastGeneration(data);
    } catch (error) {
      console.error("Error fetching generation info:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("schedule_items").delete().eq("id", id);

      if (error) throw error;
      toast.success("Sessão removida!");
    } catch (error) {
      toast.error("Erro ao remover sessão");
    }
  };

  const handleEdit = (item: ScheduleItem) => {
    setEditItem(item);
    setDialogOpen(true);
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from("schedule_items")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success(completed ? "Sessão concluída!" : "Sessão desmarcada");
    } catch (error) {
      console.error("Error toggling complete:", error);
      toast.error("Erro ao atualizar sessão");
    }
  };

  const handleGenerated = () => {
    fetchSchedule();
    fetchLastGeneration();
  };

  const selectedDateItems = selectedDate
    ? items.filter((item) => item.scheduled_date === format(selectedDate, "yyyy-MM-dd"))
    : [];

  const completedCount = items.filter((i) => i.completed).length;
  const completionRate = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/3">
      <Navbar />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Cronograma</h1>
                  </div>
                  <p className="text-muted-foreground text-sm mt-1">
                    {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <GenerateScheduleButton onGenerated={handleGenerated} lastGeneration={lastGeneration} />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditItem(null);
                    setDialogOpen(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Adicionar</span>
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm"
              >
                <p className="text-xs text-muted-foreground mb-1">Sessões</p>
                <p className="text-2xl font-bold text-foreground">{items.length}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
                className="p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm"
              >
                <p className="text-xs text-muted-foreground mb-1">Concluídas</p>
                <p className="text-2xl font-bold text-green-600">{completedCount}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm"
              >
                <p className="text-xs text-muted-foreground mb-1">Pendentes</p>
                <p className="text-2xl font-bold text-amber-600">{items.length - completedCount}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 }}
                className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm rounded-xl border border-primary/20 shadow-sm"
              >
                <p className="text-xs text-muted-foreground mb-1">Aderência</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold text-primary">{completionRate}%</p>
                  {completionRate >= 70 && <Sparkles className="h-4 w-4 text-primary" />}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Layout Principal */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sidebar - Calendário e Report */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-1 space-y-4"
            >
              <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-sm overflow-hidden">
                <MonthlyCalendar items={items} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
              </div>

              <WeeklyAdherenceReport items={items} />
            </motion.div>

            {/* Conteúdo Principal - Dia Selecionado */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              className="lg:col-span-2"
            >
              {selectedDate && (
                <DayScheduleDetail
                  date={selectedDate}
                  items={selectedDateItems}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleComplete={handleToggleComplete}
                />
              )}
            </motion.div>
          </div>
        </motion.div>
      </main>

      <AddScheduleItemDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditItem(null);
        }}
        editItem={editItem}
        selectedDate={selectedDate}
      />
    </div>
  );
};

export default Schedule;
