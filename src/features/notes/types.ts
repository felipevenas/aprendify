export interface Note {
  id: string;
  title: string;
  content: string;
  subject_id: string;
  created_at: string;
}

export interface NoteFormData {
  title: string;
  content: string;
  subject_id: string;
}
