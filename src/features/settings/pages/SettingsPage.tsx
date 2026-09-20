import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  Upload,
  Loader2,
  Shield,
  Users,
  ChevronRight,
  Volume2,
  UserRound,
  LockKeyhole,
  SlidersHorizontal,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import TwoFactorAuth from "../components/TwoFactorAuth";
import { useSoundPreferences } from "@/hooks/useSoundPreferences";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { PageLoader } from "@/components/ui/page-loader";
import { GitHubStudyHeatmap } from "@/features/gamification/components/GitHubStudyHeatmap";
import { usePremiumContext } from "@/contexts/PremiumContext";
import { getPlanVisual } from "@/features/subscription/catalog";
import { getProfileTab, type ProfileTab } from "../profileTabs";

const StatisticsPanel = lazy(() => import("@/features/statistics/pages/StatisticsPage"));
const SubscriptionPanel = lazy(() => import("@/features/subscription/pages/SubscriptionPage"));

const TAB_LABELS: Record<ProfileTab, string> = {
  profile: "Meu Perfil",
  statistics: "Estatísticas",
  subscription: "Minha Assinatura",
  security: "Segurança",
  preferences: "Preferências",
  admin: "Administração",
};

const TAB_ICONS: Record<ProfileTab, typeof UserRound> = {
  profile: UserRound,
  statistics: TrendingUp,
  subscription: CreditCard,
  security: LockKeyhole,
  preferences: SlidersHorizontal,
  admin: Shield,
};

const PanelFallback = () => (
  <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-border/60 bg-card" aria-busy="true">
    <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Carregando conteúdo" />
  </div>
);

