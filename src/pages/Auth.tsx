import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Mail, Lock, User, ArrowRight, Eye, EyeOff, Check, X, ShieldCheck, PartyPopper } from "lucide-react";
import authHero from "@/assets/auth-hero.jpg";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { z } from "zod";
import ReCAPTCHA from "react-google-recaptcha";
import Confetti from "react-confetti";
import { useWindowSize } from "@/hooks/useWindowSize";

/**
 * Chave pública do reCAPTCHA V2 (site key)
 * A chave deve ser configurada como RECAPTCHA_SITE_KEY nos secrets do projeto
 * Como é uma chave pública, ela é segura para uso no frontend
 */
const RECAPTCHA_SITE_KEY = "6LezXEAsAAAAAOo6AkVD45Qo8JXucgmzsjTpcMZB";

// Schema de validação com zod para segurança
const emailSchema = z.string().trim().email("E-mail inválido").max(255, "E-mail muito longo");
const usernameSchema = z.string().trim().min(3, "Mínimo 3 caracteres").max(30, "Máximo 30 caracteres").regex(/^[a-zA-Z0-9_]+$/, "Apenas letras, números e _");
const phoneSchema = z.string().trim().regex(/^(\+?[0-9]{10,15})?$/, "Telefone inválido").optional();

/**
 * Conteúdos dinâmicos que mudam na tela de login
 * Cada item contém título, descrição e features específicas
 */
