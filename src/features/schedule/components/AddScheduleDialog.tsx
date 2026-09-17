import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { FIXED_SUBJECTS, FixedSubject } from "@/lib/subjects";

/**
 * Dialog para adicionar ou editar horários do cronograma semanal
 * Utiliza matérias fixas do sistema
 */

interface ScheduleItem {
  id: string;
  title: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  notes?: string;
  subject_id?: string;
}

interface AddScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: ScheduleItem | null;
}

const DAYS = [
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
];

const AddScheduleDialog = ({ open, onOpenChange, editItem }: AddScheduleDialogProps) => {
  const [title, setTitle] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Preenche os campos se estiver editando
      if (editItem) {
        setTitle(editItem.title);
        setDayOfWeek(editItem.day_of_week.toString());
        setStartTime(editItem.start_time);
        setEndTime(editItem.end_time);
        setSubjectId(editItem.subject_id || "");
        setNotes(editItem.notes || "");
      } else {
        resetForm();
      }
    }
  }, [open, editItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const scheduleData = {
        title,
        day_of_week: parseInt(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        subject_id: subjectId || null, // Armazena o slug da matéria fixa
        notes: notes || null,
      };

      if (editItem) {
        // Atualiza item existente
        const { error } = await supabase
          .from("schedule_items")
          .update(scheduleData)
          .eq("id", editItem.id);

        if (error) throw error;
        toast.success("Horário atualizado!");
      } else {
        // Cria novo item
        const { error } = await supabase.from("schedule_items").insert({
          ...scheduleData,
          user_id: user.id,
        });

        if (error) throw error;
        toast.success("Horário adicionado!");
      }

      onOpenChange(false);
      resetForm();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : `Erro ao ${editItem ? "atualizar" : "adicionar"} horário`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDayOfWeek("");
    setStartTime("");
    setEndTime("");
    setSubjectId("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Horário" : "Adicionar Horário"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Aula de Matemática"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="day">Dia da Semana</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o dia" />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day) => (
                  <SelectItem key={day.value} value={day.value}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {/* Seleção de matéria fixa do sistema */}
          <div className="space-y-2">
            <Label htmlFor="subject">Matéria (opcional)</Label>
            <Select value={subjectId || "none"} onValueChange={(val) => setSubjectId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma matéria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem matéria</SelectItem>
                {FIXED_SUBJECTS.map((subject: FixedSubject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: subject.color }}
                      />
                      {subject.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações..."
              rows={3}
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

export default AddScheduleDialog;
