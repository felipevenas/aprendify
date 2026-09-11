import { supabase } from "@/integrations/supabase/client";
import { Flashcard, FlashcardFormData } from "../types";

export const flashcardService = {
  async getFlashcards(userId: string, subjectFilter?: string): Promise<Flashcard[]> {
    let query = supabase
      .from("flashcards")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (subjectFilter && subjectFilter !== "all") {
      query = query.eq("subject_id", subjectFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Flashcard[];
  },

  async createFlashcard(userId: string, formData: FlashcardFormData): Promise<void> {
    const { error } = await supabase.from("flashcards").insert({
      user_id: userId,
      front_content: formData.front_content,
      back_content: formData.back_content,
      subject_id: formData.subject_id || null,
    });

    if (error) throw error;
  },

  async deleteFlashcard(flashcardId: string): Promise<void> {
    const { error } = await supabase.from("flashcards").delete().eq("id", flashcardId);
    if (error) throw error;
  },
};
