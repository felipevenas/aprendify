import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import NotesList from "@/components/notes/NotesList";
import AddNoteDialog from "@/components/notes/AddNoteDialog";
import Navbar from "@/components/Navbar";

const Notes = () => {
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasSubjects, setHasSubjects] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Verifica se o usuário tem matérias cadastradas (regra de negócio)
      const { data: subjects } = await supabase
        .from("subjects")
        .select("id")
        .eq("user_id", session.user.id)
        .limit(1);

      setHasSubjects(!!subjects && subjects.length > 0);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleAddNote = () => {
    if (!hasSubjects) {
      toast.error("Você precisa cadastrar matérias antes de criar anotações!");
      return;
    }
    setDialogOpen(true);
  };

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
      
      {/* Barra de ações */}
      <div className="bg-card/80 backdrop-blur-md border-b border-border shadow-sm sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/dashboard")} 
              className="gap-2 hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <Button onClick={handleAddNote} className="gap-2" disabled={!hasSubjects}>
              <Plus className="h-4 w-4" />
              Nova Anotação
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Minhas Anotações
            </h1>
            <p className="text-muted-foreground text-lg">
              Organize suas anotações por matéria
            </p>
            {!hasSubjects && (
              <div className="mt-4 p-4 bg-accent/10 border border-accent rounded-lg">
                <p className="text-accent font-medium">
                  Você precisa cadastrar matérias antes de criar anotações!
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => navigate("/subjects")} 
                  className="mt-2"
                >
                  Cadastrar matérias
                </Button>
              </div>
            )}
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
