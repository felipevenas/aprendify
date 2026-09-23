import { useState, useEffect, createContext, useContext } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LogOut,
  Moon,
  Sun,
  BookOpen,
  Trophy,
  Shield,
  Menu,
  MessageSquarePlus,
  HelpCircle,
  ChevronDown,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  Flame,
} from "lucide-react";
import { useTheme } from "next-themes";
import { usePremiumContext } from "@/contexts/PremiumContext";
import { getAccountPlanVisual, type PlanVisual } from "@/features/subscription/catalog";
import { useStreakContext } from "@/contexts/StreakContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useHelpTooltips } from "@/contexts/HelpTooltipsContext";
import { preloadRoute } from "@/lib/pageLoaders";
import { ADMIN_SIDEBAR_GROUP, SIDEBAR_GROUPS, type SidebarGroup, SIDEBAR_WIDTHS } from "./sidebarNavigation";
import { PROFILE_DROPDOWN_ITEMS } from "./profileMenu";
import { useSocialUnreadCount } from "@/features/friends/hooks/useFriendsHub";

export const NavbarLayoutContext = createContext<boolean>(false);

const SIDEBAR_STORAGE_KEY = "aprendify:sidebar-collapsed";

const getInitialSidebarCollapsed = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
};

interface NavbarProps {
  isLayoutRoot?: boolean;
}

interface PlanAvatarProps {
  userName: string;
  avatarUrl?: string;
  planVisual: PlanVisual;
  sizeClassName: string;
}

const PlanAvatar = ({ userName, avatarUrl, planVisual, sizeClassName }: PlanAvatarProps) => (
  <div
    role="img"
    className={`flex shrink-0 items-center justify-center rounded-full p-[2px] ${sizeClassName} ${planVisual.ringClassName}`}
    title={planVisual.billingLabel}
    aria-label={`${planVisual.label} — ${planVisual.billingLabel}`}
  >
    <Avatar className="h-full w-full border-2 border-background ring-0">
      <AvatarImage src={avatarUrl} alt={`Foto de ${userName}`} />
      <AvatarFallback className="bg-gradient-to-br from-primary to-primary-dark text-primary-foreground text-xs font-semibold">
        {userName.slice(0, 2).toUpperCase() || "US"}
      </AvatarFallback>
    </Avatar>
  </div>
);

const NavbarContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { startTour, tooltips } = useHelpTooltips();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Estudos: true,
    Prática: true,
    Administração: false,
  });
  const { isPremium, isLoading, planType, trialStatus, isSubscribed } = usePremiumContext();
  const { streakData, loading: streakLoading } = useStreakContext();
  const socialUnreadCount = useSocialUnreadCount();
  const planVisual = getAccountPlanVisual(isLoading ? null : planType, isLoading ? false : isPremium, trialStatus, isSubscribed);

  useEffect(() => {
    document.documentElement.dataset.sidebarCollapsed = String(sidebarCollapsed);
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      sidebarCollapsed ? SIDEBAR_WIDTHS.collapsed : SIDEBAR_WIDTHS.expanded,
    );
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));

    return () => {
      delete document.documentElement.dataset.sidebarCollapsed;
      document.documentElement.style.removeProperty("--app-sidebar-width");
    };
  }, [sidebarCollapsed]);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) return;

      setUser(currentUser);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", currentUser.id)
        .single();

      const fullName = profile?.full_name || currentUser.email?.split("@")[0] || "Usuário";
      setUserName(fullName.trim().split(/\s+/)[0]);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .single();

      setIsAdmin(roleData?.role === "admin");
    };

    void fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
        setUser(session.user);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const activeGroup = [...SIDEBAR_GROUPS, ADMIN_SIDEBAR_GROUP].find((group) =>
      group.items.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)),
    );

    if (activeGroup) {
      setExpandedGroups((current) => ({ ...current, [activeGroup.title]: true }));
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!user) return null;

  const isPathActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  const toggleGroup = (groupTitle: string, isExpanded: boolean, isMobile: boolean) => {
    if (sidebarCollapsed && !isMobile) {
      setSidebarCollapsed(false);
      setExpandedGroups((current) => ({ ...current, [groupTitle]: true }));
      return;
    }

    setExpandedGroups((current) => ({ ...current, [groupTitle]: !isExpanded }));
  };

  const renderGroup = (group: SidebarGroup, mobile = false) => {
    const isExpanded = expandedGroups[group.title] ?? true;
    const isCompact = sidebarCollapsed && !mobile;
    const GroupIcon = group.icon;

    if (isCompact) {
      return (
        <div key={group.title} className="space-y-1">
          {group.items.map((item) => {
            const isActive = isPathActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.name}
                onPointerEnter={() => preloadRoute(item.path)}
                onFocus={() => preloadRoute(item.path)}
                aria-current={isActive ? "page" : undefined}
                className={`group flex h-10 w-full items-center justify-center rounded-xl transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <item.icon
                  className={`h-[18px] w-[18px] ${isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
                  aria-hidden="true"
                />
                <span className="sr-only">{item.name}</span>
              </Link>
            );
          })}
        </div>
      );
    }

    return (
      <div key={group.title} className="space-y-1">
        <button
          type="button"
          aria-expanded={!isCompact && isExpanded}
          aria-label={isCompact ? `${isExpanded ? "Abrir" : "Exibir"} ${group.title}` : undefined}
          title={isCompact ? group.title : undefined}
          onClick={() => toggleGroup(group.title, isExpanded, mobile)}
          className={`group flex h-10 w-full items-center rounded-xl text-left text-xs font-semibold transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
            isCompact ? "justify-center px-2" : "justify-between px-3"
          }`}
        >
          <span className={`flex min-w-0 items-center gap-3 ${isCompact ? "justify-center" : ""}`}>
            <GroupIcon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className={isCompact ? "sr-only" : "truncate"}>{group.title}</span>
          </span>
          {!isCompact && (
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${isExpanded ? "rotate-0" : "-rotate-90"}`}
              aria-hidden="true"
            />
          )}
        </button>
        {!isCompact && (
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
              isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
            aria-hidden={!isExpanded}
          >
            <div className="min-h-0 overflow-hidden space-y-1 px-1 pt-1">
              {group.items.map((item) => {
                const isActive = isPathActive(item.path);
                const link = (
                  <Link
                    key={item.path}
                    to={item.path}
                    tabIndex={isExpanded ? undefined : -1}
                    title={isCompact ? item.name : undefined}
                    onPointerEnter={() => preloadRoute(item.path)}
                    onFocus={() => preloadRoute(item.path)}
                    aria-current={isActive ? "page" : undefined}
                    className={`group flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                  >
                    <item.icon
                      className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium">{item.name}</span>
                  </Link>
                );

                return mobile ? <SheetClose asChild key={item.path}>{link}</SheetClose> : link;
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAdminGroup = (mobile = false) => {
    if (!isAdmin) return null;
    return (
      <div className="space-y-1 border-t border-border/60 pt-4">
        {renderGroup(ADMIN_SIDEBAR_GROUP, mobile)}
      </div>
    );
  };

  const renderSupportLink = (mobile = false) => {
    const link = (
      <Link
        to="/feedback"
        aria-label="Falar com Suporte"
        title={sidebarCollapsed && !mobile ? "Falar com Suporte" : undefined}
        className={`flex h-10 w-full items-center rounded-xl border border-primary/20 bg-primary/10 text-sm font-semibold text-primary transition-[background-color,box-shadow] duration-200 hover:bg-primary/15 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
          sidebarCollapsed && !mobile ? "justify-center px-2" : "justify-center gap-2 px-3"
        }`}
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        <span className={sidebarCollapsed && !mobile ? "sr-only" : ""}>Falar com Suporte</span>
      </Link>
    );

    return mobile ? <SheetClose asChild>{link}</SheetClose> : link;
  };

  return (
    <>
      <aside
        aria-label="Navegação principal"
        className="app-sidebar fixed bottom-0 left-0 top-0 z-40 hidden flex-col overflow-hidden border-r border-border/50 bg-card shadow-sm lg:flex"
      >
        <div className={`relative flex h-20 shrink-0 items-center border-b border-border/50 ${sidebarCollapsed ? "flex-col justify-center gap-1 px-2 py-1" : "justify-between px-5"}`}>
          <Link to="/dashboard" className={`flex min-w-0 cursor-pointer items-center gap-2.5 ${sidebarCollapsed ? "order-2 justify-center" : ""}`}>
            <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-primary to-primary-dark shadow-sm shadow-primary/20 ${sidebarCollapsed ? "h-8 w-8 rounded-lg" : "h-9 w-9 rounded-xl"}`}>
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className={sidebarCollapsed ? "sr-only" : "truncate text-xl font-bold tracking-tight text-foreground"}>Aprendify</span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
            title={sidebarCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
            onClick={() => setSidebarCollapsed((current) => !current)}
            className={`h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 ${sidebarCollapsed ? "order-1 h-8 w-8" : ""}`}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        <nav className={`min-h-0 flex-1 space-y-4 overflow-y-auto py-5 ${sidebarCollapsed ? "px-2" : "px-3"}`}>
          {SIDEBAR_GROUPS.map((group) => renderGroup(group))}
          {renderAdminGroup()}
        </nav>

        <div className={`z-10 shrink-0 border-t border-border/60 bg-card pb-[max(1rem,env(safe-area-inset-bottom))] ${sidebarCollapsed ? "p-2" : "p-4"}`}>
          {renderSupportLink()}
        </div>
      </aside>

      <header className="app-header fixed right-0 top-0 z-30 flex h-16 items-center border-b border-border/50 bg-background/80 shadow-sm backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button aria-label="Abrir menu" variant="ghost" size="icon" className="h-11 w-11 rounded-full">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex h-[100dvh] w-[280px] flex-col overflow-hidden p-0">
                <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
                <SheetDescription className="sr-only">Acesse seus estudos, suporte e perfil.</SheetDescription>
                <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <BookOpen className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="text-lg font-bold text-gradient">Aprendify</span>
                </div>
                <nav aria-label="Navegação mobile" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  {SIDEBAR_GROUPS.map((group) => renderGroup(group, true))}
                  {renderAdminGroup(true)}
                </nav>
                <div className="shrink-0 border-t border-border/60 bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {renderSupportLink(true)}
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/dashboard" className="hidden cursor-pointer items-center gap-1.5 md:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-md">
                <BookOpen className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-md font-bold text-gradient">Aprendify</span>
            </Link>
          </div>

          <Link
            to="/dashboard"
            aria-label="Aprendify: ir para o painel"
            className="absolute left-[50vw] flex -translate-x-1/2 cursor-pointer items-center gap-1.5 md:hidden"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-md">
              <BookOpen className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="hidden whitespace-nowrap text-md font-bold text-gradient sm:inline">Aprendify</span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 md:gap-3">
            <NotificationBell />
            <button
              type="button"
              aria-label={`Ativar tema ${theme === "dark" ? "claro" : "escuro"}`}
              aria-pressed={theme === "dark"}
              title={`Tema ${theme === "dark" ? "escuro" : "claro"}`}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground transition-[background-color,border-color,color,transform] duration-200 hover:border-primary/25 hover:bg-accent hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 motion-reduce:transition-none md:inline-flex"
            >
              {theme === "dark"
                ? <Sun className="h-4 w-4" aria-hidden="true" />
                : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={`Abrir perfil de ${userName}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full p-0 transition-colors duration-300 hover:bg-primary/10 sm:h-11 sm:w-auto sm:gap-2 sm:pl-1 sm:pr-3 md:h-10 md:pr-4"
                >
                  <PlanAvatar
                    userName={userName}
                    avatarUrl={user.user_metadata?.avatar_url}
                    planVisual={planVisual}
                    sizeClassName="h-8 w-8 sm:h-9 sm:w-9"
                  />
                  <span className="hidden max-w-[100px] truncate text-sm font-medium md:inline">{userName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[min(34rem,calc(100dvh-5rem))] w-72 overflow-y-auto rounded-2xl border-border/60 bg-popover/95 p-2.5 shadow-xl shadow-black/10 backdrop-blur-xl">
                <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                  <div className="flex items-center gap-3">
                    <PlanAvatar
                      userName={userName}
                      avatarUrl={user.user_metadata?.avatar_url}
                      planVisual={planVisual}
                      sizeClassName="h-10 w-10"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{userName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                    <span className="min-w-0 truncate rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-primary ring-1 ring-border/50">
                      {planVisual.label}
                    </span>
                    {!streakLoading && streakData && (
                      <div
                        role="group"
                        aria-label={`Sequência de ${streakData.currentStreak} dias. ${streakData.streakCompletedToday ? "Meta de hoje concluída" : `${streakData.questionsToday} questões hoje`}.`}
                        className="flex shrink-0 items-center gap-1.5 text-xs"
                      >
                        <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />
                        <span className="font-semibold tabular-nums text-foreground">{streakData.currentStreak}</span>
                        <span className="text-muted-foreground">dias</span>
                      </div>
                    )}
                  </div>
                </div>

                <DropdownMenuCheckboxItem
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  className="h-10 rounded-lg pr-3 text-sm font-medium md:hidden"
                >
                  {theme === "dark"
                    ? <Moon className="mr-3 h-4 w-4 text-foreground/70" aria-hidden="true" />
                    : <Sun className="mr-3 h-4 w-4 text-foreground/70" aria-hidden="true" />}
                  Tema escuro
                </DropdownMenuCheckboxItem>

                <div className="mt-2 space-y-0.5">
                  {PROFILE_DROPDOWN_ITEMS.map(({ key, label }) => (
                    <DropdownMenuItem key={key} onClick={() => navigate(`/settings?tab=${key}`)} className="h-10 cursor-pointer rounded-lg px-3 text-sm font-medium focus:bg-accent">
                      <UserRound className="mr-3 h-4 w-4 text-foreground/70" /> {label}
                    </DropdownMenuItem>
                  ))}

                  <DropdownMenuItem onClick={() => navigate("/amigos")} className="h-10 cursor-pointer rounded-lg px-3 text-sm font-medium focus:bg-accent">
                    <Users className="mr-3 h-4 w-4 text-foreground/70" />
                    <span className="min-w-0 flex-1">Amigos</span>
                    {socialUnreadCount > 0 && (
                      <span
                        className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-bold leading-5 text-primary-foreground"
                        aria-label={`${socialUnreadCount} atividade${socialUnreadCount === 1 ? "" : "s"} não lida${socialUnreadCount === 1 ? "" : "s"}`}
                      >
                        {socialUnreadCount > 9 ? "9+" : socialUnreadCount}
                      </span>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => navigate("/achievements")} className="h-10 cursor-pointer rounded-lg px-3 text-sm font-medium focus:bg-accent">
                    <Trophy className="mr-3 h-4 w-4 text-foreground/70" /> Conquistas
                  </DropdownMenuItem>
                  {tooltips && tooltips.length > 0 && (
                    <DropdownMenuItem onClick={() => startTour()} className="h-10 cursor-pointer rounded-lg px-3 text-sm font-medium focus:bg-accent">
                      <HelpCircle className="mr-3 h-4 w-4 text-foreground/70" /> Ajuda
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin/feedback")} className="h-10 cursor-pointer rounded-lg px-3 text-sm font-medium text-primary focus:bg-primary/10 focus:text-primary">
                      <MessageSquarePlus className="mr-3 h-4 w-4" /> Gerenciar feedbacks
                    </DropdownMenuItem>
                  )}
                </div>
                <DropdownMenuSeparator className="my-2 bg-border/60" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="h-10 cursor-pointer rounded-lg px-3 text-sm font-medium text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="mr-3 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
};

const Navbar = ({ isLayoutRoot = false }: NavbarProps) => {
  const isInsideLayout = useContext(NavbarLayoutContext);
  return !isLayoutRoot && isInsideLayout ? null : <NavbarContent />;
};

export default Navbar;
