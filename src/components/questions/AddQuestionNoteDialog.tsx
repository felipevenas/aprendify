import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, StickyNote } from "lucide-react";

/**
 * Diálogo para adicionar anotação a partir de uma questão do banco de questões
 * O usuário pode salvar observações feitas durante a resolução de questões
 */
interface AddQuestionNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionContext?: {
    year: string;
    discipline: string;
    index: number;
    context?: string;
  };
}

interface Subject {
  id: string;
  name: string;
  color: string;
}

const AddQuestionNoteDialog = ({ open, onOpenChange, questionContext }: AddQuestionNoteDialogProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Carrega matérias do usuário ao abrir o diálogo
  useEffect(() => {
    if (open) {
      fetchSubjects();
      
      // Preenche título automaticamente com contexto da questão
      if (questionContext) {
        const autoTitle = `ENEM ${questionContext.year} - Questão ${questionContext.index}`;
        setTitle(autoTitle);
      }
    }
  }, [open, questionContext]);

  // Busca matérias do usuário
  const fetchSubjects = async () => {
    setLoadingSubjects(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, color")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setSubjects(data || []);
      
      // Se houver disciplina na questão, tenta encontrar matéria correspondente
      if (questionContext?.discipline && data) {
        const normalizedDiscipline = questionContext.discipline.toLowerCase();
        const matchingSubject = data.find(s => 
          normalizedDiscipline.includes(s.name.toLowerCase()) ||
          s.name.toLowerCase().includes(normalizedDiscipline.split("-")[0])
        );
        if (matchingSubject) {
          setSubjectId(matchingSubject.id);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar matérias:", error);
    } finally {
      setLoadingSubjects(false);
    }
  };

  // Salva a anotação no banco de dados
  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !subjectId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para salvar a anotação.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          subject_id: subjectId,
          title: title.trim(),
          content: content.trim(),
        });

      if (error) throw error;

      toast({
        title: "Anotação salva!",
        description: "Sua anotação foi salva com sucesso. Acesse a página de Anotações para revisar.",
      });

      // Limpa o formulário e fecha o diálogo
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar anotação:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar a anotação.",
        variant: "destructive",
      });
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            Adicionar Anotação
          </DialogTitle>
          <DialogDescription>
            Anote algo importante que você aprendeu nesta questão. 
            Você poderá acessar suas anotações na página de Anotações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Seleção de matéria */}
          <div className="space-y-2">
            <Label htmlFor="subject">Matéria *</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger id="subject" disabled={loadingSubjects}>
                <SelectValue placeholder={loadingSubjects ? "Carregando..." : "Selecione a matéria"} />
              </SelectTrigger>
              <SelectContent>
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
            {subjects.length === 0 && !loadingSubjects && (
              <p className="text-xs text-muted-foreground">
                Você ainda não tem matérias cadastradas. Adicione uma na página de Matérias.
              </p>
            )}
          </div>

          {/* Título da anotação */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Ex: Regra de três composta"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Conteúdo da anotação */}
          <div className="space-y-2">
            <Label htmlFor="content">Anotação *</Label>
            <Textarea
              id="content"
              placeholder="Escreva aqui o que você aprendeu ou quer lembrar..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2 mt-6">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !title.trim() || !content.trim() || !subjectId}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Anotação"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddQuestionNoteDialog;
