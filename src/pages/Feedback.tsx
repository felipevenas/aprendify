import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowLeft, MessageSquarePlus, Bug, Lightbulb, Wrench, Send, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TicketType = "suggestion" | "improvement" | "bug";
type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

interface FeedbackTicket {
  id: string;
  title: string;
  description: string;
  ticket_type: TicketType;
  status: TicketStatus;
  admin_notes: string | null;
  created_at: string;
}

const ticketTypeConfig = {
  suggestion: { label: "Sugestão", icon: Lightbulb, color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  improvement: { label: "Melhoria", icon: Wrench, color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  bug: { label: "Correção", icon: Bug, color: "bg-red-500/10 text-red-500 border-red-500/20" },
};

const statusConfig = {
  open: { label: "Aberto", icon: Clock, color: "bg-muted text-muted-foreground" },
  in_progress: { label: "Em análise", icon: Loader2, color: "bg-blue-500/10 text-blue-500" },
  resolved: { label: "Resolvido", icon: CheckCircle, color: "bg-green-500/10 text-green-500" },
  closed: { label: "Fechado", icon: XCircle, color: "bg-muted text-muted-foreground" },
};

const Feedback = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ticketType, setTicketType] = useState<TicketType>("suggestion");

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      await fetchTickets();
    };

    checkAuthAndFetch();
  }, [navigate]);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("feedback_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets((data || []) as FeedbackTicket[]);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast.error("Erro ao carregar seus tickets");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      const { error } = await supabase.from("feedback_tickets").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        ticket_type: ticketType,
      });

      if (error) throw error;

      toast.success("Feedback enviado com sucesso!");
      setTitle("");
      setDescription("");
      setTicketType("suggestion");
      await fetchTickets();
    } catch (error) {
      console.error("Error submitting ticket:", error);
      toast.error("Erro ao enviar feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <MessageSquarePlus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Feedback
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Envie sugestões, melhorias ou reporte problemas
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Formulário */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Novo Feedback</CardTitle>
                <CardDescription>
                  Sua opinião é muito importante para melhorarmos a plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipo de feedback</Label>
                    <RadioGroup
                      value={ticketType}
                      onValueChange={(value) => setTicketType(value as TicketType)}
                      className="flex flex-wrap gap-3"
                    >
                      {(Object.entries(ticketTypeConfig) as [TicketType, typeof ticketTypeConfig.suggestion][]).map(
                        ([value, config]) => {
                          const Icon = config.icon;
                          return (
                            <div key={value}>
                              <RadioGroupItem
                                value={value}
                                id={value}
                                className="peer sr-only"
                              />
                              <Label
                                htmlFor={value}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition-all
                                  ${ticketType === value 
                                    ? "border-primary bg-primary/5" 
                                    : "border-border hover:border-primary/50"
                                  }`}
                              >
                                <Icon className="h-4 w-4" />
                                {config.label}
                              </Label>
                            </div>
                          );
                        }
                      )}
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      placeholder="Resumo do seu feedback"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={100}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      placeholder="Descreva em detalhes sua sugestão, melhoria ou problema encontrado..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-[120px]"
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {description.length}/2000
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar Feedback
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Lista de Tickets */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Seus Feedbacks</CardTitle>
                <CardDescription>
                  Acompanhe o status dos seus envios
                </CardDescription>
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
                            <h4 className="font-medium text-sm line-clamp-1">
                              {ticket.title}
                            </h4>
                            <Badge variant="outline" className={`shrink-0 ${statusCfg.color}`}>
                              <StatusIcon className={`h-3 w-3 mr-1 ${ticket.status === "in_progress" ? "animate-spin" : ""}`} />
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
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Feedback;
