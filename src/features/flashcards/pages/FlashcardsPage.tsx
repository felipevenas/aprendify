import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Shuffle, Layers, List } from "lucide-react";
import FlashcardCard from "../components/FlashcardCard";
import FlashcardsList from "../components/FlashcardsList";
import AddFlashcardDialog from "../components/AddFlashcardDialog";
import { useFlashcards } from "../hooks/useFlashcards";
import { usePremium } from "@/hooks/usePremium";
import { PremiumModal } from "@/components/PremiumModal";
import { toast } from "sonner";
import { FIXED_SUBJECTS, FixedSubject } from "@/lib/subjects";
import { PageLoader } from "@/components/ui/page-loader";

export const FlashcardsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [activeTab, setActiveTab] = useState("practice");

  const { isPremium, isLoading: premiumLoading } = usePremium();
  const {
    currentFlashcard,
    flashcardCount,
    getRandomFlashcard,
    loading: flashcardsLoading,
  } = useFlashcards(subjectFilter);

  const FREE_LIMIT = 10;

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!flashcardsLoading && flashcardCount > 0 && !currentFlashcard) {
      getRandomFlashcard();
    }
  }, [flashcardsLoading, flashcardCount, currentFlashcard, getRandomFlashcard]);

  const handleOpenDialog = () => {
    if (!isPremium && flashcardCount >= FREE_LIMIT) {
      setShowPremiumModal(true);
      return;
    }
    setDialogOpen(true);
  };

  const handleShuffle = () => {
    if (flashcardCount === 0) {
      toast.info("Crie algum flashcard primeiro!");
      return;
    }
    getRandomFlashcard();
  };

  return (
    <div className="min-h-screen bg-background app-layout-container">
      <Navbar />

      <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageLoader loading={loading || premiumLoading} variant="cards">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                    Flashcards
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Memorize conceitos com repetição espaçada
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center" data-tour="flashcards-controls">
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filtrar por matéria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as matérias</SelectItem>
                    {FIXED_SUBJECTS.map((subject: FixedSubject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: subject.color }}
                          />
                          {subject.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={handleOpenDialog} size="sm" className="w-full gap-2 sm:w-auto">
                  <Plus className="h-4 w-4" />
                  Novo Flashcard
                </Button>
              </div>
            </div>
          </motion.div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="practice" className="gap-2">
                <Shuffle className="h-4 w-4" />
                Praticar
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                Gerenciar ({flashcardCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="practice" className="space-y-6">
              <AnimatePresence mode="wait">
                {currentFlashcard ? (
                  <motion.div
                    key={currentFlashcard.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FlashcardCard flashcard={currentFlashcard} onNext={handleShuffle} />
                  </motion.div>
                ) : (
                  <div className="text-center py-16">
                    <Layers className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      Nenhum flashcard disponível
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {subjectFilter !== "all"
                        ? "Nenhum flashcard encontrado para esta matéria."
                        : "Você ainda não criou nenhum flashcard."}
                    </p>
                    <Button onClick={handleOpenDialog} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Criar Primeiro Flashcard
                    </Button>
                  </div>
                )}
              </AnimatePresence>
            </TabsContent>

            <TabsContent value="list">
              <FlashcardsList subjectFilter={subjectFilter} />
            </TabsContent>
          </Tabs>

          <AddFlashcardDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            defaultSubjectId={subjectFilter !== "all" ? subjectFilter : undefined}
          />

          <PremiumModal
            open={showPremiumModal}
            onOpenChange={setShowPremiumModal}
            title="Limite de flashcards atingido"
            description={`No plano gratuito você pode criar até ${FREE_LIMIT} flashcards. Assine o plano Premium para criar flashcards ilimitados e turbinar seus estudos.`}
          />
        </PageLoader>
        </main>
      </div>
  );
};

export default FlashcardsPage;
