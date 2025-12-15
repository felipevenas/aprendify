import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  subject_id?: string;
}

interface AddScheduleItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: ScheduleItem | null;
  selectedDate?: Date | null;
}

interface Subject {
  id: string;
  name: string;
}

const PRIORITIES = [
  { value: "normal", label: "Normal" },
  { value: "média", label: "Média" },
  { value: "alta", label: "Alta" },
];

const AddScheduleItemDialog = ({ open, onOpenChange, editItem, selectedDate }: AddScheduleItemDialogProps) => {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [topic, setTopic] = useState("");
  const [activities, setActivities] = useState("");
  const [studyTips, setStudyTips] = useState("");
  const [priority, setPriority] = useState("normal");
  const [subjectId, setSubjectId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchSubjects();
      
      if (editItem) {
        setTitle(editItem.title);
        setDate(new Date(editItem.scheduled_date + "T12:00:00"));
        setStartTime(editItem.start_time.substring(0, 5));
        setEndTime(editItem.end_time.substring(0, 5));
        setTopic(editItem.topic || "");
        setActivities(editItem.activities || "");
        setStudyTips(editItem.study_tips || "");
        setPriority(editItem.priority || "normal");
        setSubjectId(editItem.subject_id || "");
      } else {
        resetForm();
        if (selectedDate) {
          setDate(selectedDate);
        }
      }
    }
  }, [open, editItem, selectedDate]);

  const fetchSubjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("user_id", user.id);

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      toast.error("Erro ao carregar matérias");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date) {
      toast.error("Selecione uma data");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const scheduledDate = format(date, "yyyy-MM-dd");
      const dayOfWeek = date.getDay();

      // Calcular duração estimada
      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);
      const estimatedDuration = (endH * 60 + endM) - (startH * 60 + startM);

      const scheduleData = {
        title,
        scheduled_date: scheduledDate,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        topic: topic || null,
        activities: activities || null,
        study_tips: studyTips || null,
        priority,
        estimated_duration: estimatedDuration > 0 ? estimatedDuration : 60,
        subject_id: subjectId || null,
        is_ai_generated: false,
      };

      if (editItem) {
        const { error } = await supabase
          .from("schedule_items")
          .update(scheduleData)
          .eq("id", editItem.id);

        if (error) throw error;
        toast.success("Sessão atualizada!");
      } else {
        const { error } = await supabase.from("schedule_items").insert({
          ...scheduleData,
          user_id: user.id,
        });

        if (error) throw error;
        toast.success("Sessão adicionada!");
      }

      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || `Erro ao ${editItem ? "atualizar" : "adicionar"} sessão`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDate(undefined);
    setStartTime("");
    setEndTime("");
    setTopic("");
    setActivities("");
    setStudyTips("");
    setPriority("normal");
    setSubjectId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Sessão de Estudo" : "Nova Sessão de Estudo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Física - Cinemática"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Início</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Fim</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topic">Tópico Específico</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: MRU e MRUV"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Matéria (opcional)</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma matéria" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="activities">Atividades</Label>
            <Textarea
              id="activities"
              value={activities}
              onChange={(e) => setActivities(e.target.value)}
              placeholder="Descreva as atividades planejadas..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="studyTips">Dicas de Estudo</Label>
            <Textarea
              id="studyTips"
              value={studyTips}
              onChange={(e) => setStudyTips(e.target.value)}
              placeholder="Adicione dicas ou observações..."
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : editItem ? "Atualizar" : "Adicionar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddScheduleItemDialog;
