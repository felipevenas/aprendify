import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Note {
  id: string;
  title: string;
  content: string;
  subject_id: string;
  subjects: {
    name: string;
    color: string;
  };
  created_at: string;
}

const NotesList = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Busca as anotações do usuário com dados da matéria
  const fetchNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notes")
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
      setNotes(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar anotações: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();

    // Configurar realtime para atualizações automáticas
    const channel = supabase
      .channel("notes-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
        },
        () => {
          fetchNotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Deleta uma anotação
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("notes").delete().eq("id", id);

      if (error) throw error;
      toast.success("Anotação excluída com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao excluir anotação: " + error.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando anotações...</div>;
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground text-lg">
          Nenhuma anotação encontrada. Crie sua primeira anotação!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <div
          key={note.id}
          className="p-6 bg-card border border-border rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-semibold text-foreground">{note.title}</h3>
                <Badge 
                  style={{ 
                    backgroundColor: `${note.subjects.color}20`,
                    color: note.subjects.color,
                    borderColor: note.subjects.color
                  }}
                  className="border"
                >
                  {note.subjects.name}
                </Badge>
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap">{note.content}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(note.id)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(note.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      ))}
    </div>
  );
};

export default NotesList;
