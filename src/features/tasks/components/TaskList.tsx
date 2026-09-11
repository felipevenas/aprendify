import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getSubjectById } from "@/lib/subjects";
import { Task } from "../types";
import { useTasks } from "../hooks/useTasks";
import AddTaskDialog from "./AddTaskDialog";

export const TaskList = () => {
  const { tasks, loading, toggleTask, deleteTask, refetch } = useTasks();
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-accent text-accent-foreground";
      case "low":
        return "bg-secondary text-secondary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case "high":
        return "Alta";
      case "medium":
        return "Média";
      case "low":
        return "Baixa";
      default:
        return "Sem prioridade";
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">Nenhuma tarefa cadastrada</p>
        <p className="text-muted-foreground text-sm mt-2">
          Clique em "Nova tarefa" para começar
        </p>
      </div>
    );
  }

  return (
    <>
      <AddTaskDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditTask(null);
        }}
        editTask={editTask}
        onSuccess={refetch}
      />
      <div className="space-y-3">
        {tasks.map((task) => {
          const subject = task.subject_id ? getSubjectById(task.subject_id) : null;
          return (
            <div
              key={task.id}
              className={`p-4 rounded-lg border border-border bg-card hover:shadow-md transition-all group ${
                task.completed ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => toggleTask(task)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className={`font-medium ${
                        task.completed ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {task.title}
                    </h3>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setEditTask(task);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteTask(task.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-2">
                    {subject && (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: subject.color,
                          color: subject.color,
                        }}
                      >
                        {subject.name}
                      </Badge>
                    )}

                    {task.priority && (
                      <Badge className={getPriorityColor(task.priority)}>
                        {getPriorityLabel(task.priority)}
                      </Badge>
                    )}

                    {task.due_date && (
                      <Badge variant="secondary">
                        {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default TaskList;
