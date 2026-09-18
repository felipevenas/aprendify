import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Mail, Lock, User, ArrowRight, Eye, EyeOff, Check, X, ShieldCheck, PartyPopper, Moon, Sun } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { z } from "zod";
import ReCAPTCHA from "react-google-recaptcha";
import Confetti from "react-confetti";
import { useWindowSize } from "@/hooks/useWindowSize";
import { MotionConfig } from "framer-motion";
import { getSafeAuthMessage } from "../services/authMessages";
import { useTheme } from "next-themes";

/**
 * Chave pública do reCAPTCHA V2 (site key)
 * A chave deve ser configurada como RECAPTCHA_SITE_KEY nos secrets do projeto
 * Como é uma chave pública, ela é segura para uso no frontend
 */
const RECAPTCHA_SITE_KEY = "6LezXEAsAAAAAOo6AkVD45Qo8JXucgmzsjTpcMZB";

// Schema de validação com zod para segurança
const emailSchema = z
  .string()
  .trim()
  .min(1, "E-mail é obrigatório")
  .email("E-mail inválido. Use o formato: exemplo@dominio.com")
  .max(255, "E-mail muito longo")
  .refine((email) => {
    // Validação adicional de formato de email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }, "E-mail inválido. Verifique o formato");

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Nome de usuário deve ter no mínimo 3 caracteres")
  .max(30, "Nome de usuário deve ter no máximo 30 caracteres")
  .regex(/^[a-zA-Z]/, "Nome de usuário deve começar com uma letra")
  .regex(/^[a-zA-Z0-9_]+$/, "Apenas letras, números e underscore (_) são permitidos")
  .refine((username) => !username.includes("__"), "Não pode ter underscores consecutivos");

const fullNameSchema = z
  .string()
  .trim()
  .min(3, "Nome completo deve ter no mínimo 3 caracteres")
  .max(100, "Nome muito longo")
  .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome deve conter apenas letras")
  .refine((name) => name.split(" ").length >= 2, "Digite seu nome completo (nome e sobrenome)");

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Telefone é obrigatório")
  .regex(/^[\d\s()+-]+$/, "Telefone deve conter apenas números")
  .refine((phone) => {
    const digitsOnly = phone.replace(/\D/g, "");
    return digitsOnly.length >= 10 && digitsOnly.length <= 15;
  }, "Telefone deve ter entre 10 e 15 dígitos");

const birthdateSchema = z
  .string()
  .min(1, "Data de nascimento é obrigatória")
  .refine((date) => {
    const birthDate = new Date(date);
    const today = new Date();
    if (Number.isNaN(birthDate.getTime()) || birthDate > today) return false;
    let age = today.getFullYear() - birthDate.getFullYear();
    const birthdayHasNotHappened = today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
    if (birthdayHasNotHappened) age -= 1;
    return age >= 10 && age <= 100;
  }, "Idade deve estar entre 10 e 100 anos");

const getAgeFromBirthdate = (date: string) => {
  if (!date) return null;
  const birthDate = new Date(`${date}T00:00:00`);
  const today = new Date();
  if (Number.isNaN(birthDate.getTime()) || birthDate > today) return null;
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
};

/**
 * Conteúdos dinâmicos que mudam na tela de login
 * Cada item contém título, descrição e features específicas
 */
const dynamicContent = [
  {
    title: "Organize seus estudos de forma inteligente",
    description:
      "Gerencie seu plano de estudos, resolva questões do ENEM, faça anotações e acompanhe seu progresso em um só lugar.",
    features: [
      "Plano de Estudos personalizado",
      "Banco de questões do ENEM",
      "Anotações organizadas por matéria",
      "Acompanhamento de tarefas",
    ],
  },
  {
    title: "Pratique com milhares de questões reais",
    description: "Acesse questões do ENEM de 2009 até 2025 e acompanhe seu desempenho em tempo real.",
    features: [
      "Questões do ENEM 2009-2025",
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
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [currentSituation, setCurrentSituation] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [examYear, setExamYear] = useState("");
  const [studyPreference, setStudyPreference] = useState("");
  const [signupSource, setSignupSource] = useState("");
  const [acceptsMarketing, setAcceptsMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contentIndex, setContentIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados para recuperação de senha
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  // Estado para reCAPTCHA V2 - apenas para cadastro (opcional se a chave não estiver configurada)
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // Estados para efeitos visuais de foco nos inputs
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Estado para animação de sucesso no cadastro
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const authPanelRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const { width, height } = useWindowSize();

  // Verificar se há parâmetro de sucesso na URL (após cadastro)
  const registrationSuccess = searchParams.get("registered") === "true";
  const requestedPlan = searchParams.get("plano");
  const requestedBump = searchParams.get("bump");
  const requestedCoupon = searchParams.get("cupom");
  const checkoutParams = new URLSearchParams();
  if (requestedPlan === "starter" || requestedPlan === "annual") checkoutParams.set("plano", requestedPlan);
  if (requestedBump === "redacao") checkoutParams.set("bump", "redacao");
  if (requestedCoupon) checkoutParams.set("cupom", requestedCoupon);
  const checkoutRedirect = searchParams.get("redirect") === "/planos" && (requestedPlan === "starter" || requestedPlan === "annual")
    ? `/planos?${checkoutParams.toString()}`
    : "/dashboard";

  // Validação de senha
  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const isPasswordStrong = Object.values(passwordValidation).every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const calculatedAge = getAgeFromBirthdate(birthdate);

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

  useEffect(() => {
    // Ao trocar entre login e cadastro, o foco pode preservar a posição
    // anterior dentro do painel rolável. Sempre recomeçamos pelo topo,
    // inclusive no mobile, onde o próprio documento é o scroll container.
    const resetAuthScroll = () => {
      authPanelRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };

    resetAuthScroll();
    const frame = window.requestAnimationFrame(resetAuthScroll);

    return () => window.cancelAnimationFrame(frame);
  }, [isLogin]);

  // Handler para autenticação (login ou signup)
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.functions.invoke("auth-login", {
          body: { identifier: loginIdentifier, password },
        });
        if (error || !data?.session?.access_token || !data?.session?.refresh_token) {
          throw error || new Error("Authentication failed");
        }

        const { error: sessionError } = await supabase.auth.setSession(data.session);
        if (sessionError) throw sessionError;

        const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
          const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
          const factor = factors?.totp?.find((candidate) => candidate.status === "verified");
          if (factorsError || !factor) throw new Error("MFA_REQUIRED");
          const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
          if (challengeError) throw challengeError;
          setMfaChallenge({ factorId: factor.id, challengeId: challenge.id });
          setLoading(false);
          return;
        }

        toast.success("Login realizado com sucesso!");
        navigate(checkoutRedirect);
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

        // Validações de cadastro com zod - todos os campos obrigatórios
        try {
          fullNameSchema.parse(fullName);
        } catch (e) {
          if (e instanceof z.ZodError) {
            toast.error(e.errors[0].message);
            setLoading(false);
            return;
          }
        }

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

        try {
          phoneSchema.parse(phone);
        } catch (e) {
          if (e instanceof z.ZodError) {
            toast.error(e.errors[0].message);
            setLoading(false);
            return;
          }
        }

        try {
          birthdateSchema.parse(birthdate);
        } catch (e) {
          if (e instanceof z.ZodError) {
            toast.error(e.errors[0].message);
            setLoading(false);
            return;
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
            emailRedirectTo: `${window.location.origin}${checkoutRedirect}`,
            data: {
              full_name: fullName,
              username: username,
              phone: phone,
              birthdate: birthdate || null,
              city: city || null,
              state: state || null,
              current_situation: currentSituation || null,
              main_goal: mainGoal || null,
              target_exam_year: examYear || null,
              study_preference: studyPreference || null,
              signup_source: signupSource || null,
              accepts_marketing: acceptsMarketing,
            },
          },
        });

        if (signUpError) throw signUpError;

        // Mostrar animação de sucesso com confetti
        setShowSuccessAnimation(true);
        
        // Reset do reCAPTCHA após cadastro bem-sucedido
        recaptchaRef.current?.reset();
        setRecaptchaToken(null);

        // Aguardar a animação e redirecionar para login com mensagem
        setTimeout(() => {
          setShowSuccessAnimation(false);
          const returnParams = new URLSearchParams({ registered: "true" });
          if (checkoutRedirect !== "/dashboard") {
            returnParams.set("redirect", "/planos");
            returnParams.set("plano", requestedPlan as string);
            if (requestedBump === "redacao") returnParams.set("bump", "redacao");
            if (requestedCoupon) returnParams.set("cupom", requestedCoupon);
          }
          navigate(`/auth?${returnParams.toString()}`);
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
    } catch (error: unknown) {
      // Reset do reCAPTCHA em caso de erro
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
      
      const safeMessage = getSafeAuthMessage(isLogin ? "login" : "signup", error);
      setAuthMessage(safeMessage);
      toast.error(safeMessage);
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
          redirectTo: `${window.location.origin}${checkoutRedirect}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error: unknown) {
      const safeMessage = getSafeAuthMessage("oauth", error);
      setAuthMessage(safeMessage);
      toast.error(safeMessage);
      setLoading(false);
    }
  };

  // Handler para recuperação de senha
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage(null);
    setForgotLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) throw error;

      const safeMessage = "Se o e-mail estiver cadastrado, enviaremos instruções para recuperar sua senha.";
      setForgotMessage(safeMessage);
      toast.success(safeMessage);
      setShowForgotPassword(false);
      setForgotEmail("");
    } catch (error: unknown) {
      const safeMessage = getSafeAuthMessage("recovery", error);
      setForgotMessage(safeMessage);
      toast.error(safeMessage);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge || !/^\d{6}$/.test(mfaCode)) return;
    setMfaLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaChallenge.factorId,
        challengeId: mfaChallenge.challengeId,
        code: mfaCode,
      });
      if (error) throw error;
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.currentLevel !== "aal2") throw new Error("MFA_REQUIRED");
      setMfaChallenge(null);
      setMfaCode("");
      toast.success("Autenticação adicional concluída!");
      navigate(checkoutRedirect);
    } catch (error: unknown) {
      toast.error(error instanceof Error && error.message === "MFA_REQUIRED" ? "Autenticação adicional necessária." : "Código inválido. Tente novamente.");
    } finally {
      setMfaLoading(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative flex min-h-screen flex-col gap-0 bg-muted/50 p-0 lg:h-screen lg:flex-row lg:gap-4 lg:overflow-hidden lg:p-4 xl:p-6">
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
        className="relative hidden min-h-0 overflow-hidden rounded-[2rem] bg-primary shadow-xl lg:flex lg:h-full lg:w-[52%] xl:min-h-0"
      >
        {/* Campo visual construído apenas com os fades da paleta Aprendify */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-dark via-primary to-sky-500" />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-indigo-950/35 blur-3xl" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(hsl(var(--primary-foreground)/0.16)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary-foreground)/0.16)_1px,transparent_1px)] [background-size:44px_44px]" />

        {/* Conteúdo dinâmico sobre a imagem */}
        <div className="relative z-10 flex w-full flex-col justify-between px-8 py-8 text-white lg:px-10 xl:px-14 xl:py-10">
          {/* Logo fixo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-sm">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">Aprendify</span>
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
              <div className="mb-4 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">Sua jornada começa aqui</div>
              <h2 className="max-w-xl text-4xl font-semibold leading-tight text-white xl:text-5xl">{currentContent.title}</h2>
              <p className="mb-8 mt-4 max-w-xl text-base leading-relaxed text-white/80 xl:text-lg">{currentContent.description}</p>

              {/* Features dinâmicas */}
              <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                {currentContent.features.map((feature, idx) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-3 backdrop-blur-sm"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20"><Check className="h-3.5 w-3.5 text-white" /></div>
                    <span className="text-sm text-white/90">{feature}</span>
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
                type="button"
                aria-label={`Ir para benefício ${idx + 1}`}
                aria-current={idx === contentIndex ? "true" : undefined}
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
        ref={authPanelRef}
        className="flex min-h-0 flex-1 items-start justify-center overscroll-contain bg-card p-5 sm:p-8 lg:h-full lg:overflow-y-auto lg:rounded-[2rem] lg:p-10 xl:p-14"
      >
        <div className="w-full max-w-lg">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center">
              <BookOpen className="mr-3 h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold text-primary">Aprendify</h1>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="ml-auto h-10 w-10 rounded-full"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>

          <div className="mb-6 hidden justify-end lg:flex">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-10 w-10 rounded-full"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>

          {/* Header do formulário */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-7"
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2 sm:text-4xl">
              {isLogin ? "Bem-vindo de volta" : "Criar sua conta"}
            </h2>
            <p className="text-muted-foreground text-lg">
              {isLogin ? "Entre com suas credenciais para continuar" : "Preencha os dados para começar sua jornada"}
            </p>
          </motion.div>

          {/* Formulário */}
          {authMessage && (
            <div role="alert" aria-live="assertive" className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {authMessage}
            </div>
          )}

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
                      name="fullName"
                      autoComplete="name"
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
                      name="email"
                      autoComplete="email"
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
                      name="username"
                      autoComplete="username"
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
                      name="password"
                      autoComplete={isLogin ? "current-password" : "new-password"}
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
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPassword}
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
                      name="confirmPassword"
                      autoComplete="new-password"
                      aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
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
                      aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                      aria-pressed={showConfirmPassword}
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
                      name="birthdate"
                      autoComplete="bday"
                      onChange={(e) => setBirthdate(e.target.value)}
                      onFocus={() => setFocusedInput("birthdate")}
                      onBlur={() => setFocusedInput(null)}
                      required
                      disabled={loading}
                      className="h-12 text-base transition-all duration-300"
                    />
                  </div>
                </motion.div>

                {/* Idade calculada e dados opcionais de personalização */}
                <div className="space-y-4 rounded-xl border border-primary/15 bg-primary/[0.03] p-4 sm:p-5">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Personalize sua experiência <span className="font-normal text-muted-foreground">(opcional)</span></p>
                    <p className="mt-1 text-xs text-muted-foreground">Essas respostas ajudam a melhorar recomendações e comunicações.</p>
                  </div>
                  {calculatedAge !== null && <p className="rounded-lg bg-background px-3 py-2 text-sm text-muted-foreground" role="status">Você tem <span className="font-semibold text-foreground">{calculatedAge} anos</span>.</p>}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="state">Estado</Label><select id="state" value={state} onChange={(e) => setState(e.target.value)} disabled={loading} className="flex h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 md:text-sm"><option value="">Selecione</option>{["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></div>
                    <div className="space-y-2"><Label htmlFor="city">Cidade</Label><Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Sua cidade" maxLength={80} disabled={loading} className="h-12 text-base" /></div>
                    <div className="space-y-2"><Label htmlFor="currentSituation">Situação atual</Label><select id="currentSituation" value={currentSituation} onChange={(e) => setCurrentSituation(e.target.value)} disabled={loading} className="flex h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 md:text-sm"><option value="">Selecione</option><option>Ensino médio</option><option>Concluí o ensino médio</option><option>Estou no cursinho</option><option>Faculdade</option><option>Já trabalho</option></select></div>
                    <div className="space-y-2"><Label htmlFor="mainGoal">Objetivo principal</Label><select id="mainGoal" value={mainGoal} onChange={(e) => setMainGoal(e.target.value)} disabled={loading} className="flex h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 md:text-sm"><option value="">Selecione</option><option>Passar no ENEM</option><option>Entrar em uma faculdade específica</option><option>Melhorar minha nota</option><option>Conseguir bolsa</option></select></div>
                    <div className="space-y-2"><Label htmlFor="examYear">Ano da prova pretendida</Label><select id="examYear" value={examYear} onChange={(e) => setExamYear(e.target.value)} disabled={loading} className="flex h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 md:text-sm"><option value="">Selecione</option><option value="2026">2026</option><option value="2027">2027</option><option value="2028">2028 ou depois</option></select></div>
                    <div className="space-y-2"><Label htmlFor="studyPreference">Preferência de estudo</Label><select id="studyPreference" value={studyPreference} onChange={(e) => setStudyPreference(e.target.value)} disabled={loading} className="flex h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 md:text-sm"><option value="">Selecione</option><option>Manhã</option><option>Tarde</option><option>Noite</option><option>Madrugada</option></select></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="signupSource">Como conheceu o Aprendify?</Label><select id="signupSource" value={signupSource} onChange={(e) => setSignupSource(e.target.value)} disabled={loading} className="flex h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 md:text-sm"><option value="">Selecione</option><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Indicação</option><option>Google</option><option>Outro</option></select></div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground"><input type="checkbox" checked={acceptsMarketing} onChange={(e) => setAcceptsMarketing(e.target.checked)} disabled={loading} className="mt-0.5 h-4 w-4 rounded border-input accent-primary" /> <span>Quero receber novidades, dicas de estudo e ofertas do Aprendify.</span></label>
                </div>

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
                      name="phone"
                      autoComplete="tel"
                      onChange={(e) => {
                        // Aplica máscara de telefone (00) 00000-0000
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 11) {
                          value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
                          value = value.replace(/(\d{5})(\d)/, '$1-$2');
                        }
                        setPhone(value);
                      }}
                      onFocus={() => setFocusedInput("phone")}
                      onBlur={() => setFocusedInput(null)}
                      required
                      disabled={loading}
                      maxLength={15}
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
                      name="username-or-email"
                      autoComplete="username"
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
                      name="password"
                      autoComplete="current-password"
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
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPassword}
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

            <p className="pt-2 text-center text-xs leading-5 text-muted-foreground">
              Ao continuar, você concorda com os <Link className="text-primary hover:underline" to="/termos-de-servico">Termos de Serviço</Link> e a <Link className="text-primary hover:underline" to="/politica-de-privacidade">Política de Privacidade</Link>.
            </p>
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
                    name="email"
                    autoComplete="email"
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
        {forgotMessage && (
          <p role="status" aria-live="polite" className="sr-only">{forgotMessage}</p>
        )}
      </Dialog>

      <Dialog open={Boolean(mfaChallenge)} onOpenChange={(open) => {
        if (!open && !mfaLoading) {
          setMfaChallenge(null);
          setMfaCode("");
          void supabase.auth.signOut({ scope: "local" });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirme sua identidade</DialogTitle>
            <DialogDescription>
              Digite o código de 6 dígitos exibido no seu aplicativo autenticador para continuar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMfaVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfaCode">Código do autenticador</Label>
              <Input
                id="mfaCode"
                name="mfaCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={mfaLoading}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={mfaLoading || mfaCode.length !== 6}>
              {mfaLoading ? "Verificando..." : "Confirmar código"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </MotionConfig>
  );
};

export const AuthPage = Auth;
export default Auth;
