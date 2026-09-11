import { supabase } from "@/integrations/supabase/client";
import { Note, NoteFormData } from "../types";

export const notesService = {
  async getNotes(userId: string): Promise<Note[]> {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createNote(userId: string, formData: NoteFormData): Promise<void> {
    const { error } = await supabase.from("notes").insert([
      {
        title: formData.title,
        content: formData.content,
        subject_id: formData.subject_id,
        user_id: userId,
      },
    ]);

    if (error) throw error;
  },

  async updateNote(noteId: string, formData: NoteFormData): Promise<void> {
    const { error } = await supabase
      .from("notes")
      .update({
        title: formData.title,
        content: formData.content,
        subject_id: formData.subject_id,
      })
      .eq("id", noteId);

    if (error) throw error;
  },

  async deleteNote(noteId: string): Promise<void> {
    const { error } = await supabase.from("notes").delete().eq("id", noteId);
    if (error) throw error;
  },
};
