import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { FIXED_SUBJECTS, FixedSubject, getSubjectById } from "@/lib/subjects";

/**
 * Diálogo para adicionar ou editar anotações
 * Utiliza matérias fixas do sistema ao invés de matérias customizadas do usuário
 */

interface Note {
  id: string;
  title: string;
  content: string;
  subject_id: string;
}

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editNote?: Note | null;
}

const AddNoteDialog = ({ open, onOpenChange, editNote }: AddNoteDialogProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [loading, setLoading] = useState(false);

  // Preenche campos ao editar uma anotação existente
  useEffect(() => {
    if (open) {
      if (editNote) {
        setTitle(editNote.title);
        setContent(editNote.content);
        setSubjectId(editNote.subject_id);
      } else {
        resetForm();
      }
    }
  }, [open, editNote]);

  // Salva ou atualiza a anotação no banco
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim() || !subjectId) {
      toast.error("Preencha todos os campos!");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const noteData = {
        subject_id: subjectId, // Armazena o slug da matéria fixa
        title: title.trim(),
        content: content.trim(),
      };

      if (editNote) {
        // Atualiza anotação existente
        const { error } = await supabase
          .from("notes")
          .update(noteData)
          .eq("id", editNote.id);

        if (error) throw error;
        toast.success("Anotação atualizada com sucesso!");
      } else {
        // Cria nova anotação
        const { error } = await supabase.from("notes").insert({
          ...noteData,
          user_id: user.id,
        });

        if (error) throw error;
        toast.success("Anotação criada com sucesso!");
      }

      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Erro ao ${editNote ? "atualizar" : "criar"} anotação: ` + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setSubjectId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editNote ? "Editar Anotação" : "Nova Anotação"}</DialogTitle>
          <DialogDescription>
            {editNote ? "Edite sua anotação" : "Crie uma anotação e organize por matéria"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seleção de matéria fixa do sistema */}
          <div className="space-y-2">
            <Label htmlFor="subject">Matéria *</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma matéria" />
              </SelectTrigger>
              <SelectContent>
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
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Ex: Fórmulas importantes"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Conteúdo *</Label>
            <Textarea
              id="content"
              placeholder="Digite suas anotações aqui..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={loading}
              rows={8}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : editNote ? "Atualizar anotação" : "Salvar anotação"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddNoteDialog;
