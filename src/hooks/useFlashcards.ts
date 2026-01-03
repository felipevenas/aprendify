import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { getSubjectById } from "@/lib/subjects";

/**
 * Interface para o Flashcard
 */
export interface Flashcard {
  id: string;
  front_content: string;
  back_content: string;
  subject_id?: string | null;
  created_at: string;
}

/**
 * Hook para gerenciar flashcards com cache e seleção aleatória
 */
export const useFlashcards = (subjectFilter?: string) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFlashcard, setCurrentFlashcard] = useState<Flashcard | null>(null);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());
  const [flashcardCount, setFlashcardCount] = useState(0);

  // Busca todos os flashcards do usuário
  const fetchFlashcards = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("flashcards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Aplica filtro por disciplina se existir
      if (subjectFilter && subjectFilter !== "all") {
        query = query.eq("subject_id", subjectFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setFlashcards(data || []);
      setFlashcardCount(data?.length || 0);
    } catch (error: any) {
      toast.error("Erro ao carregar flashcards");
    } finally {
      setLoading(false);
    }
  }, [subjectFilter]);

  // Seleciona um flashcard aleatório que ainda não foi mostrado
  const getRandomFlashcard = useCallback(() => {
    const available = flashcards.filter(f => !shownIds.has(f.id));
    
    // Se todos já foram mostrados, resetar
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
    setShownIds(prev => new Set([...prev, selected.id]));
  }, [flashcards, shownIds]);

  // Listener de realtime
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

  // Reseta quando o filtro muda
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
