import { MessageSquarePlus, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FeedbackTicket } from "../types";
import { ticketTypeConfig } from "./FeedbackForm";

export const statusConfig = {
  open: { label: "Aberto", icon: Clock, color: "bg-muted text-muted-foreground" },
  in_progress: { label: "Em análise", icon: Loader2, color: "bg-blue-500/10 text-blue-500" },
  resolved: { label: "Resolvido", icon: CheckCircle, color: "bg-green-500/10 text-green-500" },
  closed: { label: "Fechado", icon: XCircle, color: "bg-muted text-muted-foreground" },
};

interface FeedbackTicketListProps {
  tickets: FeedbackTicket[];
}

export const FeedbackTicketList = ({ tickets }: FeedbackTicketListProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Seus Feedbacks</CardTitle>
        <CardDescription>Acompanhe o status dos seus envios</CardDescription>
      </CardHeader>
      <CardContent>
        {tickets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquarePlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Você ainda não enviou nenhum feedback</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {tickets.map((ticket) => {
              const typeConfig = ticketTypeConfig[ticket.ticket_type];
              const statusCfg = statusConfig[ticket.status];
              const TypeIcon = typeConfig.icon;
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={ticket.id}
                  className="p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-medium text-sm line-clamp-1">{ticket.title}</h4>
                    <Badge variant="outline" className={`shrink-0 ${statusCfg.color}`}>
                      <StatusIcon
                        className={`h-3 w-3 mr-1 ${
                          ticket.status === "in_progress" ? "animate-spin" : ""
                        }`}
                      />
                      {statusCfg.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {ticket.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={typeConfig.color}>
                      <TypeIcon className="h-3 w-3 mr-1" />
                      {typeConfig.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(ticket.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  {ticket.admin_notes && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        <strong>Resposta:</strong> {ticket.admin_notes}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FeedbackTicketList;
