import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Calendar, Sparkles, BookOpen, LayoutGrid, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";

import MonthlyCalendar from "@/components/schedule/MonthlyCalendar";
import DayScheduleDetail from "@/components/schedule/DayScheduleDetail";
import GenerateScheduleButton from "@/components/schedule/GenerateScheduleButton";
import AddScheduleItemDialog from "@/components/schedule/AddScheduleItemDialog";
import WeeklyAdherenceReport from "@/components/schedule/WeeklyAdherenceReport";
import WeeklyAgendaView from "@/components/schedule/WeeklyAgendaView";
import SubjectProgressCircles from "@/components/schedule/SubjectProgressCircles";
import { Progress } from "@/components/ui/progress";

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
  subject_id?: string | null;
}

interface ScheduleGeneration {
  generated_at: string;
  next_regeneration_at: string;
  last_forced_at?: string | null;
}

const Schedule = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ScheduleItem | null>(null);
  const [prefillSlot, setPrefillSlot] = useState<{ date: Date; startTime: string } | null>(null);
  const [lastGeneration, setLastGeneration] = useState<ScheduleGeneration | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week">("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
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

  useEffect(() => {
    const checkAutoRegeneration = async () => {
      if (!lastGeneration) return;

      const nextRegen = new Date(lastGeneration.next_regeneration_at);
      const now = new Date();

      if (now >= nextRegen) {
        console.log("[Schedule] Auto-regeneração ativada - período de 7 dias completado");
        toast.info("Gerando novo plano de estudos baseado no seu desempenho...");

        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const accessToken = session?.access_token;

          const { data, error } = await supabase.functions.invoke("generate-study-schedule", {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          });

          if (error) {
            console.error("Erro na auto-regeneração:", error);
            return;
          }

          if (data?.success) {
            toast.success(`Novo plano gerado com ${data.itemsCreated} sessões!`);
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
        .select("*")
        .eq("user_id", user.id)
        .not("scheduled_date", "is", null)
        .order("scheduled_date")
        .order("start_time");

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      toast.error("Erro ao carregar plano de estudos");
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
        .select("generated_at, next_regeneration_at, last_forced_at")
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
      toast.success(completed ? "Sessão concluída! 🎉" : "Sessão desmarcada");
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
  const totalStudyMinutes = items.reduce((acc, item) => acc + (item.estimated_duration || 60), 0);
  const totalStudyHours = Math.floor(totalStudyMinutes / 60);

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
      

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-foreground">Plano de Estudos</h1>
                      <p className="text-muted-foreground text-xs sm:text-sm">
                        {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-12 sm:ml-0">
                {/* View toggle */}
                <div className="flex items-center bg-muted rounded-lg p-0.5">
                  <Button
                    variant={viewMode === "week" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2 gap-1"
                    onClick={() => setViewMode("week")}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-xs">Semana</span>
                  </Button>
                  <Button
                    variant={viewMode === "month" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2 gap-1"
                    onClick={() => setViewMode("month")}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-xs">Mês</span>
                  </Button>
                </div>
                <GenerateScheduleButton onGenerated={handleGenerated} lastGeneration={lastGeneration} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditItem(null);
                    setDialogOpen(true);
                  }}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Adicionar</span>
                </Button>
              </div>
            </div>

            {/* Compact Stats Row */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-3 bg-card rounded-xl border border-border/50 shadow-sm text-center"
              >
                <p className="text-xs text-muted-foreground">Sessões</p>
                <p className="text-lg sm:text-xl font-bold text-foreground">{items.length}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="p-3 bg-card rounded-xl border border-border/50 shadow-sm text-center"
              >
                <p className="text-xs text-muted-foreground">Feitas</p>
                <p className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">{completedCount}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-3 bg-card rounded-xl border border-border/50 shadow-sm text-center"
              >
                <p className="text-xs text-muted-foreground">Horas</p>
                <p className="text-lg sm:text-xl font-bold text-foreground">{totalStudyHours}h</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="p-3 bg-card rounded-xl border border-primary/20 shadow-sm text-center"
              >
                <p className="text-xs text-muted-foreground">Aderência</p>
                <div className="flex flex-col items-center">
                  <p className="text-lg sm:text-xl font-bold text-primary">{completionRate}%</p>
                  <Progress value={completionRate} className="h-1 w-full mt-1" />
                </div>
              </motion.div>
            </div>
          </div>

          {/* Layout Principal */}
          {viewMode === "week" ? (
            /* Weekly Agenda View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekStart(subWeeks(weekStart, 1))}
                  className="text-xs"
                >
                  ← Semana anterior
                </Button>
                <span className="text-sm font-medium text-muted-foreground">
                  {format(weekStart, "dd MMM", { locale: ptBR })} – {format(addWeeks(weekStart, 1), "dd MMM yyyy", { locale: ptBR })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekStart(addWeeks(weekStart, 1))}
                  className="text-xs"
                >
                  Próxima semana →
                </Button>
              </div>

              <WeeklyAgendaView
                items={items}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleComplete={handleToggleComplete}
                onAddAtSlot={(date, startTime) => {
                  setEditItem(null);
                  setPrefillSlot({ date, startTime });
                  setDialogOpen(true);
                }}
                weekStart={weekStart}
              />

              {/* Bottom row: Day detail + Subject progress */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  {selectedDate && (
                    <DayScheduleDetail
                      date={selectedDate}
                      items={selectedDateItems}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggleComplete={handleToggleComplete}
                    />
                  )}
                </div>
                <div className="space-y-4">
                  <SubjectProgressCircles items={items} />
                  <WeeklyAdherenceReport items={items} />
                </div>
              </div>
            </div>
          ) : (
            /* Monthly Calendar View */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="lg:col-span-1 space-y-4"
              >
                <MonthlyCalendar items={items} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
                <SubjectProgressCircles items={items} />
                <WeeklyAdherenceReport items={items} />
              </motion.div>

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
          )}
        </motion.div>
      </main>

      <AddScheduleItemDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditItem(null);
            setPrefillSlot(null);
          }
        }}
        editItem={editItem}
        selectedDate={prefillSlot?.date || selectedDate}
        prefillStartTime={prefillSlot?.startTime}
      />
    </div>
  );
};

export default Schedule;
