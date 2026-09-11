import { supabase } from "@/integrations/supabase/client";
import { Task, TaskFormData } from "../types";

export const tasksService = {
  async getTasks(userId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("completed")
      .order("due_date", { nullsFirst: false });

    if (error) throw error;
    return data || [];
  },

  async createTask(userId: string, formData: TaskFormData): Promise<void> {
    const { error } = await supabase.from("tasks").insert([
      {
        title: formData.title,
        description: formData.description || null,
        due_date: formData.due_date || null,
        priority: formData.priority || "medium",
        subject_id: formData.subject_id || null,
        user_id: userId,
        completed: false,
      },
    ]);

    if (error) throw error;
  },

  async updateTask(taskId: string, formData: Partial<TaskFormData>): Promise<void> {
    const { error } = await supabase
      .from("tasks")
      .update(formData)
      .eq("id", taskId);

    if (error) throw error;
  },

  async toggleTaskCompleted(taskId: string, completed: boolean): Promise<void> {
    const { error } = await supabase
      .from("tasks")
      .update({ completed })
      .eq("id", taskId);

    if (error) throw error;
  },

  async deleteTask(taskId: string): Promise<void> {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) throw error;
  },
};
