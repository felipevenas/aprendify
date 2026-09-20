import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Calendar,
  CheckSquare,
  FileText,
  Layers,
  LayoutDashboard,
  MessageSquarePlus,
  PenTool,
  RotateCcw,
  Settings2,
  Shield,
  Trophy,
  Upload,
  Users,
  Calculator,
  GraduationCap,
  Target,
} from "lucide-react";

export type SidebarItem = {
  name: string;
  path: string;
  icon: LucideIcon;
};

export type SidebarGroup = {
  title: string;
  icon: LucideIcon;
  items: readonly SidebarItem[];
};

export const SIDEBAR_GROUPS: readonly SidebarGroup[] = [
  {
    title: "Estudos",
    icon: GraduationCap,
    items: [
      { name: "Painel Geral", path: "/dashboard", icon: LayoutDashboard },
      { name: "Cronograma", path: "/schedule", icon: Calendar },
      { name: "Minhas Tarefas", path: "/tasks", icon: CheckSquare },
      { name: "Minhas Anotações", path: "/notes", icon: FileText },
    ],
  },
  {
    title: "Prática",
    icon: Target,
    items: [
      { name: "Banco de Questões", path: "/questions", icon: BookOpen },
      { name: "Simulados ENEM", path: "/simulados", icon: Trophy },
      { name: "Caderno de Erros", path: "/review-errors", icon: RotateCcw },
      { name: "Redações", path: "/essays", icon: PenTool },
      { name: "Flashcards", path: "/flashcards", icon: Layers },
      { name: "Simulador SISU", path: "/calculadora-tri", icon: Calculator },
    ],
  },
  {
    title: "Conexões",
    icon: Users,
    items: [{ name: "Amigos", path: "/amigos", icon: Users }],
  },
] as const;

export const ADMIN_SIDEBAR_GROUP: SidebarGroup = {
  title: "Administração",
  icon: Shield,
  items: [
    { name: "Notificações", path: "/admin/notifications", icon: Shield },
    { name: "Gerenciar Feedbacks", path: "/admin/feedback", icon: MessageSquarePlus },
    { name: "Gerenciar Questões", path: "/admin/questions", icon: Settings2 },
    { name: "Importar Questões", path: "/admin/import", icon: Upload },
    { name: "Gerenciar Usuários", path: "/admin/users", icon: Users },
  ],
};

export const SIDEBAR_WIDTHS = {
  expanded: "16rem",
  collapsed: "5rem",
} as const;
