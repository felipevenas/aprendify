import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  XCircle,
  Users,
  Pencil,
  RotateCcw,
  FileText,
  HelpCircle,
  Sparkles,
  Eye,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Navbar from "@/components/Navbar";
import CreatorDetailsModal from "@/components/admin/CreatorDetailsModal";

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  created_at: string;
  role: string;
  is_premium: boolean;
  subscription_status: string | null;
  plan_type: string | null;
  coupon_code: string | null;
}

const AdminUsers = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "premium" | "revoke" | "ban" | "reset-essays" | "reset-questions" | "creator" | "revoke-creator" | null;
    userId: string;
    userName: string;
  }>({ open: false, type: null, userId: "", userName: "" });

  const [creatorCouponCode, setCreatorCouponCode] = useState("");

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    userId: string;
    fullName: string;
    username: string;
    email: string;
  }>({ open: false, userId: "", fullName: "", username: "", email: "" });

  const [creatorDetailsModal, setCreatorDetailsModal] = useState<{
    open: boolean;
    userId: string;
    userName: string;
  }>({ open: false, userId: "", userName: "" });

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

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

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, username, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const usersWithDetails = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id)
            .single();

          // Busca subscription mais recente do usuário (qualquer status)
          const { data: subscriptionData } = await supabase
            .from("subscriptions")
            .select("status, plan_id, plan_type")
            .eq("user_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Premium = qualquer subscription com status "authorized"
          const isPremium = subscriptionData?.status === "authorized";

          // Check for creator coupon
          const { data: couponData } = await supabase
            .from("creator_coupons")
            .select("coupon_code")
            .eq("user_id", profile.id)
            .maybeSingle();

          return {
            ...profile,
            role: roleData?.role || "user",
            is_premium: isPremium,
            subscription_status: subscriptionData?.status || null,
            plan_type: subscriptionData?.plan_type || null,
            coupon_code: couponData?.coupon_code || null,
          };
        }),
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
        user.username?.toLowerCase().includes(term),
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const grantPremium = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { data: existingSubscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingSubscription) {
        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "authorized",
            plan_id: "admin_grant",
            start_date: new Date().toISOString(),
            end_date: null,
          })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("subscriptions").insert({
          user_id: userId,
          status: "authorized",
          plan_id: "admin_grant",
          start_date: new Date().toISOString(),
          end_date: null,
        });

        if (error) throw error;
      }

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

  const banUser = async (userId: string) => {
    setActionLoading(userId);
    try {
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

  const resetEssayCounter = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from("essays")
        .delete()
        .eq("user_id", userId)
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      if (error) throw error;

      toast.success("Contador de redações resetado!");
    } catch (error) {
      console.error("Erro ao resetar contador:", error);
      toast.error("Erro ao resetar contador de redações");
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, type: null, userId: "", userName: "" });
    }
  };

  const grantCreator = async (userId: string, couponCode: string) => {
    if (!couponCode.trim()) {
      toast.error("Digite um código de cupom válido");
      return;
    }

    setActionLoading(userId);
    try {
      // Call edge function to create Stripe promotion code and database records
      const { data, error } = await supabase.functions.invoke("create-creator-coupon", {
        body: { userId, couponCode: couponCode.toUpperCase() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Assinatura Criador concedida! Cupom ${data.code} criado no Stripe com 15% OFF.`);
      setCreatorCouponCode("");
      fetchUsers();
    } catch (error: any) {
      console.error("Erro ao conceder criador:", error);
      toast.error(error.message || "Erro ao conceder assinatura de criador");
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, type: null, userId: "", userName: "" });
    }
  };

  const revokeCreator = async (userId: string) => {
    setActionLoading(userId);
    try {
      // Revoke subscription
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled", end_date: new Date().toISOString() })
        .eq("user_id", userId);

      if (error) throw error;

      // Deactivate coupon
      await supabase.from("creator_coupons").update({ is_active: false }).eq("user_id", userId);

      toast.success("Assinatura Criador revogada com sucesso!");
      fetchUsers();
    } catch (error) {
      console.error("Erro ao revogar criador:", error);
      toast.error("Erro ao revogar assinatura de criador");
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, type: null, userId: "", userName: "" });
    }
  };

  const resetQuestionCounter = async (userId: string) => {
    setActionLoading(userId);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { error } = await supabase
        .from("question_attempts")
        .delete()
        .eq("user_id", userId)
        .gte("created_at", today.toISOString());

      if (error) throw error;

      toast.success("Contador de questões do dia resetado!");
    } catch (error) {
      console.error("Erro ao resetar contador:", error);
      toast.error("Erro ao resetar contador de questões");
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, type: null, userId: "", userName: "" });
    }
  };

  const updateUserProfile = async () => {
    setActionLoading(editDialog.userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editDialog.fullName,
          username: editDialog.username,
          email: editDialog.email,
        })
        .eq("id", editDialog.userId);

      if (error) throw error;

      toast.success("Perfil atualizado com sucesso!");
      setEditDialog({ open: false, userId: "", fullName: "", username: "", email: "" });
      fetchUsers();
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setActionLoading(null);
    }
  };

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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                Gerenciar Usuários
              </h1>
              <p className="text-muted-foreground mt-1">Administre os usuários cadastrados no sistema</p>
            </div>

            <Badge variant="secondary" className="text-sm px-4 py-2">
              <Users className="h-4 w-4 mr-2" />
              {users.length} usuários cadastrados
            </Badge>
          </div>

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

          <Card>
            <CardHeader>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>Lista de todos os usuários cadastrados na plataforma</CardDescription>
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
                        <TableCell className="font-medium">{user.full_name || user.username || "—"}</TableCell>
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
                          ) : user.plan_type === "creator" && user.is_premium ? (
                            <Badge
                              className="bg-gradient-to-r from-purple-500 to-pink-500 gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                              title="Clique para ver detalhes"
                              onClick={() =>
                                setCreatorDetailsModal({
                                  open: true,
                                  userId: user.id,
                                  userName: user.full_name || user.email,
                                })
                              }
                            >
                              <Sparkles className="h-3 w-3" />
                              Criador
                              <Eye className="h-3 w-3 ml-1" />
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
                              <Button variant="ghost" size="icon" disabled={actionLoading === user.id}>
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

                              <DropdownMenuItem
                                onClick={() =>
                                  setEditDialog({
                                    open: true,
                                    userId: user.id,
                                    fullName: user.full_name || "",
                                    username: user.username || "",
                                    email: user.email,
                                  })
                                }
                                className="gap-2 cursor-pointer"
                              >
                                <Pencil className="h-4 w-4 text-blue-500" />
                                Editar Perfil
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmDialog({
                                    open: true,
                                    type: "reset-essays",
                                    userId: user.id,
                                    userName: user.full_name || user.email,
                                  })
                                }
                                className="gap-2 cursor-pointer"
                              >
                                <FileText className="h-4 w-4 text-purple-500" />
                                Resetar Redações (mês)
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmDialog({
                                    open: true,
                                    type: "reset-questions",
                                    userId: user.id,
                                    userName: user.full_name || user.email,
                                  })
                                }
                                className="gap-2 cursor-pointer"
                              >
                                <HelpCircle className="h-4 w-4 text-green-500" />
                                Resetar Questões (dia)
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              {!user.is_premium && user.subscription_status !== "banned" && (
                                <>
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

                                  <DropdownMenuItem
                                    onClick={() => {
                                      setCreatorCouponCode("");
                                      setConfirmDialog({
                                        open: true,
                                        type: "creator",
                                        userId: user.id,
                                        userName: user.full_name || user.email,
                                      });
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Sparkles className="h-4 w-4 text-purple-500" />
                                    Conceder Criador
                                  </DropdownMenuItem>
                                </>
                              )}

                              {user.is_premium && user.plan_type === "creator" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setConfirmDialog({
                                      open: true,
                                      type: "revoke-creator",
                                      userId: user.id,
                                      userName: user.full_name || user.email,
                                    })
                                  }
                                  className="gap-2 cursor-pointer"
                                >
                                  <UserX className="h-4 w-4 text-purple-500" />
                                  Revogar Criador
                                </DropdownMenuItem>
                              )}

                              {user.is_premium && user.plan_type !== "creator" && (
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

      <AlertDialog
        open={confirmDialog.open && confirmDialog.type !== "creator"}
        onOpenChange={(open) => !open && setConfirmDialog({ open: false, type: null, userId: "", userName: "" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === "premium" && "Conceder Premium"}
              {confirmDialog.type === "revoke" && "Revogar Premium"}
              {confirmDialog.type === "revoke-creator" && "Revogar Criador"}
              {confirmDialog.type === "ban" && "Banir Usuário"}
              {confirmDialog.type === "reset-essays" && "Resetar Redações"}
              {confirmDialog.type === "reset-questions" && "Resetar Questões"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === "premium" && `Deseja conceder acesso Premium para ${confirmDialog.userName}?`}
              {confirmDialog.type === "revoke" && `Deseja revogar o acesso Premium de ${confirmDialog.userName}?`}
              {confirmDialog.type === "revoke-creator" &&
                `Deseja revogar a assinatura Criador de ${confirmDialog.userName}? O cupom será desativado.`}
              {confirmDialog.type === "ban" &&
                `Deseja banir ${confirmDialog.userName}? Esta ação irá revogar todos os acessos do usuário.`}
              {confirmDialog.type === "reset-essays" &&
                `Deseja deletar todas as redações de ${confirmDialog.userName} enviadas este mês? Isso irá zerar o contador mensal.`}
              {confirmDialog.type === "reset-questions" &&
                `Deseja deletar todas as tentativas de questões de ${confirmDialog.userName} de hoje? Isso irá zerar o contador diário.`}
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
                } else if (confirmDialog.type === "revoke-creator") {
                  revokeCreator(confirmDialog.userId);
                } else if (confirmDialog.type === "ban") {
                  banUser(confirmDialog.userId);
                } else if (confirmDialog.type === "reset-essays") {
                  resetEssayCounter(confirmDialog.userId);
                } else if (confirmDialog.type === "reset-questions") {
                  resetQuestionCounter(confirmDialog.userId);
                }
              }}
              className={confirmDialog.type === "ban" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog for Creator with coupon input */}
      <Dialog
        open={confirmDialog.open && confirmDialog.type === "creator"}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog({ open: false, type: null, userId: "", userName: "" });
            setCreatorCouponCode("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Conceder Assinatura Criador
            </DialogTitle>
            <DialogDescription>
              Conceda acesso Premium vitalício para {confirmDialog.userName} como criador de conteúdo. Defina um código
              de cupom único para o criador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="couponCode">Código do Cupom</Label>
              <Input
                id="couponCode"
                placeholder="Ex: JOAO10, MARIA20..."
                value={creatorCouponCode}
                onChange={(e) =>
                  setCreatorCouponCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 12),
                  )
                }
                className="uppercase"
                maxLength={12}
              />
              <p className="text-xs text-muted-foreground">
                Apenas letras e números. Máximo de 10 caracteres. ({creatorCouponCode.length}/12)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialog({ open: false, type: null, userId: "", userName: "" });
                setCreatorCouponCode("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => grantCreator(confirmDialog.userId, creatorCouponCode)}
              disabled={!creatorCouponCode.trim() || actionLoading === confirmDialog.userId}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              {actionLoading === confirmDialog.userId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Conceder Criador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialog.open}
        onOpenChange={(open) =>
          !open && setEditDialog({ open: false, userId: "", fullName: "", username: "", email: "" })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
            <DialogDescription>Altere as informações do usuário abaixo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                value={editDialog.fullName}
                onChange={(e) => setEditDialog({ ...editDialog, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={editDialog.username}
                onChange={(e) => setEditDialog({ ...editDialog, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editDialog.email}
                onChange={(e) => setEditDialog({ ...editDialog, email: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog({ open: false, userId: "", fullName: "", username: "", email: "" })}
            >
              Cancelar
            </Button>
            <Button onClick={updateUserProfile} disabled={actionLoading === editDialog.userId}>
              {actionLoading === editDialog.userId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Creator Details Modal */}
      <CreatorDetailsModal
        open={creatorDetailsModal.open}
        onOpenChange={(open) => setCreatorDetailsModal({ ...creatorDetailsModal, open })}
        userId={creatorDetailsModal.userId}
        userName={creatorDetailsModal.userName}
      />
    </div>
  );
};

export default AdminUsers;
