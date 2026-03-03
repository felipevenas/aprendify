import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus } from "lucide-react";
import { motion } from "framer-motion";
import NotesList from "@/components/notes/NotesList";
import AddNoteDialog from "@/components/notes/AddNoteDialog";
import Navbar from "@/components/Navbar";

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
                Minhas Anotações
              </h1>
              <p className="text-muted-foreground text-lg">
                Organize suas anotações por matéria
              </p>
            </div>
            
            {/* Ações discretas */}
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/dashboard")} 
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Voltar</span>
              </Button>
              <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Anotação
              </Button>
            </div>
          </div>

          <Card className="shadow-lg border-border/50 p-6">
            <NotesList />
          </Card>
        </motion.div>
      </main>

      <AddNoteDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};

export default Notes;
