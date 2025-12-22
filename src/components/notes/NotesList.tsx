import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, BookOpen, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AddNoteDialog from "./AddNoteDialog";
import { getSubjectById, FixedSubject } from "@/lib/subjects";

/**
 * Lista de anotações do usuário
 * Agora utiliza matérias fixas do sistema ao invés de buscar do banco
 */

interface Note {
  id: string;
  title: string;
  content: string;
  subject_id: string; // Agora armazena o slug da matéria fixa
  created_at: string;
}

const NotesList = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Busca as anotações do usuário (sem join com subjects)
  const fetchNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notes")
        .select("*")
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

  // Obtém dados da matéria fixa pelo subject_id
  const getSubjectInfo = (subjectId: string): { name: string; color: string } => {
    const subject = getSubjectById(subjectId);
    return subject 
      ? { name: subject.name, color: subject.color }
      : { name: "Geral", color: "#6B7280" };
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
    <>
      <AddNoteDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditNote(null);
        }}
        editNote={editNote}
      />
      <div className="space-y-4">
      {notes.map((note) => {
        const subjectInfo = getSubjectInfo(note.subject_id);
        
        return (
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
                      backgroundColor: `${subjectInfo.color}20`,
                      color: subjectInfo.color,
                      borderColor: subjectInfo.color
                    }}
                    className="border"
                  >
                    {subjectInfo.name}
                  </Badge>
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap">{note.content}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditNote(note);
                    setDialogOpen(true);
                  }}
                  className="hover:bg-accent"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(note.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
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
        );
      })}
      </div>
    </>
  );
};

export default NotesList;
