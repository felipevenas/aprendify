import { useState } from "react";
import { Trash2, BookOpen, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSubjectById } from "@/lib/subjects";
import { Note } from "../types";
import { useNotes } from "../hooks/useNotes";
import AddNoteDialog from "./AddNoteDialog";

export const NotesList = () => {
  const { notes, loading, deleteNote, refetch } = useNotes();
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
        onSuccess={refetch}
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
                        borderColor: subjectInfo.color,
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
                    onClick={() => deleteNote(note.id)}
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
