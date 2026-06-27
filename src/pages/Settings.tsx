import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Upload, Loader2, Shield, Users, ChevronRight, Volume2, Settings as SettingsIcon } from "lucide-react";
import Navbar from "@/components/Navbar";
import TwoFactorAuth from "@/components/settings/TwoFactorAuth";
import { useSoundPreferences } from "@/hooks/useSoundPreferences";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { PageLoader } from "@/components/ui/page-loader";

/**
 * Página de configurações do usuário
 * Permite edição de perfil, alteração de senha e upload de foto
 */
const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const { soundEnabled, setSoundEnabled } = useSoundPreferences();
  const { playClickSound } = useSoundEffects();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUser(user);
      setEmail(user.email || "");
      setAvatarUrl(user.user_metadata?.avatar_url || "");

      // Busca dados do perfil
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || "");
      }

      // Verifica se é admin
      const { data: roleData } = await supabase.rpc("get_user_role", { _user_id: user.id });
      setIsAdmin(roleData === "admin");

      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleUpdateProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Atualiza perfil
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast.error("Erro ao atualizar perfil. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha ambos os campos de senha");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      toast.error("Erro ao atualizar senha. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;

    const file = e.target.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}-${Math.random()}.${fileExt}`;

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: URL.createObjectURL(file),
        },
      });

      if (updateError) throw updateError;

      setAvatarUrl(URL.createObjectURL(file));
      toast.success("Foto atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao fazer upload da foto:", error);
      toast.error("Erro ao atualizar foto. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <PageLoader loading={loading} message="Carregando configurações...">
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 app-layout-container">
        <Navbar />

        <main className="max-w-7xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                <SettingsIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Configurações
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Gerencie sua conta e preferências do sistema
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Avatar */}
              <Card>
                <CardHeader>
                  <CardTitle>Foto de Perfil</CardTitle>
                  <CardDescription>
                    Atualize sua foto de perfil
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl">
                      {getInitials(fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Label htmlFor="avatar-upload" className="cursor-pointer">
                      <Button variant="outline" disabled={saving} asChild>
                        <span>
                          {saving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Carregar Foto
                        </span>
                      </Button>
                    </Label>
                    <Input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      PNG, JPG ou GIF (máx. 2MB)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Informações do Perfil */}
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Perfil</CardTitle>
                  <CardDescription>
                    Atualize suas informações pessoais
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={email}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      O email não pode ser alterado
                    </p>
                  </div>
                  <Button onClick={handleUpdateProfile} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar Alterações
                  </Button>
                </CardContent>
              </Card>

              {/* Alterar Senha */}
              <Card>
                <CardHeader>
                  <CardTitle>Alterar Senha</CardTitle>
                  <CardDescription>
                    Mantenha sua conta segura com uma senha forte
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova Senha</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirme a nova senha"
                    />
                  </div>
                  <Button onClick={handleUpdatePassword} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Atualizar Senha
                  </Button>
                </CardContent>
              </Card>

              {/* Preferências de Som */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5" />
                    Efeitos Sonoros
                  </CardTitle>
                  <CardDescription>
                    Configure os sons do aplicativo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="sound-toggle">Ativar efeitos sonoros</Label>
                      <p className="text-sm text-muted-foreground">
                        Sons ao acertar questões, completar streaks e gerar cronogramas
                      </p>
                    </div>
                    <Switch
                      id="sound-toggle"
                      checked={soundEnabled}
                      onCheckedChange={(checked) => {
                        setSoundEnabled(checked);
                        if (checked) {
                          playClickSound();
                        }
                        toast.success(checked ? "Sons ativados" : "Sons desativados");
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Autenticação em Dois Fatores */}
              {user && <TwoFactorAuth userId={user.id} />}

              {/* Ferramentas de Administrador - Apenas para admins */}
              {isAdmin && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Ferramentas de Administrador
                    </CardTitle>
                    <CardDescription>
                      Acesso privilegiado para gerenciar o sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      onClick={() => navigate("/admin/users")} 
                      className="w-full justify-between"
                      variant="outline"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Gerenciar Usuários
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Conceda benefícios, gerencie assinaturas e bana usuários
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        </main>
      </div>
    </PageLoader>
  );
};

export default Settings;
