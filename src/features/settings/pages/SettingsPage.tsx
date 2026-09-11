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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { 
  Upload, Loader2, Shield, Users, ChevronRight, Volume2, 
  Settings as SettingsIcon, User as UserIcon, Lock, Sliders 
} from "lucide-react";
import Navbar from "@/components/Navbar";
import TwoFactorAuth from "../components/TwoFactorAuth";
import { useSoundPreferences } from "@/hooks/useSoundPreferences";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { PageLoader } from "@/components/ui/page-loader";
import { GitHubStudyHeatmap } from "@/features/gamification/components/GitHubStudyHeatmap";

/**
 * Página de configurações do usuário
 * Organizada em sub-abas padronizadas (Meu Perfil, Segurança, Preferências, Admin)
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
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      setIsAdmin(!!roleData);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleUpdateProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);

      if (error) throw error;

      await supabase.auth.updateUser({
        data: { full_name: fullName }
      });

      toast.success("Perfil atualizado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao atualizar perfil:", error);
      toast.error(error.message || "Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) {
      toast.error("Digite a nova senha");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Senha atualizada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Erro ao atualizar senha:", error);
      toast.error(error.message || "Erro ao atualizar senha");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    setSaving(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("user-content")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("user-content")
        .getPublicUrl(filePath);

      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      setAvatarUrl(publicUrl);
      toast.success("Foto de perfil atualizada!");
    } catch (error: any) {
      console.error("Erro ao atualizar avatar:", error);
      toast.error(error.message || "Erro ao atualizar foto");
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 app-layout-container">
      <Navbar />

      <main className="max-w-5xl lg:ml-0 lg:mr-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageLoader loading={loading}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex items-center gap-3 pb-2 border-b border-border/40">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
                <SettingsIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Configurações
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Gerencie sua conta, segurança e preferências de estudo
                </p>
              </div>
            </div>

            {/* Sub-abas Padronizadas (Pills) */}
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="p-1 bg-muted/80 rounded-xl flex flex-wrap h-auto gap-1 border border-border/50">
                <TabsTrigger 
                  value="profile" 
                  className="rounded-lg gap-2 text-xs sm:text-sm px-3.5 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <UserIcon className="h-4 w-4" />
                  <span>Meu Perfil</span>
                </TabsTrigger>

                <TabsTrigger 
                  value="security" 
                  className="rounded-lg gap-2 text-xs sm:text-sm px-3.5 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <Lock className="h-4 w-4" />
                  <span>Segurança</span>
                </TabsTrigger>

                <TabsTrigger 
                  value="preferences" 
                  className="rounded-lg gap-2 text-xs sm:text-sm px-3.5 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <Sliders className="h-4 w-4" />
                  <span>Preferências</span>
                </TabsTrigger>

                {isAdmin && (
                  <TabsTrigger 
                    value="admin" 
                    className="rounded-lg gap-2 text-xs sm:text-sm px-3.5 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm text-primary"
                  >
                    <Shield className="h-4 w-4" />
                    <span>Administração</span>
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Aba: Meu Perfil */}
              <TabsContent value="profile" className="space-y-6 animate-fade-in mt-0">
                {/* Foto de Perfil */}
                <Card className="border-border/60 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Foto de Perfil</CardTitle>
                    <CardDescription className="text-xs">
                      Personalize seu avatar de exibição no ranking e painel
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col sm:flex-row items-center gap-6">
                    <Avatar className="h-20 w-20 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl font-bold">
                        {getInitials(fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2 text-center sm:text-left">
                      <Label htmlFor="avatar-upload" className="cursor-pointer inline-block">
                        <Button variant="outline" size="sm" disabled={saving} asChild>
                          <span>
                            {saving ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            Alterar Foto
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
                      <p className="text-xs text-muted-foreground">
                        Formatos aceitos: PNG, JPG ou GIF (máx. 2MB)
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Informações Cadastrais */}
                <Card className="border-border/60 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Informações Pessoais</CardTitle>
                    <CardDescription className="text-xs">
                      Atualize seu nome de exibição na plataforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-xs font-semibold">Nome Completo</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Seu nome completo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-semibold">Email de Acesso</Label>
                      <Input
                        id="email"
                        value={email}
                        disabled
                        className="bg-muted text-muted-foreground"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        O email está vinculado à sua conta e assinatura
                      </p>
                    </div>
                    <Button onClick={handleUpdateProfile} disabled={saving} size="sm">
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Salvar Alterações
                    </Button>
                  </CardContent>
                </Card>

                {/* Mapa de Calor Estilo GitHub: Estatísticas de Estudo Real */}
                {user && (
                  <GitHubStudyHeatmap userId={user.id} />
                )}
              </TabsContent>

              {/* Aba: Segurança */}
              <TabsContent value="security" className="space-y-6 animate-fade-in mt-0">
                {/* Alterar Senha */}
                <Card className="border-border/60 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Alterar Senha de Acesso</CardTitle>
                    <CardDescription className="text-xs">
                      Mantenha sua conta protegida com uma senha forte
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 max-w-lg">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="text-xs font-semibold">Nova Senha</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-xs font-semibold">Confirmar Nova Senha</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a nova senha"
                      />
                    </div>
                    <Button onClick={handleUpdatePassword} disabled={saving} size="sm">
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Atualizar Senha
                    </Button>
                  </CardContent>
                </Card>

                {/* Autenticação em Dois Fatores */}
                {user && <TwoFactorAuth userId={user.id} />}
              </TabsContent>

              {/* Aba: Preferências */}
              <TabsContent value="preferences" className="space-y-6 animate-fade-in mt-0">
                {/* Preferências de Som */}
                <Card className="border-border/60 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Volume2 className="h-5 w-5 text-primary" />
                      Efeitos Sonoros & Feedback
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Ative ou desative o feedback sonoro de acertos e streaks
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                      <div className="space-y-0.5 pr-4">
                        <Label htmlFor="sound-toggle" className="text-sm font-semibold cursor-pointer">
                          Sons Interativos
                        </Label>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Tocar sons motivacionais ao acertar questões, completar streaks e bater metas diárias
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
                          toast.success(checked ? "Efeitos sonoros ativados" : "Efeitos sonoros silenciados");
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Aba: Ferramentas de Administrador (apenas admins) */}
              {isAdmin && (
                <TabsContent value="admin" className="space-y-6 animate-fade-in mt-0">
                  <Card className="border-primary/30 bg-primary/5 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2 text-primary">
                        <Shield className="h-5 w-5" />
                        Painel Administrativo
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Acesso com privilégios de gestão da plataforma Aprendify
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button 
                        onClick={() => navigate("/admin/users")} 
                        className="w-full justify-between"
                        variant="outline"
                      >
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          Gerenciar Usuários & Assinaturas
                        </span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Conceda planos, modifique permissões de criador e acompanhe usuários cadastrados.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </motion.div>
        </PageLoader>
      </main>
    </div>
  );
};

export const SettingsPage = Settings;
export default Settings;
