import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Flashcard } from "../types";
import { flashcardService } from "../services/flashcardService";

export const useFlashcards = (subjectFilter?: string) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFlashcard, setCurrentFlashcard] = useState<Flashcard | null>(null);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());
  const [flashcardCount, setFlashcardCount] = useState(0);

  const fetchFlashcards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const data = await flashcardService.getFlashcards(user.id, subjectFilter);
      setFlashcards(data);
      setFlashcardCount(data.length);
    } catch (error: unknown) {
      toast.error("Erro ao carregar flashcards");
    } finally {
      setLoading(false);
    }
  }, [subjectFilter]);

  const getRandomFlashcard = useCallback(() => {
    const available = flashcards.filter((f) => !shownIds.has(f.id));

    if (available.length === 0) {
      if (flashcards.length === 0) {
        setCurrentFlashcard(null);
        return;
      }
      setShownIds(new Set());
      const randomIndex = Math.floor(Math.random() * flashcards.length);
      const selected = flashcards[randomIndex];
      setCurrentFlashcard(selected);
      setShownIds(new Set([selected.id]));
      return;
    }

    const randomIndex = Math.floor(Math.random() * available.length);
    const selected = available[randomIndex];
    setCurrentFlashcard(selected);
    setShownIds((prev) => new Set([...prev, selected.id]));
  }, [flashcards, shownIds]);

  useEffect(() => {
    fetchFlashcards();

    const channel = supabase
      .channel("flashcards_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "flashcards",
        },
        () => {
          fetchFlashcards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFlashcards]);

  useEffect(() => {
    setShownIds(new Set());
    setCurrentFlashcard(null);
  }, [subjectFilter]);

  return {
    flashcards,
    loading,
    currentFlashcard,
    flashcardCount,
    getRandomFlashcard,
    refetch: fetchFlashcards,
  };
};

export default useFlashcards;
