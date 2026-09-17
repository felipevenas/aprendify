import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pencil, Layers } from "lucide-react";
import { toast } from "sonner";
import AddFlashcardDialog from "./AddFlashcardDialog";
import { Flashcard } from "@/hooks/useFlashcards";
import { getSubjectById } from "@/lib/subjects";

/**
 * Lista todos os flashcards do usuário em formato de grid
 * Permite editar e excluir flashcards
 */
interface FlashcardsListProps {
  subjectFilter?: string;
}

const FlashcardsList = ({ subjectFilter = "all" }: FlashcardsListProps) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editFlashcard, setEditFlashcard] = useState<Flashcard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchFlashcards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("flashcards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (subjectFilter !== "all") {
        query = query.eq("subject_id", subjectFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setFlashcards(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar flashcards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlashcards();

    // Listener de realtime para atualizações
    const channel = supabase
      .channel("flashcards_list_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "flashcards",
        },
        () => {
          fetchFlashcards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [subjectFilter]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("flashcards")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Flashcard removido!");
    } catch (error: any) {
      toast.error("Erro ao remover flashcard");
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-12">
        <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground text-lg">Nenhum flashcard criado</p>
        <p className="text-muted-foreground text-sm mt-2">
          Clique em "Novo Flashcard" para começar
        </p>
      </div>
    );
  }

  return (
    <>
      <AddFlashcardDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditFlashcard(null);
        }}
        editFlashcard={editFlashcard}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flashcards.map((flashcard) => {
            const subject = flashcard.subject_id ? getSubjectById(flashcard.subject_id) : null;
            return (
            <div
              key={flashcard.id}
              className="p-4 rounded-lg border border-border bg-card hover:shadow-md transition-all group"
            >
              {/* Header com matéria e ações */}
              <div className="flex items-start justify-between mb-3">
                {subject ? (
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: subject.color,
                      color: subject.color,
                    }}
                  >
                    {subject.name}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Sem matéria</Badge>
                )}
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 opacity-100 sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
                  aria-label="Editar flashcard"
                  onClick={() => {
                    setEditFlashcard(flashcard);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 opacity-100 sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
                  aria-label="Excluir flashcard"
                  onClick={() => handleDelete(flashcard.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            {/* Conteúdo */}
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Frente:</p>
                <p className="text-sm font-medium line-clamp-2">{flashcard.front_content}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Verso:</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{flashcard.back_content}</p>
              </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default FlashcardsList;
