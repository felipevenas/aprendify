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

const mainNavItems = [
  { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { title: "Banco de Questões", path: "/questions", icon: Brain },
  { title: "Simulados", path: "/simulados", icon: ClipboardList },
  { title: "Redação", path: "/essays", icon: PenLine },
  { title: "Flashcards", path: "/flashcards", icon: Layers },
];

const studyToolItems = [
  { title: "Cronograma", path: "/schedule", icon: Calendar },
  { title: "Tarefas", path: "/tasks", icon: CheckSquare },
  { title: "Anotações", path: "/notes", icon: FileText },
];

const analyticsItems = [
  { title: "Desempenho", path: "/statistics", icon: BarChart3 },
  { title: "Revisão de Erros", path: "/review-errors", icon: AlertTriangle },
  { title: "Conquistas", path: "/achievements", icon: Trophy },
];

const adminItems = [
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

  const renderNavGroup = (items: typeof mainNavItems, label: string) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton asChild isActive={location.pathname === item.path}>
                <NavLink
                  to={item.path}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-accent"
                  activeClassName="bg-primary/10 text-primary font-medium"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-border/50">
        {/* Header: Logo */}
        <SidebarHeader className="px-4 py-4">
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => navigate("/dashboard")}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-300 shrink-0">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="text-xl font-bold text-gradient">Aprendify</span>
            )}
          </div>
        </SidebarHeader>

        {/* Streak + Notifications (compact) */}
        {!collapsed && (
          <div className="px-4 pb-3 flex items-center gap-2">
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
                className="p-1.5 rounded-full hover:bg-accent transition-colors"
              >
                {isCreator ? (
                  <Sparkles className="h-4 w-4 text-purple-500" />
                ) : isPremium ? (
                  <Crown className="h-4 w-4 text-amber-500" />
                ) : (
                  <Crown className="h-4 w-4 text-muted-foreground/50" />
                )}
              </button>
            )}
          </div>
        )}

        <SidebarContent>
          {renderNavGroup(mainNavItems, "Principal")}
          {renderNavGroup(studyToolItems, "Ferramentas")}
          {renderNavGroup(analyticsItems, "Análise")}

          {/* Settings & Account */}
          <SidebarGroup>
            <SidebarGroupLabel>Conta</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === "/settings"}>
                    <NavLink to="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-accent" activeClassName="bg-primary/10 text-primary font-medium">
                      <Settings className="h-4 w-4 shrink-0" />
                      <span>Configurações</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === "/subscription"}>
                    <NavLink to="/subscription" className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-accent" activeClassName="bg-primary/10 text-primary font-medium">
                      <CreditCard className="h-4 w-4 shrink-0" />
                      <span>Assinatura</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === "/feedback"}>
                    <NavLink to="/feedback" className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-accent" activeClassName="bg-primary/10 text-primary font-medium">
                      <MessageSquarePlus className="h-4 w-4 shrink-0" />
                      <span>Feedback</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Admin section */}
          {isAdmin && renderNavGroup(adminItems, "Admin")}
        </SidebarContent>

        {/* Footer: User + Theme + Logout */}
        <SidebarFooter className="px-3 pb-4 space-y-2">
          <SidebarSeparator />

          {/* Theme toggle */}
          {!collapsed && (
            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <div className="flex items-center gap-2">
                {theme === "dark" ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm">Tema Escuro</span>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
            </div>
          )}

          {/* User profile */}
          {user && (
            <div className="flex items-center gap-3 px-3 py-2">
              <Avatar className="h-8 w-8 ring-2 ring-primary/20 ring-offset-1 ring-offset-background shrink-0">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary-dark text-primary-foreground text-xs font-semibold">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              )}
            </div>
          )}

          {/* Logout */}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <PremiumModal open={showPremiumModal} onOpenChange={setShowPremiumModal} isPremium={isPremium} />
    </>
  );
}

export default AppSidebar;
