import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddScheduleDialog from "./AddScheduleDialog";
import { getSubjectById } from "@/lib/subjects";

interface ScheduleItem {
  id: string;
  title: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  notes?: string;
  subject_id?: string | null;
}

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const ScheduleGrid = () => {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<ScheduleItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchSchedule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("schedule_items")
        .select("*")
        .eq("user_id", user.id)
        .order("day_of_week")
        .order("start_time");

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar cronograma");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();

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

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("schedule_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Horário removido!");
    } catch (error: any) {
      toast.error("Erro ao remover horário");
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <>
      <AddScheduleDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditItem(null);
        }}
        editItem={editItem}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {DAYS.slice(1, 6).map((day, index) => {
        const dayItems = items.filter((item) => item.day_of_week === index + 1);
        
        return (
          <div key={day} className="space-y-2">
            <h3 className="font-semibold text-lg text-primary border-b border-border pb-2">
              {day}
            </h3>
            {dayItems.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4">Sem atividades</p>
            ) : (
              <div className="space-y-2">
                {dayItems.map((item) => {
                  const subject = item.subject_id ? getSubjectById(item.subject_id) : null;
                  return (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-border bg-card hover:shadow-md transition-shadow group"
                    style={{
                      borderLeftWidth: "4px",
                      borderLeftColor: subject?.color || "#3B82F6",
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-sm">{item.title}</h4>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            setEditItem(item);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {subject && (
                      <p className="text-xs text-muted-foreground mb-1">
                        {subject.name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {item.start_time.substring(0, 5)} - {item.end_time.substring(0, 5)}
                    </p>
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {item.notes}
                      </p>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </>
  );
};

export default ScheduleGrid;
