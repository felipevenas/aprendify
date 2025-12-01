import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus } from "lucide-react";
import { motion } from "framer-motion";
import ScheduleGrid from "@/components/schedule/ScheduleGrid";
import AddScheduleDialog from "@/components/schedule/AddScheduleDialog";
import Navbar from "@/components/Navbar";

const Schedule = () => {
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

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2">
                Cronograma Semanal
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
                Organize suas aulas e sessões de estudo durante a semana
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
                Novo Item
              </Button>
            </div>
          </div>

          <Card className="shadow-lg border-border/50">
            <CardHeader>
              <CardTitle>Horários da Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <ScheduleGrid />
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <AddScheduleDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};

export default Schedule;
