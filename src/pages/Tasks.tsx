import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, CheckSquare } from "lucide-react";
import { motion } from "framer-motion";
import TaskList from "@/components/tasks/TaskList";
import AddTaskDialog from "@/components/tasks/AddTaskDialog";
import Navbar from "@/components/Navbar";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * Página de Tarefas
 * Permite criar, gerenciar e listar tarefas de estudo
 */
const Tasks = () => {
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  return (
    <PageLoader loading={loading} message="Preparando suas tarefas...">
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 app-layout-container">
        <Navbar />

        <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                  <CheckSquare className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    Minhas Tarefas
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Gerencie suas atividades, trabalhos e prazos
                  </p>
                </div>
              </div>
              
              {/* Ações discretas */}
              <div className="flex items-center gap-2" data-tour="tasks-header">
                <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Tarefa
                </Button>
              </div>
            </div>

            <Card className="shadow-lg border-border/50 p-6" data-tour="tasks-list">
              <TaskList />
            </Card>
          </motion.div>
        </main>

        <AddTaskDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    </PageLoader>
  );
};

export default Tasks;
