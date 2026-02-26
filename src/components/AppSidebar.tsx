import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useTheme } from "next-themes";
import { usePremiumContext } from "@/contexts/PremiumContext";
import { useStreakContext } from "@/contexts/StreakContext";
import { StreakIndicator } from "@/components/streak/StreakIndicator";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PremiumModal } from "@/components/PremiumModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  BookOpen,
  Brain,
  Calendar,
  CheckSquare,
  ClipboardList,
  CreditCard,
  Crown,
  FileText,
  Layers,
  LayoutDashboard,
  LogOut,
  MessageSquarePlus,
  Moon,
  PenLine,
  Settings,
  Shield,
  Sparkles,
  Sun,
  BarChart3,
  Trophy,
  Upload,
  Users,
  Settings2,
  AlertTriangle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = { title: string; path: string; icon: typeof LayoutDashboard };

const mainNavItems: NavItem[] = [
  { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { title: "Banco de Questões", path: "/questions", icon: Brain },
  { title: "Simulados", path: "/simulados", icon: ClipboardList },
  { title: "Redação", path: "/essays", icon: PenLine },
  { title: "Flashcards", path: "/flashcards", icon: Layers },
];

const studyToolItems: NavItem[] = [
  { title: "Cronograma", path: "/schedule", icon: Calendar },
  { title: "Tarefas", path: "/tasks", icon: CheckSquare },
  { title: "Anotações", path: "/notes", icon: FileText },
];

const analyticsItems: NavItem[] = [
  { title: "Desempenho", path: "/statistics", icon: BarChart3 },
  { title: "Revisão de Erros", path: "/review-errors", icon: AlertTriangle },
  { title: "Conquistas", path: "/achievements", icon: Trophy },
];

const accountItems: NavItem[] = [
  { title: "Configurações", path: "/settings", icon: Settings },
  { title: "Assinatura", path: "/subscription", icon: CreditCard },
  { title: "Feedback", path: "/feedback", icon: MessageSquarePlus },
];

const adminItems: NavItem[] = [
  { title: "Importar Questões", path: "/admin/import", icon: Upload },
  { title: "Gerenciar Usuários", path: "/admin/users", icon: Users },
  { title: "Gerenciar Questões", path: "/admin/questions", icon: Settings2 },
  { title: "Notificações", path: "/admin/notifications", icon: Shield },
  { title: "Feedbacks", path: "/admin/feedback", icon: MessageSquarePlus },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const { isPremium, isLoading, planType } = usePremiumContext();
  const { streakData, loading: streakLoading } = useStreakContext();
  const isCreator = planType === "creator";

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
        const fullName = profile?.full_name || user.email?.split("@")[0] || "Usuário";
        setUserName(fullName.split(" ")[0]);
        const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
        setIsAdmin(roleData?.role === "admin");
      }
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUser(session.user);
      else setUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.path;
    const button = (
      <SidebarMenuButton asChild isActive={isActive}>
        <NavLink
          to={item.path}
          className="flex items-center gap-3 rounded-md transition-all duration-200"
          activeClassName="bg-primary/10 text-primary font-medium"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.title}</span>
        </NavLink>
      </SidebarMenuButton>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>
            <SidebarMenuItem>{button}</SidebarMenuItem>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <SidebarMenuItem key={item.path}>{button}</SidebarMenuItem>;
  };

  const renderNavGroup = (items: NavItem[], label: string) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground/60 font-semibold">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>{items.map(renderNavItem)}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar collapsible="icon" className="border-r border-border/30">
        {/* Header */}
        <SidebarHeader className="px-3 py-4">
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => navigate("/dashboard")}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-300 shrink-0">
              <BookOpen className="h-4 w-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Aprendify
              </span>
            )}
          </div>
        </SidebarHeader>

        {/* Quick actions bar */}
        {!collapsed && (
          <div className="px-3 pb-2 flex items-center gap-1.5">
            {!streakLoading && streakData && (
              <StreakIndicator
                currentStreak={streakData.currentStreak}
                questionsToday={streakData.questionsToday}
                streakCompletedToday={streakData.streakCompletedToday}
                longestStreak={streakData.longestStreak}
              />
            )}
            <NotificationBell />
            {!isLoading && (
              <button
                onClick={() => isCreator ? navigate("/creator") : isPremium ? setShowPremiumModal(true) : navigate("/subscription")}
                className="p-1.5 rounded-md hover:bg-accent transition-colors"
              >
                {isCreator ? (
                  <Sparkles className="h-4 w-4 text-purple-500" />
                ) : isPremium ? (
                  <Crown className="h-4 w-4 text-amber-500" />
                ) : (
                  <Crown className="h-4 w-4 text-muted-foreground/40" />
                )}
              </button>
            )}
          </div>
        )}

        <SidebarSeparator className="mx-3 opacity-50" />

        <SidebarContent className="px-1">
          {renderNavGroup(mainNavItems, "Principal")}
          {renderNavGroup(studyToolItems, "Ferramentas")}
          {renderNavGroup(analyticsItems, "Análise")}
          {renderNavGroup(accountItems, "Conta")}
          {isAdmin && (
            <>
              <SidebarSeparator className="mx-3 opacity-50" />
              {renderNavGroup(adminItems, "Admin")}
            </>
          )}
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="px-3 pb-3 space-y-1.5">
          <SidebarSeparator className="opacity-50" />

          {/* Theme toggle */}
          {!collapsed ? (
            <div
              className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                <span>Tema Escuro</span>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                className="scale-90"
              />
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="w-full flex items-center justify-center p-2 rounded-md hover:bg-accent/50 transition-colors"
                >
                  {theme === "dark" ? (
                    <Moon className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Sun className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Alternar tema</TooltipContent>
            </Tooltip>
          )}

          {/* User profile */}
          {user && !collapsed && (
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md">
              <Avatar className="h-7 w-7 ring-1 ring-border shrink-0">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-tight">{userName}</p>
                <p className="text-[11px] text-muted-foreground/70 truncate">{user.email}</p>
              </div>
            </div>
          )}

          {/* Logout */}
          <SidebarMenu>
            <SidebarMenuItem>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      onClick={handleLogout}
                      className="text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      <span>Sair</span>
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sair</TooltipContent>
                </Tooltip>
              ) : (
                <SidebarMenuButton
                  onClick={handleLogout}
                  className="text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Sair</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <PremiumModal open={showPremiumModal} onOpenChange={setShowPremiumModal} isPremium={isPremium} />
    </TooltipProvider>
  );
}

export default AppSidebar;