const dynamicContent = [
  {
    title: "Organize seus estudos de forma inteligente",
    description:
      "Gerencie seu cronograma, resolva questões do ENEM, faça anotações e acompanhe seu progresso em um só lugar.",
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
    features: ["Cartões personalizados", "Organização por matéria", "Revisão espaçada", "Interface intuitiva"],
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
 * Validação de senha forte
 */
const validatePassword = (password: string) => {
  return {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
};

/**
 * Página de autenticação com design moderno split-screen
 * Lado esquerdo: Imagem hero
 * Lado direito: Formulário de login/cadastro
 */
const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loginIdentifier, setLoginIdentifier] = useState(""); // Email ou username para login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [loading, setLoading] = useState(false);
  const [contentIndex, setContentIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados para recuperação de senha
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Estado para reCAPTCHA V2 - apenas para cadastro (opcional se a chave não estiver configurada)
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // Estados para efeitos visuais de foco nos inputs
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Estado para animação de sucesso no cadastro
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { width, height } = useWindowSize();

  // Verificar se há parâmetro de sucesso na URL (após cadastro)
  const registrationSuccess = searchParams.get("registered") === "true";

  // Validação de senha
  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const isPasswordStrong = Object.values(passwordValidation).every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // Efeito para trocar o conteúdo dinâmico a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setContentIndex((prev) => (prev + 1) % dynamicContent.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Efeito para mostrar toast de sucesso quando redirecionado após cadastro
  useEffect(() => {
    if (registrationSuccess) {
      toast.success(
        "Cadastro realizado com sucesso! Verifique seu e-mail e faça login.",
        {
          duration: 8000,
          icon: <PartyPopper className="h-5 w-5 text-green-500" />,
        }
      );
      // Limpar o parâmetro da URL
      window.history.replaceState({}, "", "/auth");
    }
  }, [registrationSuccess]);

  const currentContent = dynamicContent[contentIndex];

  // Handler para autenticação (login ou signup)
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Verificar se é email ou username
        const isEmail = loginIdentifier.includes("@");
        let loginEmail = loginIdentifier;

        if (!isEmail) {
          // Buscar email pelo username (case-insensitive)
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("email")
            .ilike("username", loginIdentifier)
            .maybeSingle();

          if (profileError || !profile) {
            throw new Error("Usuário não encontrado");
          }
          loginEmail = profile.email;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

        if (error) throw error;
        toast.success("Login realizado com sucesso!");
        navigate("/dashboard");
      } else {
        // Validação do reCAPTCHA V2 antes do cadastro (apenas se a chave estiver configurada)
        if (RECAPTCHA_SITE_KEY) {
          if (!recaptchaToken) {
            toast.error("Por favor, complete o reCAPTCHA para continuar.");
            setLoading(false);
            return;
          }

          // Validar token no backend
          try {
            const { data, error } = await supabase.functions.invoke('verify-recaptcha', {
              body: { token: recaptchaToken }
            });

            if (error || !data?.success) {
              console.error("Erro na verificação reCAPTCHA:", error || data?.error);
              toast.error("Verificação de segurança falhou. Tente novamente.");
              recaptchaRef.current?.reset();
              setRecaptchaToken(null);
              setLoading(false);
              return;
            }
          } catch (err) {
            console.error("Erro ao verificar reCAPTCHA:", err);
            toast.error("Erro na verificação de segurança. Tente novamente.");
            recaptchaRef.current?.reset();
            setRecaptchaToken(null);
            setLoading(false);
            return;
          }
        }

        // Validações de cadastro com zod
        try {
          emailSchema.parse(email);
        } catch (e) {
          if (e instanceof z.ZodError) {
            toast.error(e.errors[0].message);
            setLoading(false);
            return;
          }
        }

        try {
          usernameSchema.parse(username);
        } catch (e) {
          if (e instanceof z.ZodError) {
            toast.error(e.errors[0].message);
            setLoading(false);
            return;
          }
        }

        // Check if username already exists (case-insensitive)
        const { data: existingUsername } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", username)
          .maybeSingle();

        if (existingUsername) {
          toast.error("Este nome de usuário já está em uso. Escolha outro.");
          setLoading(false);
          return;
        }

        if (phone) {
          try {
            phoneSchema.parse(phone);
          } catch (e) {
            if (e instanceof z.ZodError) {
              toast.error(e.errors[0].message);
              setLoading(false);
              return;
            }
          }
        }

        if (!isPasswordStrong) {
          toast.error("A senha não atende aos requisitos mínimos de segurança.");
          setLoading(false);
          return;
        }

        if (!passwordsMatch) {
          toast.error("As senhas não coincidem.");
          setLoading(false);
          return;
        }

        // Cria a conta com todos os dados do perfil
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: fullName,
              username: username,
              phone: phone,
              birthdate: birthdate || null,
            },
          },
        });

        if (signUpError) throw signUpError;

        // Verificar se precisa confirmar email
        if (signUpData?.user?.identities?.length === 0) {
          toast.error("Este e-mail já está cadastrado. Tente fazer login.");
          setLoading(false);
          return;
        }

        // Mostrar animação de sucesso com confetti
        setShowSuccessAnimation(true);
        
        // Reset do reCAPTCHA após cadastro bem-sucedido
        recaptchaRef.current?.reset();
        setRecaptchaToken(null);

        // Aguardar a animação e redirecionar para login com mensagem
        setTimeout(() => {
          setShowSuccessAnimation(false);
          navigate("/auth?registered=true");
          setIsLogin(true);
          // Limpar campos do formulário
          setEmail("");
          setPassword("");
          setConfirmPassword("");
          setFullName("");
          setUsername("");
          setPhone("");
          setBirthdate("");
        }, 2500);
      }
    } catch (error: any) {
      // Reset do reCAPTCHA em caso de erro
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
      
      // Mapeamento de erros para mensagens amigáveis
      const errorMessages: Record<string, string> = {
        "Invalid login credentials": "E-mail ou senha incorretos.",
        "Email not confirmed": "Por favor, confirme seu e-mail antes de fazer login.",
        "User already registered": "Este e-mail já está cadastrado.",
        "Password should be at least 6 characters": "A senha deve ter no mínimo 6 caracteres.",
        "Unable to validate email address: invalid format": "Formato de e-mail inválido.",
        "Signup disabled": "Novos cadastros estão temporariamente desabilitados.",
        "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos.",
        "For security purposes, you can only request this once every 60 seconds": "Aguarde 60 segundos antes de tentar novamente.",
      };
      
      const friendlyMessage = errorMessages[error.message] || error.message || "Ocorreu um erro. Tente novamente.";
      toast.error(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handler para login com Google OAuth
  // IMPORTANTE: O redirectTo deve usar a URL de callback do Supabase para funcionar corretamente
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Usa a URL de callback padrão do Supabase que redireciona para o site após autenticação
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || "Erro ao conectar com Google. Tente novamente.");
      setLoading(false);
    }
  };

  // Handler para recuperação de senha
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) throw error;

      toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      setShowForgotPassword(false);
      setForgotEmail("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar e-mail de recuperação.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative">
      {/* Animação de confetti ao cadastrar com sucesso */}
      <AnimatePresence>
        {showSuccessAnimation && (
          <>
            <Confetti
              width={width}
              height={height}
              recycle={false}
              numberOfPieces={300}
              gravity={0.3}
              colors={["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"]}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="bg-card p-8 rounded-2xl shadow-2xl text-center max-w-md mx-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center"
                >
                  <PartyPopper className="h-10 w-10 text-green-500" />
                </motion.div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Cadastro realizado!</h2>
                <p className="text-muted-foreground">
                  Verifique seu e-mail para confirmar sua conta e fazer login.
                </p>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Lado esquerdo - Imagem Hero (hidden em mobile) */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 relative bg-primary overflow-hidden"
      >
        {/* Imagem de fundo */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${authHero})` }}>
          {/* Overlay gradiente */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-primary-dark/90" />
        </div>

        {/* Conteúdo dinâmico sobre a imagem */}
        <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16 xl:px-24 text-white">
          {/* Logo fixo */}
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="h-12 w-12 text-white" />
            <h1 className="text-5xl font-bold text-white">Aprendify</h1>
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
              <h2 className="text-3xl font-semibold mb-4 text-white">{currentContent.title}</h2>
              <p className="text-xl text-white mb-8 leading-relaxed">{currentContent.description}</p>

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
            <h1 className="text-3xl font-bold text-primary">Aprendify</h1>
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
              {isLogin ? "Entre com suas credenciais para continuar" : "Preencha os dados para começar sua jornada"}
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
            {/* Campos de cadastro - Nova ordem: Nome, Email, Usuário, Senha, Confirmar Senha, Nascimento, Telefone */}
            {!isLogin && (
              <>
                {/* Nome completo - com efeito visual de foco */}
                <motion.div 
                  className="space-y-2"
                  animate={{ scale: focusedInput === "fullName" ? 1.02 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Label htmlFor="fullName" className="text-base font-medium">
                    Nome Completo
                  </Label>
                  <div className={`relative rounded-md transition-all duration-300 ${focusedInput === "fullName" ? "ring-2 ring-primary/50 shadow-lg shadow-primary/20" : ""}`}>
                    <User className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-300 ${focusedInput === "fullName" ? "text-primary" : "text-muted-foreground"}`} />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Seu nome completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onFocus={() => setFocusedInput("fullName")}
                      onBlur={() => setFocusedInput(null)}
                      required={!isLogin}
                      disabled={loading}
                      className="pl-11 h-12 text-base transition-all duration-300"
                    />
                  </div>
                </motion.div>

                {/* Email (cadastro) - com efeito visual de foco */}
                <motion.div 
                  className="space-y-2"
                  animate={{ scale: focusedInput === "email" ? 1.02 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Label htmlFor="email" className="text-base font-medium">
                    E-mail
                  </Label>
                  <div className={`relative rounded-md transition-all duration-300 ${focusedInput === "email" ? "ring-2 ring-primary/50 shadow-lg shadow-primary/20" : ""}`}>
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-300 ${focusedInput === "email" ? "text-primary" : "text-muted-foreground"}`} />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedInput("email")}
                      onBlur={() => setFocusedInput(null)}
                      required
                      disabled={loading}
                      className="pl-11 h-12 text-base transition-all duration-300"
                    />
                  </div>
                </motion.div>

                {/* Nome de usuário - com efeito visual de foco */}
                <motion.div 
                  className="space-y-2"
                  animate={{ scale: focusedInput === "username" ? 1.02 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Label htmlFor="username" className="text-base font-medium">
                    Nome de Usuário
                  </Label>
                  <div className={`relative rounded-md transition-all duration-300 ${focusedInput === "username" ? "ring-2 ring-primary/50 shadow-lg shadow-primary/20" : ""}`}>
                    <User className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-300 ${focusedInput === "username" ? "text-primary" : "text-muted-foreground"}`} />
                    <Input
                      id="username"
                      type="text"
                      placeholder="seunome123"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={() => setFocusedInput("username")}
                      onBlur={() => setFocusedInput(null)}
                      required={!isLogin}
                      disabled={loading}
                      className="pl-11 h-12 text-base transition-all duration-300"
                    />
                  </div>
                </motion.div>

                {/* Senha - com efeito visual de foco */}
                <motion.div 
                  className="space-y-2"
                  animate={{ scale: focusedInput === "password" ? 1.02 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Label htmlFor="password" className="text-base font-medium">
                    Senha
                  </Label>
                  <div className={`relative rounded-md transition-all duration-300 ${focusedInput === "password" ? "ring-2 ring-primary/50 shadow-lg shadow-primary/20" : ""}`}>
                    <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-300 ${focusedInput === "password" ? "text-primary" : "text-muted-foreground"}`} />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedInput("password")}
                      onBlur={() => setFocusedInput(null)}
                      required
                      disabled={loading}
                      className="pl-11 pr-11 h-12 text-base transition-all duration-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  {/* Validador de senha forte com animação */}
                  <AnimatePresence>
                    {password.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="grid grid-cols-2 gap-1 mt-2 text-xs overflow-hidden"
                      >
                        <div
                          className={`flex items-center gap-1 transition-colors duration-300 ${passwordValidation.minLength ? "text-green-500" : "text-muted-foreground"}`}
                        >
                          {passwordValidation.minLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>Mínimo 8 caracteres</span>
                        </div>
                        <div
                          className={`flex items-center gap-1 transition-colors duration-300 ${passwordValidation.hasUpperCase ? "text-green-500" : "text-muted-foreground"}`}
                        >
                          {passwordValidation.hasUpperCase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>Letra maiúscula</span>
                        </div>
                        <div
                          className={`flex items-center gap-1 transition-colors duration-300 ${passwordValidation.hasLowerCase ? "text-green-500" : "text-muted-foreground"}`}
                        >
                          {passwordValidation.hasLowerCase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>Letra minúscula</span>
                        </div>
                        <div
                          className={`flex items-center gap-1 transition-colors duration-300 ${passwordValidation.hasNumber ? "text-green-500" : "text-muted-foreground"}`}
                        >
                          {passwordValidation.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>Número</span>
                        </div>
                        <div
                          className={`flex items-center gap-1 transition-colors duration-300 ${passwordValidation.hasSpecialChar ? "text-green-500" : "text-muted-foreground"}`}
                        >
                          {passwordValidation.hasSpecialChar ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          <span>Caractere especial</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Confirmar Senha - com efeito visual de foco */}
                <motion.div 
                  className="space-y-2"
                  animate={{ scale: focusedInput === "confirmPassword" ? 1.02 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Label htmlFor="confirmPassword" className="text-base font-medium">
                    Confirmar Senha
                  </Label>
                  <div className={`relative rounded-md transition-all duration-300 ${focusedInput === "confirmPassword" ? "ring-2 ring-primary/50 shadow-lg shadow-primary/20" : ""}`}>
                    <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-300 ${focusedInput === "confirmPassword" ? "text-primary" : "text-muted-foreground"}`} />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => setFocusedInput("confirmPassword")}
                      onBlur={() => setFocusedInput(null)}
                      required
                      disabled={loading}
                      className={`pl-11 pr-11 h-12 text-base transition-all duration-300 ${
                        confirmPassword.length > 0
                          ? passwordsMatch
                            ? "border-green-500 focus-visible:ring-green-500"
                            : "border-destructive focus-visible:ring-destructive"
                          : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <AnimatePresence>
                    {confirmPassword.length > 0 && !passwordsMatch && (
                      <motion.p 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-xs text-destructive flex items-center gap-1"
                      >
                        <X className="h-3 w-3" /> As senhas não coincidem
                      </motion.p>
                    )}
                    {passwordsMatch && (
                      <motion.p 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-xs text-green-500 flex items-center gap-1"
                      >
                        <Check className="h-3 w-3" /> As senhas coincidem
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Data de nascimento - com efeito visual de foco */}
                <motion.div 
                  className="space-y-2"
                  animate={{ scale: focusedInput === "birthdate" ? 1.02 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Label htmlFor="birthdate" className="text-base font-medium">
                    Data de Nascimento
                  </Label>
                  <div className={`relative rounded-md transition-all duration-300 ${focusedInput === "birthdate" ? "ring-2 ring-primary/50 shadow-lg shadow-primary/20" : ""}`}>
                    <Input
                      id="birthdate"
                      type="date"
                      value={birthdate}
                      onChange={(e) => setBirthdate(e.target.value)}
                      onFocus={() => setFocusedInput("birthdate")}
                      onBlur={() => setFocusedInput(null)}
                      disabled={loading}
                      className="h-12 text-base transition-all duration-300"
                    />
                  </div>
                </motion.div>

                {/* Celular - com efeito visual de foco */}
                <motion.div 
                  className="space-y-2"
                  animate={{ scale: focusedInput === "phone" ? 1.02 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Label htmlFor="phone" className="text-base font-medium">
                    Celular
                  </Label>
                  <div className={`relative rounded-md transition-all duration-300 ${focusedInput === "phone" ? "ring-2 ring-primary/50 shadow-lg shadow-primary/20" : ""}`}>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onFocus={() => setFocusedInput("phone")}
                      onBlur={() => setFocusedInput(null)}
                      required={!isLogin}
                      disabled={loading}
                      className="h-12 text-base transition-all duration-300"
                    />
                  </div>
                </motion.div>

                {/* reCAPTCHA V2 - apenas no cadastro */}
                {RECAPTCHA_SITE_KEY && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="flex justify-center"
                  >
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={RECAPTCHA_SITE_KEY}
                      onChange={(token) => setRecaptchaToken(token)}
                      onExpired={() => setRecaptchaToken(null)}
                      onErrored={() => setRecaptchaToken(null)}
                      theme="light"
                    />
                  </motion.div>
                )}
              </>
            )}

            {/* Campo de login (email ou username) - com efeitos visuais */}
            {isLogin && (
              <>
                <motion.div 
                  className="space-y-2"
                  animate={{ scale: focusedInput === "loginIdentifier" ? 1.02 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Label htmlFor="loginIdentifier" className="text-base font-medium">
                    E-mail ou Usuário
                  </Label>
                  <div className={`relative rounded-md transition-all duration-300 ${focusedInput === "loginIdentifier" ? "ring-2 ring-primary/50 shadow-lg shadow-primary/20" : ""}`}>
                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-300 ${focusedInput === "loginIdentifier" ? "text-primary" : "text-muted-foreground"}`} />
                    <Input
                      id="loginIdentifier"
                      type="text"
                      placeholder="seu@email.com ou seunome123"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      onFocus={() => setFocusedInput("loginIdentifier")}
                      onBlur={() => setFocusedInput(null)}
                      required
                      disabled={loading}
                      className="pl-11 h-12 text-base transition-all duration-300"
                    />
                  </div>
                </motion.div>

                {/* Senha (login) - com efeitos visuais */}
                <motion.div 
                  className="space-y-2"
                  animate={{ scale: focusedInput === "passwordLogin" ? 1.02 : 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Label htmlFor="passwordLogin" className="text-base font-medium">
                    Senha
                  </Label>
                  <div className={`relative rounded-md transition-all duration-300 ${focusedInput === "passwordLogin" ? "ring-2 ring-primary/50 shadow-lg shadow-primary/20" : ""}`}>
                    <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-300 ${focusedInput === "passwordLogin" ? "text-primary" : "text-muted-foreground"}`} />
                    <Input
                      id="passwordLogin"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedInput("passwordLogin")}
                      onBlur={() => setFocusedInput(null)}
                      required
                      disabled={loading}
                      className="pl-11 pr-11 h-12 text-base transition-all duration-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </motion.div>

                {/* Link Esqueci minha senha */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              </>
            )}

            {/* Botão de submit com efeito de hover aprimorado */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold gap-2 transition-all duration-300" 
                disabled={loading || (!isLogin && RECAPTCHA_SITE_KEY && !recaptchaToken)}
              >
                {loading ? (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                    />
                    Processando...
                  </motion.span>
                ) : (
                  <>
                    {isLogin ? "Entrar" : "Criar conta"}
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </Button>
            </motion.div>

            {/* Separador */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou continue com</span>
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
                {isLogin ? "Não tem conta? Cadastre-se gratuitamente" : "Já tem conta? Faça login"}
              </button>
            </div>
          </motion.form>
        </div>
      </motion.div>

      {/* Modal de Recuperação de Senha */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Digite seu e-mail cadastrado e enviaremos um link para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="forgotEmail">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="forgotEmail"
                  type="email"
                  placeholder="seu@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  disabled={forgotLoading}
                  className="pl-11 h-12"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotPassword(false)}
                className="flex-1"
                disabled={forgotLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={forgotLoading}>
                {forgotLoading ? "Enviando..." : "Enviar link"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
