import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, LogOut, Moon, Sun, BookOpen, Crown, CreditCard, Sparkles, Trophy, Shield, Menu, X, MessageSquarePlus } from "lucide-react";
import { useTheme } from "next-themes";
import { usePremiumContext } from "@/contexts/PremiumContext";
import { PremiumModal } from "@/components/PremiumModal";
import { useStreakContext } from "@/contexts/StreakContext";
import { StreakIndicator } from "@/components/streak/StreakIndicator";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";

/**
 * Navbar minimalista com perfil do usuário e tema dark/light
 * Exibe nome do usuário, avatar e dropdown com opções de configurações e logout
 * Usa StreakContext para atualização em tempo real do indicador de streak
 */
const Navbar = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isPremium, isLoading, planType } = usePremiumContext();
  // Usa o contexto global de streak para atualizações em tempo real
  const { streakData, loading: streakLoading } = useStreakContext();
  const isCreator = planType === "creator";
  useEffect(() => {
    // Busca usuário atual
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        // Tenta pegar o primeiro nome do perfil, senão usa o email
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

        // Extrai apenas o primeiro nome
        const fullName = profile?.full_name || user.email?.split("@")[0] || "Usuário";
        const firstName = fullName.split(" ")[0];
        setUserName(firstName);

        // Verifica se é admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        
        setIsAdmin(roleData?.role === "admin");
      }
    };

    fetchUser();

    // Escuta mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // Pega iniciais do nome para o avatar
  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (!user) return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group flex-shrink-0"
            onClick={() => navigate("/dashboard")}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-300">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-primary-foreground" />
            </div>
            <span className="text-lg sm:text-xl md:text-2xl font-bold text-gradient">
              Aprendify
            </span>
          </div>

          {/* Menu Desktop */}
          <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 md:gap-3">
            {/* Indicador de Streak */}
            {!streakLoading && streakData && (
              <StreakIndicator
                currentStreak={streakData.currentStreak}
                questionsToday={streakData.questionsToday}
                streakCompletedToday={streakData.streakCompletedToday}
                longestStreak={streakData.longestStreak}
              />
            )}
            {/* Ícone do Plano */}
            {!isLoading && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => isCreator ? navigate("/creator") : isPremium ? setShowPremiumModal(true) : navigate("/subscription")}
                      className="rounded-full h-9 w-9 sm:h-10 sm:w-10 transition-all duration-300 hover:scale-105"
                    >
                      {isCreator ? (
                        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                      ) : isPremium ? (
                        <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                      ) : (
                        <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/50" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isCreator ? "Plano Criador" : isPremium ? "Plano Premium" : "Plano Gratuito"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Sino de Notificações */}
            <NotificationBell />

            {/* Dropdown do perfil */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-1.5 sm:gap-2 hover:bg-primary/10 rounded-full pr-2.5 sm:pr-3 md:pr-4 pl-1 sm:pl-1.5 md:pl-2 h-9 sm:h-10 transition-all duration-300"
                >
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8 ring-2 ring-primary/20 ring-offset-1 sm:ring-offset-2 ring-offset-background">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary-dark text-primary-foreground text-xs sm:text-sm font-semibold">
                      {getInitials(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden md:inline max-w-[100px] truncate">{userName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 p-2 rounded-xl shadow-xl border-border/50">
                <div className="px-3 py-3 bg-muted/50 rounded-lg mb-2">
                  <p className="text-sm font-semibold">Olá, {userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>

                {/* Toggle de Tema */}
                <div 
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                <div className="flex items-center">
                    {theme === "dark" ? (
                      <Moon className="h-4 w-4 mr-3 text-foreground/70" />
                    ) : (
                      <Sun className="h-4 w-4 mr-3 text-foreground/70" />
                    )}
                    <span className="text-sm">Tema Escuro</span>
                  </div>
                  <Switch 
                    checked={theme === "dark"} 
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  />
                </div>

                <DropdownMenuSeparator className="my-2" />

                <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer rounded-lg py-2.5 px-3">
                  <Settings className="h-4 w-4 mr-3 text-foreground/70" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/subscription")} className="cursor-pointer rounded-lg py-2.5 px-3">
                  <CreditCard className="h-4 w-4 mr-3 text-foreground/70" />
                  Minha Assinatura
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/achievements")} className="cursor-pointer rounded-lg py-2.5 px-3">
                  <Trophy className="h-4 w-4 mr-3 text-foreground/70" />
                  Conquistas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/feedback")} className="cursor-pointer rounded-lg py-2.5 px-3">
                  <MessageSquarePlus className="h-4 w-4 mr-3 text-foreground/70" />
                  Enviar Feedback
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="my-2" />
                    <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Ferramentas de Admin</p>
                    <DropdownMenuItem onClick={() => navigate("/admin/notifications")} className="cursor-pointer rounded-lg py-2.5 px-3">
                      <Shield className="h-4 w-4 mr-3 text-primary" />
                      <span className="text-primary font-medium">Gerenciar Notificações</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/admin/feedback")} className="cursor-pointer rounded-lg py-2.5 px-3">
                      <MessageSquarePlus className="h-4 w-4 mr-3 text-primary" />
                      <span className="text-primary font-medium">Gerenciar Feedbacks</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="my-2" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg py-2.5 px-3"
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Menu Mobile Hamburger */}
          <div className="flex sm:hidden items-center gap-1.5">
            {/* Streak Mobile - compacto */}
            {!streakLoading && streakData && (
              <StreakIndicator
                currentStreak={streakData.currentStreak}
                questionsToday={streakData.questionsToday}
                streakCompletedToday={streakData.streakCompletedToday}
                longestStreak={streakData.longestStreak}
              />
            )}
            
            {/* Sino de Notificações Mobile */}
            <NotificationBell />
            
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-80 p-0 overflow-hidden">
                <div className="flex flex-col h-full">
                  {/* Header do Menu Mobile */}
                  <div className="p-4 border-b border-border/50 bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11 ring-2 ring-primary/20 ring-offset-2 ring-offset-background flex-shrink-0">
                        <AvatarImage src={user.user_metadata?.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary-dark text-primary-foreground text-sm font-semibold">
                          {getInitials(userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">Olá, {userName}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo do Menu */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {/* Ícone do Plano Mobile */}
                    {!isLoading && (
                      <SheetClose asChild>
                        <button
                          onClick={() => isCreator ? navigate("/creator") : isPremium ? setShowPremiumModal(true) : navigate("/subscription")}
                          className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-accent transition-colors"
                        >
                          {isCreator ? (
                            <Sparkles className="h-5 w-5 text-purple-500" />
                          ) : isPremium ? (
                            <Crown className="h-5 w-5 text-amber-500" />
                          ) : (
                            <Crown className="h-5 w-5 text-muted-foreground/50" />
                          )}
                          <span className="font-medium">{isCreator ? "Plano Criador" : isPremium ? "Plano Premium" : "Plano Gratuito"}</span>
                        </button>
                      </SheetClose>
                    )}

                    {/* Toggle de Tema Mobile */}
                    <div 
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    >
                      <div className="flex items-center gap-3">
                        {theme === "dark" ? (
                          <Moon className="h-5 w-5 text-foreground/70" />
                        ) : (
                          <Sun className="h-5 w-5 text-foreground/70" />
                        )}
                        <span className="font-medium">Tema Escuro</span>
                      </div>
                      <Switch 
                        checked={theme === "dark"} 
                        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                      />
                    </div>

                    <div className="h-px bg-border/50 my-2" />

                    <SheetClose asChild>
                      <button
                        onClick={() => navigate("/settings")}
                        className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <Settings className="h-5 w-5 text-foreground/70" />
                        <span className="font-medium">Configurações</span>
                      </button>
                    </SheetClose>

                    <SheetClose asChild>
                      <button
                        onClick={() => navigate("/subscription")}
                        className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <CreditCard className="h-5 w-5 text-foreground/70" />
                        <span className="font-medium">Minha Assinatura</span>
                      </button>
                    </SheetClose>

                    <SheetClose asChild>
                      <button
                        onClick={() => navigate("/achievements")}
                        className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <Trophy className="h-5 w-5 text-foreground/70" />
                        <span className="font-medium">Conquistas</span>
                      </button>
                    </SheetClose>

                    <SheetClose asChild>
                      <button
                        onClick={() => navigate("/feedback")}
                        className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-accent transition-colors"
                      >
                        <MessageSquarePlus className="h-5 w-5 text-foreground/70" />
                        <span className="font-medium">Enviar Feedback</span>
                      </button>
                    </SheetClose>

                    {isAdmin && (
                      <>
                        <div className="h-px bg-border/50 my-2" />
                        <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Ferramentas de Admin</p>
                        <SheetClose asChild>
                          <button
                            onClick={() => navigate("/admin/notifications")}
                            className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-accent transition-colors"
                          >
                            <Shield className="h-5 w-5 text-primary" />
                            <span className="font-medium text-primary">Gerenciar Notificações</span>
                          </button>
                        </SheetClose>
                        <SheetClose asChild>
                          <button
                            onClick={() => navigate("/admin/feedback")}
                            className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-accent transition-colors"
                          >
                            <MessageSquarePlus className="h-5 w-5 text-primary" />
                            <span className="font-medium text-primary">Gerenciar Feedbacks</span>
                          </button>
                        </SheetClose>
                      </>
                    )}
                  </div>

                  {/* Footer com Logout */}
                  <div className="p-4 border-t border-border/50 bg-muted/30">
                    <SheetClose asChild>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                      >
                        <LogOut className="h-5 w-5" />
                        <span className="font-medium">Sair</span>
                      </button>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Modal de Premium */}
      <PremiumModal open={showPremiumModal} onOpenChange={setShowPremiumModal} isPremium={isPremium} />
    </nav>
  );
};

export default Navbar;
