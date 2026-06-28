import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, StickyNote } from "lucide-react";
import { motion } from "framer-motion";
import NotesList from "@/components/notes/NotesList";
import AddNoteDialog from "@/components/notes/AddNoteDialog";
import Navbar from "@/components/Navbar";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * Página de Anotações
 * Agora usa matérias fixas do sistema - não precisa mais verificar se usuário tem matérias cadastradas
 */
const Notes = () => {
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
    <PageLoader loading={loading} message="Preparando suas anotações...">
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
                  <StickyNote className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    Minhas Anotações
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Organize suas anotações por matéria
                  </p>
                </div>
              </div>
              
              {/* Ações discretas */}
              <div className="flex items-center gap-2" data-tour="notes-header">
                <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Anotação
                </Button>
              </div>
            </div>

            <Card className="shadow-lg border-border/50 p-6" data-tour="notes-list">
              <NotesList />
            </Card>
          </motion.div>
        </main>

        <AddNoteDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    </PageLoader>
  );
};

export default Notes;
