export interface Flashcard {
  id: string;
  front_content: string;
  back_content: string;
  subject_id?: string | null;
  created_at: string;
  user_id?: string;
}

export interface FlashcardFormData {
  front_content: string;
  back_content: string;
  subject_id?: string | null;
}