const Settings = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const { isPremium, isLoading: premiumLoading, planType, subscriptionEnd } = usePremiumContext();
  const activeTab = getProfileTab(searchParams.get("tab"), isAdmin);
  const planVisual = getPlanVisual(premiumLoading ? null : planType, premiumLoading ? false : isPremium);

  useEffect(() => {
    if (!loading && !isAdmin && searchParams.get("tab") === "admin") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", "profile");
      setSearchParams(nextParams, { replace: true });
    }
  }, [isAdmin, loading, searchParams, setSearchParams]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate("/auth");
        return;
      }

      setUser(currentUser);
      setEmail(currentUser.email || "");
      setAvatarUrl(currentUser.user_metadata?.avatar_url || "");

      const [{ data: profile }, { data: roleData }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", currentUser.id).single(),
        supabase.from("user_roles").select("role").eq("user_id", currentUser.id).eq("role", "admin").maybeSingle(),
      ]);

      setFullName(profile?.full_name || "");
      setIsAdmin(!!roleData);
      setLoading(false);
    };

    void checkAuth();
  }, [navigate]);

  const firstName = useMemo(() => fullName.trim().split(/\s+/)[0] || "Estudante", [fullName]);

  const handleTabChange = (value: string) => {
    const nextTab = getProfileTab(value, isAdmin);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
      if (error) throw error;

      await supabase.auth.updateUser({ data: { full_name: fullName } });
      toast.success("Perfil atualizado com sucesso!");
    } catch (error: unknown) {
      console.error("Erro ao atualizar perfil:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar perfil");
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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("Senha atualizada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      console.error("Erro ao atualizar senha:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar senha");
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
      const { error: uploadError } = await supabase.storage.from("user-content").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("user-content").getPublicUrl(filePath);
      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      setAvatarUrl(publicUrl);
      toast.success("Foto de perfil atualizada!");
    } catch (error: unknown) {
      console.error("Erro ao atualizar avatar:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar foto");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const goToTab = (tab: ProfileTab) => handleTabChange(tab);

  return (
    <div className="min-h-screen bg-background app-layout-container">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:py-10">
        <PageLoader loading={loading}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            <section className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full p-[3px] sm:h-24 sm:w-24 ${planVisual.ringClassName}`}>
                  <Avatar className="h-full w-full border-4 border-background ring-0">
                    <AvatarImage src={avatarUrl} alt={`Foto de ${fullName || "usuário"}`} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary-dark text-xl font-bold text-primary-foreground sm:text-2xl">
                      {getInitials(fullName)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-primary">Perfil Aprendify</p>
                  <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Olá, {firstName}</h1>
                  <p className="truncate text-sm text-muted-foreground">{email}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{planVisual.label}</span>
                    <span className="text-xs text-muted-foreground">{planVisual.billingLabel}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
                <Button variant="outline" className="gap-2" onClick={() => goToTab("statistics")}>
                  <TrendingUp className="h-4 w-4" /> Estatísticas
                </Button>
                <Button className="gap-2" onClick={() => goToTab("subscription")}>
                  <CreditCard className="h-4 w-4" /> Assinatura
                </Button>
              </div>
            </section>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
              <div className="overflow-x-auto rounded-xl pb-1">
                <TabsList className="flex h-auto w-max min-w-full justify-start gap-1 rounded-xl border border-border/50 bg-muted/70 p-1 sm:w-fit sm:min-w-0 sm:flex-wrap">
                  {(Object.keys(TAB_LABELS) as ProfileTab[]).map((tab) => {
                    if (tab === "admin" && !isAdmin) return null;
                    const Icon = TAB_ICONS[tab];
                    return (
                      <TabsTrigger
                        key={tab}
                        value={tab}
                        className="shrink-0 gap-2 rounded-lg px-3 py-2 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:px-3.5 sm:text-sm"
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span>{TAB_LABELS[tab]}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

                <TabsContent value="profile" className="mt-0 space-y-6">
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                    <Card className="border-border/60 shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base">Dados do perfil</CardTitle>
                        <CardDescription>Atualize as informações que aparecem no painel e no ranking.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="flex flex-col gap-4 rounded-xl border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-center">
                          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full p-[2px] ${planVisual.ringClassName}`}>
                            <Avatar className="h-full w-full border-2 border-background ring-0">
                              <AvatarImage src={avatarUrl} alt={`Foto de ${fullName || "usuário"}`} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-lg font-bold text-white">{getInitials(fullName)}</AvatarFallback>
                            </Avatar>
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <Label htmlFor="avatar-upload" className="inline-flex cursor-pointer">
                              <span className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Alterar Foto
                              </span>
                            </Label>
                            <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                            <p className="text-xs text-muted-foreground">PNG, JPG ou GIF · máximo de 2MB</p>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="fullName" className="text-xs font-semibold">Nome Completo</Label>
                            <Input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Seu nome completo" />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="email" className="text-xs font-semibold">E-mail de Acesso</Label>
                            <Input id="email" value={email} disabled className="bg-muted text-muted-foreground" />
                            <p className="text-[11px] text-muted-foreground">O e-mail está vinculado à sua conta e assinatura.</p>
                          </div>
                        </div>
                        <Button onClick={handleUpdateProfile} disabled={saving} size="sm">
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Salvar Alterações
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-gradient-to-br from-primary/[0.06] to-background shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base">Resumo da conta</CardTitle>
                        <CardDescription>Atalhos para acompanhar sua preparação.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <button type="button" onClick={() => goToTab("statistics")} className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                          <span className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-primary" /><span><strong className="block text-sm">Seu desempenho</strong><small className="text-xs text-muted-foreground">Veja evolução e pontos de atenção</small></span></span>
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button type="button" onClick={() => goToTab("subscription")} className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                          <span className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-primary" /><span><strong className="block text-sm">Plano atual</strong><small className="text-xs text-muted-foreground">{planVisual.label} · {planVisual.billingLabel}</small></span></span>
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/70 p-3">
                          <CalendarDays className="h-5 w-5 text-primary" />
                          <span><strong className="block text-sm">Acesso à plataforma</strong><small className="text-xs text-muted-foreground">{subscriptionEnd ? `Ativo até ${new Date(subscriptionEnd).toLocaleDateString("pt-BR")}` : "Use seus recursos de estudo todos os dias"}</small></span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {user && <GitHubStudyHeatmap userId={user.id} />}
                </TabsContent>

                <TabsContent value="statistics" className="mt-0">
                  <Suspense fallback={<PanelFallback />}>
                    <StatisticsPanel embedded />
                  </Suspense>
                </TabsContent>

                <TabsContent value="subscription" className="mt-0">
                  <Suspense fallback={<PanelFallback />}>
                    <SubscriptionPanel embedded />
                  </Suspense>
                </TabsContent>

                <TabsContent value="security" className="mt-0 space-y-6">
                  <Card className="border-border/60 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">Alterar Senha de Acesso</CardTitle>
                      <CardDescription>Mantenha sua conta protegida com uma senha forte.</CardDescription>
                    </CardHeader>
                    <CardContent className="max-w-lg space-y-4">
                      <div className="space-y-2"><Label htmlFor="newPassword" className="text-xs font-semibold">Nova Senha</Label><Input id="newPassword" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Mínimo 6 caracteres" /></div>
                      <div className="space-y-2"><Label htmlFor="confirmPassword" className="text-xs font-semibold">Confirmar Nova Senha</Label><Input id="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a nova senha" /></div>
                      <Button onClick={handleUpdatePassword} disabled={saving} size="sm">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Atualizar Senha</Button>
                    </CardContent>
                  </Card>
                  {user && <TwoFactorAuth userId={user.id} />}
                </TabsContent>

                <TabsContent value="preferences" className="mt-0 space-y-6">
                  <Card className="border-border/60 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base"><Volume2 className="h-5 w-5 text-primary" /> Efeitos Sonoros & Feedback</CardTitle>
                      <CardDescription>Ative ou desative o feedback sonoro de acertos e streaks.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-muted/30 p-3">
                        <div className="space-y-0.5"><Label htmlFor="sound-toggle" className="cursor-pointer text-sm font-semibold">Sons Interativos</Label><p className="text-xs leading-relaxed text-muted-foreground">Tocar sons ao acertar questões, completar streaks e bater metas diárias.</p></div>
                        <Switch id="sound-toggle" checked={soundEnabled} onCheckedChange={(checked) => { setSoundEnabled(checked); if (checked) playClickSound(); toast.success(checked ? "Efeitos sonoros ativados" : "Efeitos sonoros silenciados"); }} />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {isAdmin && (
                  <TabsContent value="admin" className="mt-0 space-y-6">
                    <Card className="border-primary/30 bg-primary/5 shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base text-primary"><Shield className="h-5 w-5" /> Painel Administrativo</CardTitle>
                        <CardDescription>Acesso com privilégios de gestão da plataforma Aprendify.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Button onClick={() => navigate("/admin/users")} className="w-full justify-between" variant="outline">
                          <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Gerenciar Usuários & Assinaturas</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <p className="text-xs text-muted-foreground">Conceda planos, modifique permissões de criador e acompanhe usuários cadastrados.</p>
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
