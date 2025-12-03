import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Mail, Lock, User, ArrowRight } from "lucide-react";
import authHero from "@/assets/auth-hero.jpg";

/**
 * Conteúdos dinâmicos que mudam na tela de login
 * Cada item contém título, descrição e features específicas
 */
const dynamicContent = [
  {
    title: "Organize seus estudos de forma inteligente",
    description: "Gerencie seu cronograma, resolva questões do ENEM, faça anotações e acompanhe seu progresso em um só lugar.",
    features: [
      "Cronogramas personalizados",
      "Banco de questões do ENEM",
      "Anotações organizadas por matéria",
      "Acompanhamento de tarefas",
    ],
  },
  {
    title: "Pratique com milhares de questões reais",
    description: "Acesse questões do ENEM de 2009 até 2024 e acompanhe seu desempenho em tempo real.",
    features: [
      "Questões do ENEM 2009-2024",
      "Feedback instantâneo",
      "Estatísticas detalhadas",
      "Filtros por disciplina e ano",
    ],
  },
  {
    title: "Memorize com Flashcards inteligentes",
    description: "Crie cartões de estudo personalizados e revise o conteúdo de forma eficiente.",
    features: [
      "Cartões personalizados",
      "Organização por matéria",
      "Revisão espaçada",
      "Interface intuitiva",
    ],
  },
  {
    title: "Acompanhe sua evolução",
    description: "Visualize seu progresso com gráficos e identifique os pontos que precisam de mais atenção.",
    features: [
      "Dashboard personalizado",
      "Gráficos de desempenho",
      "Identificação de pontos fracos",
      "Histórico completo",
    ],
  },
];

/**
 * Página de autenticação com design moderno split-screen
 * Lado esquerdo: Imagem hero
 * Lado direito: Formulário de login/cadastro
 */
const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [loading, setLoading] = useState(false);
  const [contentIndex, setContentIndex] = useState(0);
  const navigate = useNavigate();

  // Efeito para trocar o conteúdo dinâmico a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setContentIndex((prev) => (prev + 1) % dynamicContent.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentContent = dynamicContent[contentIndex];

  // Handler para autenticação (login ou signup)
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        toast.success("Login realizado com sucesso!");
        navigate("/dashboard");
      } else {
        // Cria a conta com todos os dados do perfil
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: fullName,
              username: username,
              phone: phone,
              birthdate: birthdate || null,
              role: "user", // Sempre usuário padrão
            },
          },
        });

        if (signUpError) throw signUpError;

        toast.success("Cadastro realizado! Faça login para continuar.");
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message || "Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Handler para login com Google
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Erro ao conectar com Google. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Lado esquerdo - Imagem Hero (hidden em mobile) */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 relative bg-primary overflow-hidden"
      >
        {/* Imagem de fundo */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${authHero})` }}
        >
          {/* Overlay gradiente */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-primary-dark/90" />
        </div>
        
        {/* Conteúdo dinâmico sobre a imagem */}
        <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16 xl:px-24 text-white">
          {/* Logo fixo */}
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="h-12 w-12 text-white" />
            <h1 className="text-5xl font-bold text-white">Learnify</h1>
          </div>
          
          {/* Conteúdo que muda com animação */}
          <AnimatePresence mode="wait">
            <motion.div
              key={contentIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl font-semibold mb-4 text-white">
                {currentContent.title}
              </h2>
              <p className="text-xl text-white mb-8 leading-relaxed">
                {currentContent.description}
              </p>
              
              {/* Features dinâmicas */}
              <div className="space-y-4">
                {currentContent.features.map((feature, idx) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-white" />
                    <span className="text-lg text-white">{feature}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
          
          {/* Indicadores de página */}
          <div className="flex gap-2 mt-8">
            {dynamicContent.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setContentIndex(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === contentIndex ? "bg-white w-6" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Lado direito - Formulário */}
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background"
      >
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="flex lg:hidden items-center justify-center mb-8">
            <BookOpen className="h-10 w-10 text-primary mr-3" />
            <h1 className="text-3xl font-bold text-primary">Learnify</h1>
          </div>

          {/* Header do formulário */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-3xl font-bold text-foreground mb-2">
              {isLogin ? "Bem-vindo de volta" : "Criar sua conta"}
            </h2>
            <p className="text-muted-foreground text-lg">
              {isLogin
                ? "Entre com suas credenciais para continuar"
                : "Preencha os dados para começar sua jornada"}
            </p>
          </motion.div>

          {/* Formulário */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            onSubmit={handleAuth}
            className="space-y-6"
          >
            {/* Campos de cadastro */}
            {!isLogin && (
              <>
                {/* Nome completo */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-base font-medium">
                    Nome Completo
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Seu nome completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={!isLogin}
                      disabled={loading}
                      className="pl-11 h-12 text-base"
                    />
                  </div>
                </div>

                {/* Nome de usuário */}
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-base font-medium">
                    Nome de Usuário
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="seunome123"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required={!isLogin}
                      disabled={loading}
                      className="pl-11 h-12 text-base"
                    />
                  </div>
                </div>

                {/* Data de nascimento */}
                <div className="space-y-2">
                  <Label htmlFor="birthdate" className="text-base font-medium">
                    Data de Nascimento
                  </Label>
                  <Input
                    id="birthdate"
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    disabled={loading}
                    className="h-12 text-base"
                  />
                </div>

                {/* Celular */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-base font-medium">
                    Celular
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required={!isLogin}
                    disabled={loading}
                    className="h-12 text-base"
                  />
                </div>
              </>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-11 h-12 text-base"
                />
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base font-medium">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="pl-11 h-12 text-base"
                />
              </div>
            </div>


            {/* Botão de submit */}
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold gap-2" 
              disabled={loading}
            >
              {loading ? (
                "Processando..."
              ) : (
                <>
                  {isLogin ? "Entrar" : "Criar conta"}
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>

            {/* Separador */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  ou continue com
                </span>
              </div>
            </div>

            {/* Botão Google */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-medium gap-3"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuar com Google
            </Button>

            {/* Link para alternar entre login/cadastro */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:text-primary-light transition-colors font-medium text-base"
                disabled={loading}
              >
                {isLogin 
                  ? "Não tem conta? Cadastre-se gratuitamente" 
                  : "Já tem conta? Faça login"}
              </button>
            </div>
          </motion.form>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
