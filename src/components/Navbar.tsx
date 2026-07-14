import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
import { 
  Settings, LogOut, Moon, Sun, BookOpen, Crown, CreditCard, Sparkles, Trophy, Shield, Menu, MessageSquarePlus,
  LayoutDashboard, Calendar, CheckSquare, FileText, BarChart3, FileSpreadsheet, Layers, PenTool, Upload, Users, Settings2
} from "lucide-react";
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
 * Navbar adaptativa que renderiza a Sidebar Fixa (Desktop),
 * o Header Superior Minimalista (Topbar) e a gaveta responsiva (Mobile).
 */
const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isPremium, isLoading, planType } = usePremiumContext();
  const { streakData, loading: streakLoading } = useStreakContext();
  const isCreator = planType === "creator";

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

        const fullName = profile?.full_name || user.email?.split("@")[0] || "Usuário";
        const firstName = fullName.split(" ")[0];
        setUserName(firstName);

        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        
        setIsAdmin(roleData?.role === "admin");
      }
    };

    fetchUser();

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

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (!user) return null;

  // Definição dos links e categorias da Sidebar
  const menuGroups = [
    {
      title: "Estudos",
      items: [
        { name: "Painel Geral", path: "/dashboard", icon: LayoutDashboard },
        { name: "Cronograma", path: "/schedule", icon: Calendar },
        { name: "Minhas Tarefas", path: "/tasks", icon: CheckSquare },
        { name: "Minhas Anotações", path: "/notes", icon: FileText },
        { name: "Estatísticas", path: "/statistics", icon: BarChart3 },
      ]
    },
    {
      title: "Prática",
      items: [
        { name: "Banco de Questões", path: "/questions", icon: BookOpen },
        { name: "Flashcards", path: "/flashcards", icon: Layers },
        { name: "Redações", path: "/essays", icon: PenTool },
      ]
    },
    {
      title: "Conta & Ajuda",
      items: [
        { name: "Configurações", path: "/settings", icon: Settings },
        { name: "Minha Assinatura", path: "/subscription", icon: CreditCard },
        { name: "Enviar Feedback", path: "/feedback", icon: MessageSquarePlus },
      ]
    }
  ];

  const adminGroup = {
    title: "Administração",
    items: [
      { name: "Notificações", path: "/admin/notifications", icon: Shield },
      { name: "Gerenciar Feedbacks", path: "/admin/feedback", icon: MessageSquarePlus },
      { name: "Gerenciar Questões", path: "/admin/questions", icon: Settings2 },
      { name: "Importar Questões", path: "/admin/import", icon: Upload },
      { name: "Gerenciar Usuários", path: "/admin/users", icon: Users },
    ]
  };

  return (
    <>
      {/* ─── SIDEBAR FIXA (DESKTOP) ────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 fixed left-0 top-0 bottom-0 bg-card border-r border-border/50 z-40 sidebar-desktop shadow-sm">
        {/* Topo da Sidebar - Logo */}
        <div 
          className="flex items-center gap-2.5 px-6 h-16 border-b border-border/50 cursor-pointer flex-shrink-0"
          onClick={() => navigate("/dashboard")}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-md">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-gradient">
            Aprendify
          </span>
        </div>

        {/* Links da Sidebar */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {menuGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1.5">
              <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{group.title}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                        isActive ? "sidebar-link-active" : "sidebar-link-inactive"
                      }`}
                    >
                      <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-medium">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          
          {/* Seção de Admin na Sidebar */}
          {isAdmin && (
            <div className="space-y-1.5 pt-4 border-t border-border/50">
              <p className="px-3 text-[10px] font-bold text-primary dark:text-primary-light uppercase tracking-wider">{adminGroup.title}</p>
              <div className="space-y-0.5">
                {adminGroup.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                        isActive ? "sidebar-link-active" : "sidebar-link-inactive"
                      }`}
                    >
                      <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="font-medium">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé da Sidebar - Dados do Usuário */}
        <div className="p-4 border-t border-border/50 bg-muted/20">
          <div className="flex items-center gap-3 mb-3 px-2">
            <Avatar className="h-9 w-9 ring-2 ring-primary/20 ring-offset-2 ring-offset-background flex-shrink-0">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary-dark text-primary-foreground text-xs font-bold">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 gap-3 rounded-lg"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-xs font-semibold">Sair da Conta</span>
          </Button>
        </div>
      </aside>

      {/* ─── HEADER / TOPBAR MINIMALISTA (DESKTOP & MOBILE) ───────────────── */}
      <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl z-30 flex items-center shadow-sm">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Lado Esquerdo - Hambúrguer e Logo no Mobile */}
        <div className="flex items-center gap-2 lg:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 overflow-hidden flex flex-col">
              {/* Header do Menu Mobile */}
              <div className="p-4 border-b border-border/50 bg-muted/30 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold text-gradient">Aprendify</span>
              </div>
              
              {/* Links da Sidebar Mobile */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {menuGroups.map((group, groupIdx) => (
                  <div key={groupIdx} className="space-y-1.5">
                    <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{group.title}</p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <SheetClose asChild key={item.path}>
                          <button
                            onClick={() => navigate(item.path)}
                            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                              location.pathname === item.path ? "sidebar-link-active" : "sidebar-link-inactive"
                            }`}
                          >
                            <item.icon className="h-4 w-4" />
                            <span className="font-medium">{item.name}</span>
                          </button>
                        </SheetClose>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Seção de Admin no Mobile */}
                {isAdmin && (
                  <div className="space-y-1.5 pt-4 border-t border-border/50">
                    <p className="px-3 text-[10px] font-bold text-primary uppercase tracking-wider">{adminGroup.title}</p>
                    <div className="space-y-0.5">
                      {adminGroup.items.map((item) => (
                        <SheetClose asChild key={item.path}>
                          <button
                            onClick={() => navigate(item.path)}
                            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                              location.pathname === item.path ? "sidebar-link-active" : "sidebar-link-inactive"
                            }`}
                          >
                            <item.icon className="h-4 w-4" />
                            <span className="font-medium">{item.name}</span>
                          </button>
                        </SheetClose>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Rodapé Mobile - Perfil e Logout */}
              <div className="p-4 border-t border-border/50 bg-muted/30">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary-dark text-primary-foreground text-xs font-bold">
                      {getInitials(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
                <SheetClose asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleLogout}
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 gap-3 rounded-lg"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-xs font-semibold">Sair da Conta</span>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
          
          {/* Logo Mobile */}
          <div onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md">
              <BookOpen className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-md font-bold text-gradient">Aprendify</span>
          </div>
        </div>

        {/* Lado Direito - Widgets Globais */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 ml-auto">
          {/* Indicador de Streak */}
          {!streakLoading && streakData && (
            <StreakIndicator
              currentStreak={streakData.currentStreak}
              questionsToday={streakData.questionsToday}
              streakCompletedToday={streakData.streakCompletedToday}
              longestStreak={streakData.longestStreak}
            />
          )}

          {/* Ícone do Plano Premium */}
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

          {/* Dropdown do Perfil */}
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
        </div>
      </header>

      {/* Modal de Premium */}
      <PremiumModal open={showPremiumModal} onOpenChange={setShowPremiumModal} isPremium={isPremium} />
    </>
  );
};

export default Navbar;
