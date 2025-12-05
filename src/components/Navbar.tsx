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
import { Settings, LogOut, Moon, Sun, BookOpen, Crown } from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { usePremium } from "@/hooks/usePremium";
import { PremiumModal } from "@/components/PremiumModal";

/**
 * Navbar minimalista com perfil do usuário e tema dark/light
 * Exibe nome do usuário, avatar e dropdown com opções de configurações e logout
 */
const Navbar = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const { isPremium, isLoading } = usePremium();

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
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate("/dashboard")}
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Estudify
            </span>
          </div>

          {/* Menu do usuário */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Badge Premium ou Free baseado no status de assinatura */}
            {!isLoading &&
              (isPremium ? (
                <Badge
                  onClick={() => setShowPremiumModal(true)}
                  className="bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white border-0 px-2 sm:px-4 py-1.5 shadow-lg flex items-center cursor-pointer transition-transform hover:scale-105"
                >
                  <Crown className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Premium</span>
                </Badge>
              ) : (
                <Badge
                  onClick={() => setShowPremiumModal(true)}
                  className="bg-gradient-to-r from-zinc-400 to-zinc-600 hover:from-zinc-500 hover:to-zinc-700 text-white border-0 px-2 sm:px-4 py-1.5 cursor-pointer shadow-lg flex items-center transition-transform hover:scale-105"
                >
                  <Crown className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Free</span>
                </Badge>
              ))}
            {/* Botão de tema */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-full hover:bg-accent/10 h-9 w-9 sm:h-10 sm:w-10"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>

            {/* Dropdown do perfil */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 hover:bg-accent/10 rounded-full pr-2 sm:pr-4 pl-1 sm:pl-3"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm">
                      {getInitials(userName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden sm:inline">{userName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-2">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
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
