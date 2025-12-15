import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import Navbar from "@/components/Navbar";
import MonthlyCalendar from "@/components/schedule/MonthlyCalendar";
import DayScheduleDetail from "@/components/schedule/DayScheduleDetail";
import GenerateScheduleButton from "@/components/schedule/GenerateScheduleButton";
import AddScheduleItemDialog from "@/components/schedule/AddScheduleItemDialog";

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      await Promise.all([fetchSchedule(), fetchLastGeneration()]);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSchedule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
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
      const { error } = await supabase
        .from("schedule_items")
        .delete()
        .eq("id", id);

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

  const handleGenerated = () => {
    fetchSchedule();
    fetchLastGeneration();
  };

  const selectedDateItems = selectedDate
    ? items.filter((item) => item.scheduled_date === format(selectedDate, "yyyy-MM-dd"))
    : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Navbar />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
                Cronograma Mensal
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
                Organize suas sessões de estudo com inteligência artificial
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/dashboard")} 
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
              
              <GenerateScheduleButton 
                onGenerated={handleGenerated}
                lastGeneration={lastGeneration}
              />
              
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
                Manual
              </Button>
            </div>
          </div>

          {/* Layout do Calendário */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendário Mensal */}
            <div className="lg:col-span-1">
              <MonthlyCalendar
                items={items}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
              
              {/* Stats rápidas */}
              <div className="mt-4 p-4 bg-card rounded-lg border border-border">
                <h3 className="font-medium text-sm mb-3">Resumo do Mês</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Sessões agendadas</p>
                    <p className="text-2xl font-bold text-primary">{items.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Geradas por IA</p>
                    <p className="text-2xl font-bold text-primary">
                      {items.filter(i => i.is_ai_generated).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detalhes do Dia Selecionado */}
            <div className="lg:col-span-2">
              {selectedDate && (
                <DayScheduleDetail
                  date={selectedDate}
                  items={selectedDateItems}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )}
            </div>
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
