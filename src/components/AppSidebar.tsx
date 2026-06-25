import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Brain,
  ClipboardList,
  PenLine,
  Calendar,
  CheckSquare,
  FileText,
  Layers,
  BarChart3,
  Trophy,
  CreditCard,
  Settings,
  MessageSquarePlus,
  Shield,
  Upload,
  Users,
  Settings2,
  Bell,
  Sparkles,
  BookOpen,
  RefreshCw,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard };

const principal: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Banco de Questões", url: "/questions", icon: Brain },
  { title: "Simulados", url: "/simulados", icon: ClipboardList },
  { title: "Redação", url: "/essays", icon: PenLine },
];

const ferramentas: NavItem[] = [
  { title: "Plano de Estudos", url: "/schedule", icon: Calendar },
  { title: "Tarefas", url: "/tasks", icon: CheckSquare },
  { title: "Anotações", url: "/notes", icon: FileText },
  { title: "Flashcards", url: "/flashcards", icon: Layers },
  { title: "Revisar Erros", url: "/review-errors", icon: RefreshCw },
];

const analise: NavItem[] = [
  { title: "Desempenho", url: "/statistics", icon: BarChart3 },
  { title: "Conquistas", url: "/achievements", icon: Trophy },
];

const conta: NavItem[] = [
  { title: "Assinatura", url: "/subscription", icon: CreditCard },
  { title: "Configurações", url: "/settings", icon: Settings },
  { title: "Feedback", url: "/feedback", icon: MessageSquarePlus },
];

const admin: NavItem[] = [
  { title: "Importar Questões", url: "/admin/import", icon: Upload },
  { title: "Gerenciar Usuários", url: "/admin/users", icon: Users },
  { title: "Gerenciar Questões", url: "/admin/questions", icon: Settings2 },
  { title: "Notificações", url: "/admin/notifications", icon: Bell },
  { title: "Feedbacks", url: "/admin/feedback", icon: MessageSquarePlus },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      setIsAdmin(!!roleData?.some((r) => r.role === "admin"));
      setIsCreator(!!roleData?.some((r) => r.role === "creator"));
    };
    load();
  }, []);

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  const renderGroup = (label: string, items: NavItem[]) => (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <NavLink to={item.url} className="flex items-center gap-2">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2.5 px-2 py-2 group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shrink-0 group-hover:shadow-lg group-hover:scale-105 transition-all">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-gradient">Aprendify</span>
          )}
        </button>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("Principal", principal)}
        {renderGroup("Ferramentas", ferramentas)}
        {renderGroup("Análise", analise)}
        {isCreator &&
          renderGroup("Criador", [
            { title: "Painel Criador", url: "/creator", icon: Sparkles },
          ])}
        {renderGroup("Conta", conta)}
        {isAdmin && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-amber-600 dark:text-amber-400">
                <Shield className="h-3 w-3 mr-1 inline" /> Admin
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {admin.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        {!collapsed && <span className="truncate">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export default AppSidebar;
