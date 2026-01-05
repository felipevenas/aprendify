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
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FIXED_SUBJECTS, FixedSubject } from "@/lib/subjects";

/**
 * Dialog para adicionar ou editar questões personalizadas
 * Utiliza matérias fixas do sistema
 */

interface Question {
  id: string;
  title: string;
  statement: string;
  answer?: string;
  difficulty?: string;
  question_type: string;
  subject_id?: string;
  notes?: string;
}

interface AddQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editQuestion?: Question | null;
}

const AddQuestionDialog = ({ open, onOpenChange, editQuestion }: AddQuestionDialogProps) => {
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [answer, setAnswer] = useState("");
  const [notes, setNotes] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [questionType, setQuestionType] = useState<"concurso" | "vestibular">("concurso");
  const [subjectId, setSubjectId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Preenche campos ao editar
  useEffect(() => {
    if (open) {
      if (editQuestion) {
        setTitle(editQuestion.title);
        setStatement(editQuestion.statement);
        setAnswer(editQuestion.answer || "");
        setDifficulty(editQuestion.difficulty || "medium");
        setQuestionType(editQuestion.question_type as "concurso" | "vestibular");
        setSubjectId(editQuestion.subject_id || "");
        setNotes(editQuestion.notes || "");
      } else {
        resetForm();
      }
    }
  }, [open, editQuestion]);

  // Salva ou atualiza a questão no banco
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !statement.trim()) {
      toast.error("Preencha pelo menos o título e o enunciado!");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const questionData = {
        title: title.trim(),
        statement: statement.trim(),
        answer: answer.trim() || null,
        difficulty: difficulty || null,
        question_type: questionType,
        subject_id: subjectId || null, // Armazena o slug da matéria fixa
        notes: notes.trim() || null,
      };

      if (editQuestion) {
        // Atualiza questão existente
        const { error } = await supabase
          .from("questions")
          .update(questionData)
          .eq("id", editQuestion.id);

        if (error) throw error;
        toast.success("Questão atualizada com sucesso!");
      } else {
        // Cria nova questão
        const { error } = await supabase.from("questions").insert({
          ...questionData,
          user_id: user.id,
          solved: false,
        });

        if (error) throw error;
        toast.success("Questão criada com sucesso!");
      }

      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Erro ao ${editQuestion ? "atualizar" : "criar"} questão: ` + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setStatement("");
    setAnswer("");
    setNotes("");
    setDifficulty("medium");
    setQuestionType("concurso");
    setSubjectId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 flex-shrink-0">
          <DialogTitle>{editQuestion ? "Editar Questão" : "Nova Questão"}</DialogTitle>
          <DialogDescription>
            {editQuestion ? "Edite sua questão" : "Adicione uma questão de concurso ou vestibular para praticar"}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="space-y-2">
            <Label>Tipo de Questão *</Label>
            <RadioGroup value={questionType} onValueChange={(value) => setQuestionType(value as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="concurso" id="concurso" />
                <Label htmlFor="concurso" className="font-normal cursor-pointer">
                  Concurso
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="vestibular" id="vestibular" />
                <Label htmlFor="vestibular" className="font-normal cursor-pointer">
                  Vestibular
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Ex: Questão de Física - ENEM 2023"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
            />
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
            <Label htmlFor="difficulty">Dificuldade</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Fácil</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="hard">Difícil</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="statement">Enunciado *</Label>
            <Textarea
              id="statement"
              placeholder="Digite o enunciado da questão..."
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              disabled={loading}
              rows={6}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="answer">Resposta (opcional)</Label>
            <Textarea
              id="answer"
              placeholder="Digite a resposta ou gabarito..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={loading}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Anotações sobre a questão, dicas, etc..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-border/50 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Salvando..." : editQuestion ? "Atualizar questão" : "Adicionar questão"}
            </Button>
          </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default AddQuestionDialog;
