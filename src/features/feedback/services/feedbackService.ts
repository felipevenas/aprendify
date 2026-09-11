import { supabase } from "@/integrations/supabase/client";
import { FeedbackTicket, FeedbackFormData } from "../types";

export const feedbackService = {
  async getTickets(): Promise<FeedbackTicket[]> {
    const { data, error } = await supabase
      .from("feedback_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as FeedbackTicket[];
  },

  async submitFeedback(userId: string, formData: FeedbackFormData): Promise<void> {
    const { error } = await supabase.from("feedback_tickets").insert({
      user_id: userId,
      title: formData.title.trim(),
      description: formData.description.trim(),
      ticket_type: formData.ticket_type,
    });

    if (error) throw error;
  },
};
