import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
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
  Settings,
  LogOut,
  Moon,
  Sun,
  Crown,
  CreditCard,
  Sparkles,
  Trophy,
  MessageSquarePlus,
} from "lucide-react";
import { useTheme } from "next-themes";
import { usePremiumContext } from "@/contexts/PremiumContext";
import { PremiumModal } from "@/components/PremiumModal";
import { useStreakContext } from "@/contexts/StreakContext";
import { StreakIndicator } from "@/components/streak/StreakIndicator";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { SidebarTrigger } from "@/components/ui/sidebar";

const AppHeader = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState("");
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const { isPremium, isLoading, planType } = usePremiumContext();
  const { streakData, loading: streakLoading } = useStreakContext();
  const isCreator = planType === "creator";

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        const fullName = profile?.full_name || user.email?.split("@")[0] || "Usuário";
        setUserName(fullName.split(" ")[0]);
      }
    };
    fetchUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
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

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border/50 bg-background/80 backdrop-blur-xl px-3 sm:px-4">
      <SidebarTrigger className="shrink-0" />

      <div className="flex-1" />

      {!streakLoading && streakData && (
        <StreakIndicator
          currentStreak={streakData.currentStreak}
          questionsToday={streakData.questionsToday}
          streakCompletedToday={streakData.streakCompletedToday}
          longestStreak={streakData.longestStreak}
        />
      )}

      {!isLoading && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  isCreator
                    ? navigate("/creator")
                    : isPremium
                    ? setShowPremiumModal(true)
                    : navigate("/subscription")
                }
                className="rounded-full h-9 w-9"
              >
                {isCreator ? (
                  <Sparkles className="h-4 w-4 text-purple-500" />
                ) : isPremium ? (
                  <Crown className="h-4 w-4 text-amber-500" />
                ) : (
                  <Crown className="h-4 w-4 text-muted-foreground/50" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isCreator ? "Plano Criador" : isPremium ? "Plano Premium" : "Plano Gratuito"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <NotificationBell />

      {user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 rounded-full pr-3 pl-1 h-9">
              <Avatar className="h-7 w-7 ring-2 ring-primary/20 ring-offset-1 ring-offset-background">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs font-semibold">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden md:inline max-w-[100px] truncate">
                {userName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-2 rounded-xl shadow-xl border-border/50">
            <div className="px-3 py-3 bg-muted/50 rounded-lg mb-2">
              <p className="text-sm font-semibold">Olá, {userName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>

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
                onCheckedChange={(c) => setTheme(c ? "dark" : "light")}
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
      )}

      <PremiumModal open={showPremiumModal} onOpenChange={setShowPremiumModal} />
    </header>
  );
};

export default AppHeader;
