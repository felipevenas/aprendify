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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface AddQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

const AddQuestionDialog = ({ open, onOpenChange }: AddQuestionDialogProps) => {
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [answer, setAnswer] = useState("");
  const [notes, setNotes] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [questionType, setQuestionType] = useState<"concurso" | "vestibular">("concurso");
  const [subjectId, setSubjectId] = useState<string>("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);

  // Carrega as matérias disponíveis
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("subjects")
          .select("*")
          .eq("user_id", user.id)
          .order("name");

        if (error) throw error;
        setSubjects(data || []);
      } catch (error: any) {
        toast.error("Erro ao carregar matérias: " + error.message);
      }
    };

    if (open) {
      fetchSubjects();
    }
  }, [open]);

  // Salva a nova questão no banco
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

      const { error } = await supabase.from("questions").insert({
        user_id: user.id,
        subject_id: subjectId || null,
        title: title.trim(),
        statement: statement.trim(),
        answer: answer.trim() || null,
        notes: notes.trim() || null,
        difficulty,
        question_type: questionType,
        solved: false,
      });

      if (error) throw error;

      toast.success("Questão adicionada com sucesso!");
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao adicionar questão: " + error.message);
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Questão</DialogTitle>
          <DialogDescription>
            Adicione uma questão de concurso ou vestibular para praticar
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor="subject">Matéria (opcional)</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma matéria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sem matéria</SelectItem>
                {subjects.map((subject) => (
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
              {loading ? "Salvando..." : "Adicionar questão"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddQuestionDialog;
