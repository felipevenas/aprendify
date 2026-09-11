import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Task } from "../types";
import { tasksService } from "../services/tasksService";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const data = await tasksService.getTasks(user.id);
      setTasks(data);
    } catch (error: any) {
      toast.error("Erro ao carregar tarefas");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleTask = useCallback(async (task: Task) => {
    try {
      await tasksService.toggleTaskCompleted(task.id, !task.completed);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t))
      );
      toast.success(task.completed ? "Tarefa reaberta" : "Tarefa concluída!");
    } catch (error: any) {
      toast.error("Erro ao atualizar tarefa");
    }
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      await tasksService.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success("Tarefa excluída com sucesso");
    } catch (error: any) {
      toast.error("Erro ao excluir tarefa");
    }
  }, []);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel("tasks_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    refetch: fetchTasks,
    toggleTask,
    deleteTask,
  };
}
