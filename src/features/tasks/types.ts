export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  completed: boolean;
  priority?: string;
  subject_id?: string | null;
  created_at?: string;
}

export interface TaskFormData {
  title: string;
  description?: string;
  due_date?: string;
  priority?: string;
  subject_id?: string;
}
