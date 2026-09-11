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
import { Task } from "../types";
import { tasksService } from "../services/tasksService";

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTask?: Task | null;
  onSuccess?: () => void;
}

export const AddTaskDialog = ({ open, onOpenChange, editTask, onSuccess }: AddTaskDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editTask) {
        setTitle(editTask.title);
        setDescription(editTask.description || "");
        setDueDate(editTask.due_date || "");
        setPriority(editTask.priority || "");
        setSubjectId(editTask.subject_id || "");
      } else {
        resetForm();
      }
    }
  }, [open, editTask]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("");
    setSubjectId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const taskData = {
        title,
        description: description || undefined,
        due_date: dueDate || undefined,
        priority: priority || undefined,
        subject_id: subjectId || undefined,
      };

      if (editTask) {
        await tasksService.updateTask(editTask.id, taskData);
        toast.success("Tarefa atualizada!");
      } else {
        await tasksService.createTask(user.id, taskData);
        toast.success("Tarefa adicionada!");
      }

      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || `Erro ao ${editTask ? "atualizar" : "adicionar"} tarefa`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Fazer trabalho de história"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione detalhes sobre a tarefa..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Data de entrega (opcional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : editTask ? "Atualizar" : "Adicionar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddTaskDialog;
