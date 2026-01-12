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
import { Settings, LogOut, Moon, Sun, BookOpen, Crown, CreditCard, Sparkles, Trophy } from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { usePremiumContext } from "@/contexts/PremiumContext";
import { PremiumModal } from "@/components/PremiumModal";
import { useStreakContext } from "@/contexts/StreakContext";
import { StreakIndicator } from "@/components/streak/StreakIndicator";

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
        <div className="flex justify-between items-center h-16 sm:h-18">
          {/* Logo */}
          <div
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group"
            onClick={() => navigate("/dashboard")}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-300">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
            </div>
            <span className="text-xl sm:text-2xl font-bold text-gradient">
              Aprendify
            </span>
          </div>

          {/* Menu do usuário */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Indicador de Streak */}
            {!streakLoading && streakData && (
              <StreakIndicator
                currentStreak={streakData.currentStreak}
                questionsToday={streakData.questionsToday}
                streakCompletedToday={streakData.streakCompletedToday}
                longestStreak={streakData.longestStreak}
              />
            )}
            {/* Badge Premium, Criador ou Free baseado no status de assinatura */}
            {!isLoading &&
              (isCreator ? (
                <Badge
                  onClick={() => navigate("/creator")}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 px-3 sm:px-4 py-1.5 shadow-md hover:shadow-lg flex items-center cursor-pointer transition-all duration-300 hover:scale-105 rounded-full"
                >
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline font-semibold">Criador</span>
                </Badge>
              ) : isPremium ? (
                <Badge
                  onClick={() => setShowPremiumModal(true)}
                  className="bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white border-0 px-3 sm:px-4 py-1.5 shadow-md hover:shadow-lg flex items-center cursor-pointer transition-all duration-300 hover:scale-105 rounded-full"
                >
                  <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline font-semibold">Premium</span>
                </Badge>
              ) : (
                <Badge
                  onClick={() => setShowPremiumModal(true)}
                  className="bg-gradient-to-r from-muted-foreground/60 to-muted-foreground/80 hover:from-muted-foreground/70 hover:to-muted-foreground/90 text-white border-0 px-3 sm:px-4 py-1.5 cursor-pointer shadow-sm hover:shadow-md flex items-center transition-all duration-300 hover:scale-105 rounded-full"
                >
                  <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline font-medium">Free</span>
                </Badge>
              ))}
            {/* Botão de tema */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-full hover:bg-primary/10 h-10 w-10 transition-all duration-300"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-amber-400" />
              ) : (
                <Moon className="h-5 w-5 text-primary" />
              )}
            </Button>

            {/* Dropdown do perfil */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 hover:bg-primary/10 rounded-full pr-3 sm:pr-4 pl-1.5 sm:pl-2 h-10 sm:h-11 transition-all duration-300"
                >
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary-dark text-primary-foreground text-sm font-semibold">
                      {getInitials(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden sm:inline">{userName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 p-2 rounded-xl shadow-xl border-border/50">
                <div className="px-3 py-3 bg-muted/50 rounded-lg mb-2">
                  <p className="text-sm font-semibold">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
                <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer rounded-lg py-2.5 px-3">
                  <Settings className="h-4 w-4 mr-3 text-muted-foreground" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/subscription")} className="cursor-pointer rounded-lg py-2.5 px-3">
                  <CreditCard className="h-4 w-4 mr-3 text-muted-foreground" />
                  Minha Assinatura
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/achievements")} className="cursor-pointer rounded-lg py-2.5 px-3">
                  <Trophy className="h-4 w-4 mr-3 text-muted-foreground" />
                  Conquistas
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
          </div>
        </div>
      </div>

      {/* Modal de Premium */}
      <PremiumModal open={showPremiumModal} onOpenChange={setShowPremiumModal} isPremium={isPremium} />
    </nav>
  );
};

export default Navbar;
