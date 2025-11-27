import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, CheckCircle2, Circle, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

interface Question {
  id: string;
  title: string;
  statement: string;
  answer: string | null;
  difficulty: string | null;
  question_type: string;
  solved: boolean;
  notes: string | null;
  subject_id: string | null;
  subjects?: {
    name: string;
    color: string;
  } | null;
  created_at: string;
}

const QuestionsList = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "concurso" | "vestibular">("all");

  // Busca as questões do usuário
  const fetchQuestions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("questions")
        .select(`
          *,
          subjects (
            name,
            color
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuestions(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar questões: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();

    // Configurar realtime para atualizações automáticas
    const channel = supabase
      .channel("questions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "questions",
        },
        () => {
          fetchQuestions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Marca/desmarca questão como resolvida
  const toggleSolved = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("questions")
        .update({ solved: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(currentStatus ? "Questão marcada como não resolvida" : "Questão marcada como resolvida!");
    } catch (error: any) {
      toast.error("Erro ao atualizar questão: " + error.message);
    }
  };

  // Deleta uma questão
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("questions").delete().eq("id", id);

      if (error) throw error;
      toast.success("Questão excluída com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao excluir questão: " + error.message);
    }
  };

  // Filtra questões baseado na aba selecionada
  const filteredQuestions = questions.filter((q) => {
    if (filter === "all") return true;
    return q.question_type === filter;
  });

  const difficultyColors = {
    easy: "bg-green-500/20 text-green-700 border-green-500",
    medium: "bg-yellow-500/20 text-yellow-700 border-yellow-500",
    hard: "bg-red-500/20 text-red-700 border-red-500",
  };

  const difficultyLabels = {
    easy: "Fácil",
    medium: "Médio",
    hard: "Difícil",
  };

  if (loading) {
    return <div className="text-center py-8">Carregando questões...</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="all" className="w-full" onValueChange={(value) => setFilter(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="concurso">Concursos</TabsTrigger>
          <TabsTrigger value="vestibular">Vestibulares</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-6">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                Nenhuma questão encontrada. Adicione sua primeira questão!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuestions.map((question) => (
                <div
                  key={question.id}
                  className="p-6 bg-card border border-border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      <Checkbox
                        checked={question.solved}
                        onCheckedChange={() => toggleSolved(question.id, question.solved)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-xl font-semibold text-foreground">
                            {question.title}
                          </h3>
                          <Badge variant="outline" className="capitalize">
                            {question.question_type}
                          </Badge>
                          {question.difficulty && (
                            <Badge className={difficultyColors[question.difficulty as keyof typeof difficultyColors]}>
                              {difficultyLabels[question.difficulty as keyof typeof difficultyLabels]}
                            </Badge>
                          )}
                          {question.subjects && (
                            <Badge
                              style={{
                                backgroundColor: `${question.subjects.color}20`,
                                color: question.subjects.color,
                                borderColor: question.subjects.color,
                              }}
                              className="border"
                            >
                              {question.subjects.name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground whitespace-pre-wrap mb-3">
                          {question.statement}
                        </p>
                        {question.answer && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-md">
                            <p className="text-sm font-medium mb-1">Resposta:</p>
                            <p className="text-sm text-muted-foreground">{question.answer}</p>
                          </div>
                        )}
                        {question.notes && (
                          <div className="mt-3 p-3 bg-accent/10 rounded-md">
                            <p className="text-sm font-medium mb-1">Observações:</p>
                            <p className="text-sm text-muted-foreground">{question.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(question.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Adicionada em{" "}
                    {new Date(question.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QuestionsList;
