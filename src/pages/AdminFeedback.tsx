import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowLeft, MessageSquare, Bug, Lightbulb, Wrench, Clock, CheckCircle, XCircle, Loader2, Search, Filter, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type TicketType = "suggestion" | "improvement" | "bug";
type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

interface FeedbackTicket {
  id: string;
  user_id: string;
  title: string;
  description: string;
  ticket_type: TicketType;
  status: TicketStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
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

const AdminFeedback = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<FeedbackTicket[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<FeedbackTicket | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<FeedbackTicket | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState<TicketStatus>("open");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleData?.role !== "admin") {
        navigate("/dashboard");
        toast.error("Acesso não autorizado");
        return;
      }

      await fetchTickets();
    };

    checkAdminAndFetch();
  }, [navigate]);

  useEffect(() => {
    let filtered = [...tickets];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term) ||
          t.user_email?.toLowerCase().includes(term) ||
          t.user_name?.toLowerCase().includes(term)
      );
    }

    if (filterType !== "all") {
      filtered = filtered.filter((t) => t.ticket_type === filterType);
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((t) => t.status === filterStatus);
    }

    setFilteredTickets(filtered);
  }, [tickets, searchTerm, filterType, filterStatus]);

  const fetchTickets = async () => {
    try {
      const { data: ticketsData, error } = await supabase
        .from("feedback_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar informações dos usuários
      const userIds = [...new Set((ticketsData || []).map((t) => t.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const profilesMap = new Map(
        (profiles || []).map((p) => [p.id, { email: p.email, name: p.full_name }])
      );

      const ticketsWithUsers = (ticketsData || []).map((t) => ({
        ...t,
        user_email: profilesMap.get(t.user_id)?.email,
        user_name: profilesMap.get(t.user_id)?.name,
      })) as FeedbackTicket[];

      setTickets(ticketsWithUsers);
      setFilteredTickets(ticketsWithUsers);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast.error("Erro ao carregar tickets");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTicket = (ticket: FeedbackTicket) => {
    setSelectedTicket(ticket);
    setAdminNotes(ticket.admin_notes || "");
    setNewStatus(ticket.status);
  };

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return;

    setUpdating(true);

    try {
      const { error } = await supabase
        .from("feedback_tickets")
        .update({
          status: newStatus,
          admin_notes: adminNotes.trim() || null,
        })
        .eq("id", selectedTicket.id);

      if (error) throw error;

      toast.success("Ticket atualizado com sucesso");
      setSelectedTicket(null);
      await fetchTickets();
    } catch (error) {
      console.error("Error updating ticket:", error);
      toast.error("Erro ao atualizar ticket");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return;

    try {
      const { error } = await supabase
        .from("feedback_tickets")
        .delete()
        .eq("id", ticketToDelete.id);

      if (error) throw error;

      toast.success("Ticket excluído");
      setTicketToDelete(null);
      await fetchTickets();
    } catch (error) {
      console.error("Error deleting ticket:", error);
      toast.error("Erro ao excluir ticket");
    }
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
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
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
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
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Gerenciar Feedbacks
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Visualize e responda aos feedbacks dos usuários
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6"
        >
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Abertos</p>
            <p className="text-2xl font-bold text-amber-500">{stats.open}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Em análise</p>
            <p className="text-2xl font-bold text-blue-500">{stats.inProgress}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Resolvidos</p>
            <p className="text-2xl font-bold text-green-500">{stats.resolved}</p>
          </Card>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-3 mb-6"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, descrição ou usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="suggestion">Sugestão</SelectItem>
              <SelectItem value="improvement">Melhoria</SelectItem>
              <SelectItem value="bug">Correção</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="open">Aberto</SelectItem>
              <SelectItem value="in_progress">Em análise</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
              <SelectItem value="closed">Fechado</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Tickets List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Tickets ({filteredTickets.length})
              </CardTitle>
              <CardDescription>
                Clique em um ticket para visualizar detalhes e responder
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredTickets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum ticket encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTickets.map((ticket) => {
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
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium line-clamp-1">
                              {ticket.title}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {ticket.user_name || ticket.user_email || "Usuário desconhecido"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={statusCfg.color}>
                              <StatusIcon className={`h-3 w-3 mr-1 ${ticket.status === "in_progress" ? "animate-spin" : ""}`} />
                              {statusCfg.label}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {ticket.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={typeConfig.color}>
                              <TypeIcon className="h-3 w-3 mr-1" />
                              {typeConfig.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(ticket.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenTicket(ticket)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setTicketToDelete(ticket)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.title}</DialogTitle>
            <DialogDescription>
              Enviado por {selectedTicket?.user_name || selectedTicket?.user_email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm whitespace-pre-wrap">{selectedTicket?.description}</p>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as TicketStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="in_progress">Em análise</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notas/Resposta (visível para o usuário)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Adicione uma resposta ou notas..."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTicket(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateTicket} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!ticketToDelete} onOpenChange={() => setTicketToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O ticket será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTicket}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminFeedback;
