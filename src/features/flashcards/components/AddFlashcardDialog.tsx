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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Flashcard } from "@/hooks/useFlashcards";
import { FIXED_SUBJECTS, FixedSubject } from "@/lib/subjects";

interface AddFlashcardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editFlashcard?: Flashcard | null;
  defaultSubjectId?: string;
}

/**
 * Dialog para adicionar ou editar flashcards
 * Campos: frente (pergunta), verso (resposta), matéria (fixa do sistema)
 */
const AddFlashcardDialog = ({ open, onOpenChange, editFlashcard, defaultSubjectId }: AddFlashcardDialogProps) => {
  const [frontContent, setFrontContent] = useState("");
  const [backContent, setBackContent] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Preenche os campos se estiver editando
      if (editFlashcard) {
        setFrontContent(editFlashcard.front_content);
        setBackContent(editFlashcard.back_content);
        setSubjectId(editFlashcard.subject_id || "");
      } else {
        resetForm(defaultSubjectId);
      }
    }
  }, [open, editFlashcard, defaultSubjectId]);

  const resetForm = (initialSubjectId = "") => {
    setFrontContent("");
    setBackContent("");
    setSubjectId(initialSubjectId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const flashcardData = {
        user_id: user.id,
        front_content: frontContent.trim(),
        back_content: backContent.trim(),
        subject_id: subjectId || null, // Armazena o slug da matéria fixa
      };

      if (editFlashcard) {
        // Atualiza flashcard existente
        const { error } = await supabase
          .from("flashcards")
          .update(flashcardData)
          .eq("id", editFlashcard.id);

        if (error) throw error;
        toast.success("Flashcard atualizado!");
      } else {
        // Cria novo flashcard
        const { error } = await supabase
          .from("flashcards")
          .insert(flashcardData);

        if (error) throw error;
        toast.success("Flashcard criado!");
      }

      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar flashcard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editFlashcard ? "Editar Flashcard" : "Novo Flashcard"}
          </DialogTitle>
          <DialogDescription>
            {editFlashcard
              ? "Atualize o conteúdo do seu flashcard"
              : "Crie um novo cartão de estudo com pergunta e resposta"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Frente do cartão (Pergunta) */}
          <div className="space-y-2">
            <Label htmlFor="front">Frente (Pergunta)</Label>
            <Textarea
              id="front"
              placeholder="Digite a pergunta ou conceito..."
              value={frontContent}
              onChange={(e) => setFrontContent(e.target.value)}
              required
              disabled={loading}
              className="min-h-[100px] resize-none"
            />
          </div>

          {/* Verso do cartão (Resposta) */}
          <div className="space-y-2">
            <Label htmlFor="back">Verso (Resposta)</Label>
            <Textarea
              id="back"
              placeholder="Digite a resposta ou explicação..."
              value={backContent}
              onChange={(e) => setBackContent(e.target.value)}
              required
              disabled={loading}
              className="min-h-[100px] resize-none"
            />
          </div>

          {/* Seleção de matéria fixa do sistema */}
          <div className="space-y-2">
            <Label htmlFor="subject">Matéria (opcional)</Label>
            <Select 
              value={subjectId || "none"} 
              onValueChange={(val) => setSubjectId(val === "none" ? "" : val)}
            >
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

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : editFlashcard ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFlashcardDialog;
