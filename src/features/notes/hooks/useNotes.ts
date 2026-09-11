import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Note } from "../types";
import { notesService } from "../services/notesService";

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const data = await notesService.getNotes(user.id);
      setNotes(data);
    } catch (error: any) {
      toast.error("Erro ao carregar anotações: " + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteNote = useCallback(async (noteId: string) => {
    try {
      await notesService.deleteNote(noteId);
      toast.success("Anotação excluída com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao excluir anotação: " + error.message);
    }
  }, []);

  useEffect(() => {
    fetchNotes();

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
  }, [fetchNotes]);

  return {
    notes,
    loading,
    refetch: fetchNotes,
    deleteNote,
  };
}
