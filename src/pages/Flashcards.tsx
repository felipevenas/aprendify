import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
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
import FlashcardCard from "@/components/flashcards/FlashcardCard";
import FlashcardsList from "@/components/flashcards/FlashcardsList";
import AddFlashcardDialog from "@/components/flashcards/AddFlashcardDialog";
import { useFlashcards } from "@/hooks/useFlashcards";
import { usePremium } from "@/hooks/usePremium";
import { PremiumModal } from "@/components/PremiumModal";
import { toast } from "sonner";
import { FIXED_SUBJECTS, FixedSubject, getSubjectById } from "@/lib/subjects";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * Página principal de Flashcards
 * Permite criar, visualizar e praticar com flashcards estilo Anki
 * Agora usa matérias fixas do sistema
 */
const Flashcards = () => {
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
    loading: flashcardsLoading 
  } = useFlashcards(subjectFilter);

  // Limite de flashcards para usuários free
  const FREE_LIMIT = 10;

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

  // Handler para criar novo flashcard com verificação de limite
  const handleNewFlashcard = async () => {
    if (!isPremium && flashcardCount >= FREE_LIMIT) {
      toast.error("Limite de flashcards atingido! Assine o Premium para criar mais.");
      setShowPremiumModal(true);
      return;
    }
    setDialogOpen(true);
  };

  // Obtém informações da matéria do flashcard atual
  const getCurrentFlashcardSubject = () => {
    if (!currentFlashcard?.subject_id) return null;
    return getSubjectById(currentFlashcard.subject_id);
  };

  const currentSubject = getCurrentFlashcardSubject();

  return (
    <PageLoader loading={loading || flashcardsLoading || premiumLoading} message="Preparando flashcards...">
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 app-layout-container">
        <Navbar />

        <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
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
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Crie e pratique com cartões de estudo
                    {!isPremium && (
                      <span className="ml-2 text-primary font-medium">
                        ({flashcardCount}/{FREE_LIMIT} cartões)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button onClick={handleNewFlashcard} className="gap-2 shrink-0">
                <Plus className="h-4 w-4" />
                Novo Flashcard
              </Button>
            </div>
          </motion.div>

          {/* Tabs: Praticar / Meus Flashcards */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="practice" className="gap-2">
                <Shuffle className="h-4 w-4" />
                Praticar
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                Meus Flashcards
              </TabsTrigger>
            </TabsList>

            {/* Tab de Prática */}
            <TabsContent value="practice" className="space-y-6">
              {/* Filtros com matérias fixas */}
              <div className="flex flex-wrap items-center gap-4">
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtrar por matéria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as matérias</SelectItem>
                    {FIXED_SUBJECTS.map((subject: FixedSubject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: subject.color }}
                          />
                          {subject.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={getRandomFlashcard}
                  variant="outline"
                  className="gap-2"
                >
                  <Shuffle className="h-4 w-4" />
                  Sortear Cartão
                </Button>
              </div>

              {/* Área do Flashcard */}
              <AnimatePresence mode="wait">
                {currentFlashcard ? (
                  <motion.div
                    key={currentFlashcard.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                  >
                    <FlashcardCard
                      front={currentFlashcard.front_content}
                      back={currentFlashcard.back_content}
                      subjectName={currentSubject?.name}
                      subjectColor={currentSubject?.color}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16"
                  >
                    <Layers className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-lg mb-4">
                      {flashcardCount === 0
                        ? "Você ainda não criou nenhum flashcard"
                        : "Clique em 'Sortear Cartão' para começar a praticar"}
                    </p>
                    {flashcardCount === 0 && (
                      <Button onClick={handleNewFlashcard} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Criar primeiro flashcard
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Botão de próximo após virar */}
              {currentFlashcard && (
                <div className="flex justify-center">
                  <Button
                    onClick={getRandomFlashcard}
                    variant="default"
                    size="lg"
                    className="gap-2"
                  >
                    <Shuffle className="h-4 w-4" />
                    Próximo Cartão
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Tab de Lista */}
            <TabsContent value="list">
              <FlashcardsList />
            </TabsContent>
          </Tabs>
        </main>

        {/* Dialogs */}
        <AddFlashcardDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
        <PremiumModal
          open={showPremiumModal}
          onOpenChange={setShowPremiumModal}
        />
      </div>
    </PageLoader>
  );
};

export default Flashcards;
