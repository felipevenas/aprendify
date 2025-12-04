import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { 
  Search, 
  Loader2, 
  Crown, 
  Shield, 
  UserX, 
  Ban, 
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Users
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Navbar from "@/components/Navbar";

/**
 * Interface para dados do usuário
 */
interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  created_at: string;
  role: string;
  is_premium: boolean;
  subscription_status: string | null;
}

/**
 * Página de administração de usuários
 * Permite gerenciar usuários, conceder premium, banir, etc.
 */
const AdminUsers = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Estados para diálogos de confirmação
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "premium" | "revoke" | "ban" | null;
    userId: string;
    userName: string;
  }>({ open: false, type: null, userId: "", userName: "" });

  // Verifica se o usuário é admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Verifica role do usuário
      const { data: roleData } = await supabase.rpc("get_user_role", { _user_id: user.id });
      
      if (roleData !== "admin") {
        toast.error("Acesso negado. Você não tem permissão de administrador.");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      fetchUsers();
    };

    checkAdmin();
  }, [navigate]);

  // Busca todos os usuários
  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Busca perfis dos usuários
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, username, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Para cada usuário, busca role e subscription
      const usersWithDetails = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Busca role
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id)
            .single();

          // Busca subscription
          const { data: subscriptionData } = await supabase
            .from("subscriptions")
            .select("status")
            .eq("user_id", profile.id)
            .eq("status", "authorized")
            .maybeSingle();

          return {
            ...profile,
            role: roleData?.role || "user",
            is_premium: !!subscriptionData,
            subscription_status: subscriptionData?.status || null,
          };
        })
      );

      setUsers(usersWithDetails);
      setFilteredUsers(usersWithDetails);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  // Filtra usuários pelo termo de busca
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.email.toLowerCase().includes(term) ||
        user.full_name?.toLowerCase().includes(term) ||
        user.username?.toLowerCase().includes(term)
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  // Concede premium ao usuário
  const grantPremium = async (userId: string) => {
    setActionLoading(userId);
    try {
      // Cria ou atualiza subscription
      const { error } = await supabase
        .from("subscriptions")
        .upsert({
          user_id: userId,
          status: "authorized",
          plan_id: "admin_grant",
          start_date: new Date().toISOString(),
          end_date: null, // Premium sem data de expiração
        }, {
          onConflict: "user_id"
        });

      if (error) throw error;

      toast.success("Premium concedido com sucesso!");
      fetchUsers();
    } catch (error) {
      console.error("Erro ao conceder premium:", error);
      toast.error("Erro ao conceder premium");
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, type: null, userId: "", userName: "" });
    }
  };

  // Revoga premium do usuário
  const revokePremium = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled", end_date: new Date().toISOString() })
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("Premium revogado com sucesso!");
      fetchUsers();
    } catch (error) {
      console.error("Erro ao revogar premium:", error);
      toast.error("Erro ao revogar premium");
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, type: null, userId: "", userName: "" });
    }
  };

  // Bane usuário (desativa subscription e marca como banido)
  const banUser = async (userId: string) => {
    setActionLoading(userId);
    try {
      // Cancela subscription se existir
      await supabase
        .from("subscriptions")
        .update({ status: "banned", end_date: new Date().toISOString() })
        .eq("user_id", userId);

      toast.success("Usuário banido com sucesso!");
      fetchUsers();
    } catch (error) {
      console.error("Erro ao banir usuário:", error);
      toast.error("Erro ao banir usuário");
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, type: null, userId: "", userName: "" });
    }
  };

  // Formata data para exibição
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                Gerenciar Usuários
              </h1>
              <p className="text-muted-foreground mt-1">
                Administre os usuários cadastrados no sistema
              </p>
            </div>

            {/* Contador de usuários */}
            <Badge variant="secondary" className="text-sm px-4 py-2">
              <Users className="h-4 w-4 mr-2" />
              {users.length} usuários cadastrados
            </Badge>
          </div>

          {/* Busca */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Tabela de usuários */}
          <Card>
            <CardHeader>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>
                Lista de todos os usuários cadastrados na plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name || user.username || "—"}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant={user.role === "admin" ? "default" : "secondary"}
                            className={user.role === "admin" ? "bg-primary" : ""}
                          >
                            {user.role === "admin" ? "Admin" : "Usuário"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.subscription_status === "banned" ? (
                            <Badge variant="destructive" className="gap-1">
                              <Ban className="h-3 w-3" />
                              Banido
                            </Badge>
                          ) : user.is_premium ? (
                            <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 gap-1">
                              <Crown className="h-3 w-3" />
                              Premium
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Free
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={actionLoading === user.id}
                              >
                                {actionLoading === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              
                              {/* Conceder Premium */}
                              {!user.is_premium && user.subscription_status !== "banned" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmDialog({
                                      open: true,
                                      type: "premium",
                                      userId: user.id,
                                      userName: user.full_name || user.email,
                                    })
                                  }
                                  className="gap-2 cursor-pointer"
                                >
                                  <Crown className="h-4 w-4 text-yellow-500" />
                                  Conceder Premium
                                </DropdownMenuItem>
                              )}

                              {/* Revogar Premium */}
                              {user.is_premium && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmDialog({
                                      open: true,
                                      type: "revoke",
                                      userId: user.id,
                                      userName: user.full_name || user.email,
                                    })
                                  }
                                  className="gap-2 cursor-pointer"
                                >
                                  <UserX className="h-4 w-4 text-orange-500" />
                                  Revogar Premium
                                </DropdownMenuItem>
                              )}

                              {/* Banir */}
                              {user.subscription_status !== "banned" && user.role !== "admin" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setConfirmDialog({
                                        open: true,
                                        type: "ban",
                                        userId: user.id,
                                        userName: user.full_name || user.email,
                                      })
                                    }
                                    className="gap-2 cursor-pointer text-destructive"
                                  >
                                    <Ban className="h-4 w-4" />
                                    Banir Usuário
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}

                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Diálogo de Confirmação */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          !open && setConfirmDialog({ open: false, type: null, userId: "", userName: "" })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === "premium" && "Conceder Premium"}
              {confirmDialog.type === "revoke" && "Revogar Premium"}
              {confirmDialog.type === "ban" && "Banir Usuário"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === "premium" &&
                `Deseja conceder acesso Premium para ${confirmDialog.userName}?`}
              {confirmDialog.type === "revoke" &&
                `Deseja revogar o acesso Premium de ${confirmDialog.userName}?`}
              {confirmDialog.type === "ban" &&
                `Deseja banir ${confirmDialog.userName}? Esta ação irá revogar todos os acessos do usuário.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.type === "premium") {
                  grantPremium(confirmDialog.userId);
                } else if (confirmDialog.type === "revoke") {
                  revokePremium(confirmDialog.userId);
                } else if (confirmDialog.type === "ban") {
                  banUser(confirmDialog.userId);
                }
              }}
              className={
                confirmDialog.type === "ban"
                  ? "bg-destructive hover:bg-destructive/90"
                  : ""
              }
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
