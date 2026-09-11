import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FeedbackTicket, FeedbackFormData } from "../types";
import { feedbackService } from "../services/feedbackService";

export function useFeedback() {
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await feedbackService.getTickets();
      setTickets(data);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast.error("Erro ao carregar seus tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  const submitFeedback = useCallback(
    async (formData: FeedbackFormData): Promise<boolean> => {
      if (!formData.title.trim() || !formData.description.trim()) {
        toast.error("Preencha todos os campos");
        return false;
      }

      setSubmitting(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Você precisa estar logado");
          return false;
        }

        await feedbackService.submitFeedback(user.id, formData);
        toast.success("Feedback enviado com sucesso!");
        await fetchTickets();
        return true;
      } catch (error) {
        console.error("Error submitting ticket:", error);
        toast.error("Erro ao enviar feedback");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [fetchTickets]
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return {
    tickets,
    loading,
    submitting,
    submitFeedback,
    refetch: fetchTickets,
  };
}
