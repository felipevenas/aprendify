export type TicketType = "suggestion" | "improvement" | "bug";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface FeedbackTicket {
  id: string;
  title: string;
  description: string;
  ticket_type: TicketType;
  status: TicketStatus;
  admin_notes: string | null;
  created_at: string;
  user_id?: string;
}

export interface FeedbackFormData {
  title: string;
  description: string;
  ticket_type: TicketType;
}
