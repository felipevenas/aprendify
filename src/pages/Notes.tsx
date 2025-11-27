import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import NotesList from "@/components/notes/NotesList";
import AddNoteDialog from "@/components/notes/AddNoteDialog";

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-primary text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <nav className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <div className="flex items-center">
                <BookOpen className="h-8 w-8 text-primary mr-2" />
                <span className="text-2xl font-bold text-primary">StudyFlow</span>
              </div>
            </div>
            <Button onClick={handleAddNote} className="gap-2" disabled={!hasSubjects}>
              <Plus className="h-4 w-4" />
              Nova anotação
            </Button>
          </div>
        </div>
      </nav>

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
