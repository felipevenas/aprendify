import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  BookOpen, 
  Crown, 
  Sparkles, 
  Check, 
  X, 
  Zap, 
  ShieldCheck, 
  CreditCard, 
  ArrowRight, 
  Clock, 
  Brain, 
  Target, 
  HelpCircle, 
  Tag, 
  Loader2, 
  CheckCircle2, 
  Lock, 
  Flame, 
  FileText,
  Star,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createCheckoutSession } from "../services/checkoutService";
import { RemoteFailure, retryAfterLabel } from "@/features/auth/services/remoteErrors";

// Preços oficiais do Stripe
const STRIPE_PRICES = {
  starter: {
    name: "Prática",
    price: 9.90,
    period: "/mês",
    description: "Ideal para estudar sem travas com questões ilimitadas e IA explicativa.",
  },
  annual: {
    name: "Completo",
    price: 95.04,
    monthlyEquivalent: 7.92,
    period: "/ano",
    discount: 20,
    description: "Preparação completa com simulados TRI e plano de estudos até o ENEM.",
  },
};

// Order bump opcional (add-on)
const ORDER_BUMP = {
  title: "Combo Redação (+5 Redações IA)",
  description: "Desbloqueie 5 análises aprofundadas adicionais com notas detalhadas nas 5 competências do ENEM.",
  price: 7.90,
};

export default function SalesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "annual">(
    searchParams.get("plano") === "starter" ? "starter" : "annual"
  );
  const [includeOrderBump, setIncludeOrderBump] = useState(searchParams.get("bump") === "redacao");
  const [couponCode, setCouponCode] = useState(searchParams.get("cupom") || "");
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [checkoutError, setCheckoutError] = useState<RemoteFailure | null>(null);

  // Monitora usuário autenticado
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user);
    });
  }, []);

  // Preço calculado em tempo real
  const currentPlanData = STRIPE_PRICES[selectedPlan];
  const totalPrice = (currentPlanData.price + (includeOrderBump ? ORDER_BUMP.price : 0)).toFixed(2);

  const handleCheckout = async () => {
    // Se não estiver logado, pede cadastro rápido para associar a conta
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    setIsLoading(true);
    setCheckoutError(null);
    try {
      const checkout = await createCheckoutSession(selectedPlan, includeOrderBump, couponCode);
      window.location.href = checkout.url;
    } catch (error) {
      const failure = error instanceof RemoteFailure ? error : new RemoteFailure(500, "Não foi possível iniciar o pagamento. Tente novamente.", "server_error");
      setCheckoutError(failure);
      toast.error(failure.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background text-foreground selection:bg-primary/20">
      {/* Top Banner de Urgência */}
      <div className="bg-primary/95 text-primary-foreground py-2 px-4 text-center text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-sm">
        <Flame className="w-4 h-4 animate-bounce text-amber-300" />
        <span>Oferta Especial de Temporada ENEM: Acesso liberado a partir de <strong>R$ 9,90</strong>. Cancele quando quiser.</span>
      </div>

      {/* Header de Navegação */}
      <header className="border-b border-border/40 backdrop-blur-md bg-background/80 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">Aprendify</span>
          </Link>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                Meu Painel
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                Já sou aluno
              </Button>
            )}
            <Button size="sm" onClick={() => {
              const checkoutSection = document.getElementById("checkout-box");
              checkoutSection?.scrollIntoView({ behavior: "smooth" });
            }}>
              Quero Minha Vaga
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-12 pb-16 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/20 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          A Revolução nos Estudos para o ENEM
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-tight sm:leading-none">
          Sua nota <span className="text-primary underline decoration-primary/30 underline-offset-8">800+ no ENEM</span> por menos do que um cafezinho por mês.
        </h1>

        <p className="mt-6 text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Pratique com mais de <strong>2.700 questões reais</strong> com explicações passo a passo por IA, redações corrigidas pelas 5 competências e simulados com cálculo de nota TRI.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button 
            size="lg" 
            className="w-full sm:w-auto text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all gap-2"
            onClick={() => {
              const el = document.getElementById("checkout-box");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Garantir Desconto Agora
            <ArrowRight className="w-5 h-5" />
          </Button>

          <Button 
            variant="outline" 
            size="lg" 
            className="w-full sm:w-auto text-base px-6 py-6 rounded-xl border-border/80 hover:bg-muted/50"
            onClick={() => navigate("/auth")}
          >
            Testar Versão Gratuita
          </Button>
        </div>

        {/* Micro Prova Social */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Sem fidelidade (Cancele em 1 clique)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Pagamento 100% Seguro no Stripe</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Garantia incondicional de 7 dias</span>
          </div>
        </div>
      </section>

      {/* A Escada de Valor (Value Ladder / 3 Níveis) */}
      <section className="py-12 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Escolha como você quer se preparar
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            Comece no seu ritmo. Você pode começar gratuitamente e migrar de plano quando quiser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {/* Degrau 0: Grátis */}
          <Card className="flex flex-col justify-between border-border/60 hover:border-border transition-all">
            <CardHeader className="pb-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Degrau 1: Gratuito
              </div>
              <CardTitle className="text-2xl font-bold">Básico</CardTitle>
              <CardDescription>Para testar e criar hábito</CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-extrabold">R$ 0</span>
                <span className="text-muted-foreground text-sm"> / sempre</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm flex-1">
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>10 questões do ENEM por dia</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>1 correção de redação por mês</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Cronômetro Pomodoro de estudos</span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <X className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                <span className="line-through">Explicações detalhadas por IA</span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <X className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                <span className="line-through">Simulados completos com TRI</span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <X className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                <span className="line-through">Caderno de Erros Inteligente</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate(currentUser ? "/questions" : "/auth")}
              >
                {currentUser ? "Ir para Questões" : "Cadastrar Grátis"}
              </Button>
            </CardFooter>
          </Card>

          {/* Degrau 1: Low Ticket Prática (R$ 9,90) */}
          <Card className={cn(
            "flex flex-col justify-between relative border-2 transition-all shadow-md",
            selectedPlan === "starter" ? "border-primary bg-primary/[0.02]" : "border-border/60 hover:border-primary/50"
          )}>
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground text-xs px-3 py-1 font-semibold uppercase tracking-wider shadow">
                ⚡ Mais Popular (R$ 9,90)
              </Badge>
            </div>
            <CardHeader className="pb-4 pt-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                Degrau 2: Entrada
              </div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                Prática
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              </CardTitle>
              <CardDescription>O impulso imediato para estudar sem travas</CardDescription>
              <div className="pt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">R$ 9,90</span>
                <span className="text-muted-foreground text-sm"> / mês</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Custa menos de R$ 0,33 por dia.</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm flex-1">
              <div className="flex items-center gap-2.5 font-medium text-foreground">
                <Check className="w-4 h-4 text-primary shrink-0" />
                <span><strong>Questões ilimitadas</strong> por dia</span>
              </div>
              <div className="flex items-center gap-2.5 font-medium text-foreground">
                <Check className="w-4 h-4 text-primary shrink-0" />
                <span><strong>IA Explicativa</strong> em todas as questões</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-primary shrink-0" />
                <span><strong>4 correções</strong> de redação por mês</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-primary shrink-0" />
                <span>Caderno de Erros desbloqueado</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-primary shrink-0" />
                <span>Flashcards ilimitados</span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Check className="w-4 h-4 text-primary shrink-0" />
                <span>Sem contrato de fidelidade</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant={selectedPlan === "starter" ? "default" : "secondary"}
                className="w-full font-semibold"
                onClick={() => {
                  setSelectedPlan("starter");
                  const el = document.getElementById("checkout-box");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {selectedPlan === "starter" ? "Plano Selecionado" : "Escolher Prática (R$ 9,90)"}
              </Button>
            </CardFooter>
          </Card>

          {/* Degrau 2: Upgrade Completo Anual */}
          <Card className={cn(
            "flex flex-col justify-between relative border-2 transition-all shadow-md",
            selectedPlan === "annual" ? "border-amber-500 bg-amber-500/[0.03]" : "border-border/60 hover:border-amber-500/50"
          )}>
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs px-3 py-1 font-semibold uppercase tracking-wider shadow">
                ⭐ Melhor Custo-Benefício
              </Badge>
            </div>
            <CardHeader className="pb-4 pt-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                Degrau 3: Upgrade Completo
              </div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                Completo
                <Crown className="w-5 h-5 text-amber-500 fill-amber-500" />
              </CardTitle>
              <CardDescription>Tudo o que você precisa até o dia da prova</CardDescription>
              <div className="pt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">R$ 7,92</span>
                <span className="text-muted-foreground text-sm"> / mês</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cobrado anualmente: <strong>R$ 95,04/ano</strong> (20% de economia direta).
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm flex-1">
              <div className="flex items-center gap-2.5 font-medium text-foreground">
                <Check className="w-4 h-4 text-amber-500 shrink-0" />
                <span><strong>Tudo do plano Prática</strong> incluído</span>
              </div>
              <div className="flex items-center gap-2.5 font-medium text-foreground">
                <Check className="w-4 h-4 text-amber-500 shrink-0" />
                <span><strong>Correções</strong> de redação conforme o limite do plano</span>
              </div>
              <div className="flex items-center gap-2.5 font-medium text-foreground">
                <Check className="w-4 h-4 text-amber-500 shrink-0" />
                <span><strong>Simulados com cálculo TRI</strong> oficial</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Gerador de Cronograma com IA</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Relatórios avançados de desempenho</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Acesso prioritário a novos recursos</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant={selectedPlan === "annual" ? "default" : "secondary"}
                className={cn(
                  "w-full font-semibold",
                  selectedPlan === "annual" && "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                )}
                onClick={() => {
                  setSelectedPlan("annual");
                  const el = document.getElementById("checkout-box");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {selectedPlan === "annual" ? "Plano Selecionado" : "Escolher Completo (20% OFF)"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Caixa de Fechamento / Checkout Box Unificado */}
      <section id="checkout-box" className="py-12 px-4 sm:px-6 max-w-3xl mx-auto">
        <Card className="border-2 border-primary/40 shadow-2xl bg-card relative overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-md">
                  Checkout Direto Seguro
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold mt-2">
                  Ative seu acesso agora
                </h3>
                <p className="text-primary-foreground/90 text-sm mt-1">
                  Selecione seu plano e conclua pelo Stripe com cartão, PIX ou boleto.
                </p>
              </div>
              <Lock className="w-10 h-10 text-white/40 hidden sm:block" />
            </div>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Seletor de Plano */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-3 block">
                1. Selecione o plano desejado:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan("starter")}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between",
                    selectedPlan === "starter"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border hover:border-border/80"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base">Prática</span>
                    <Badge variant="secondary" className="text-xs">R$ 9,90/mês</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Acesso mensal flexível, sem fidelidade.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan("annual")}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between",
                    selectedPlan === "annual"
                      ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/30"
                      : "border-border hover:border-border/80"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base flex items-center gap-1.5">
                      Completo
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    </span>
                    <Badge className="bg-amber-500 text-white text-xs">20% OFF</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    R$ 95,04/ano (equivale a R$ 7,92/mês).
                  </p>
                </button>
              </div>
            </div>

            <Separator />

            {/* Order Bump (Add-on com 1 clique) */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-3 block">
                2. Oferta exclusiva desta página (Opcional):
              </label>
              <label
                htmlFor="order-bump"
                className={cn(
                  "p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 focus-within:ring-2 focus-within:ring-emerald-500",
                  includeOrderBump 
                    ? "border-emerald-500 bg-emerald-500/[0.06] shadow-sm" 
                    : "border-dashed border-border hover:border-emerald-500/50"
                )}
              >
                <Checkbox 
                  id="order-bump"
                  checked={includeOrderBump} 
                  onCheckedChange={(checked) => setIncludeOrderBump(!!checked)}
                  className="mt-1 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" 
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-emerald-500" />
                      {ORDER_BUMP.title}
                    </span>
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/40 bg-emerald-500/10 font-bold">
                      + R$ {ORDER_BUMP.price.toFixed(2)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ORDER_BUMP.description}
                  </p>
                </div>
              </label>
            </div>

            {/* Cupom de Desconto */}
            <div>
              {!showCouponInput && !couponCode ? (
                <button
                  type="button"
                  onClick={() => setShowCouponInput(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <Tag className="w-3.5 h-3.5" />
                  Possui um cupom de desconto ou indicação?
                </button>
              ) : (
                <div className="flex items-center gap-2 max-w-sm">
                  <Input
                    placeholder="DIGITE SEU CUPOM"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="text-xs uppercase font-mono tracking-wider"
                  />
                  {couponCode && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { setCouponCode(""); setShowCouponInput(false); }}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {checkoutError && (
              <div role="alert" aria-live="assertive" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <p>{checkoutError.message}</p>
                {retryAfterLabel(checkoutError.retryAfterSeconds) && <p className="mt-1 text-xs">{retryAfterLabel(checkoutError.retryAfterSeconds)}</p>}
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void handleCheckout()} disabled={isLoading}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {/* Resumo e Botão de Ação */}
            <div className="bg-muted/40 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Plano selecionado ({currentPlanData.name}):</span>
                <span className="font-medium">R$ {currentPlanData.price.toFixed(2)}</span>
              </div>
              {includeOrderBump && (
                <div className="flex items-center justify-between text-sm text-emerald-600">
                  <span>Add-on: Super Combo Redação:</span>
                  <span className="font-medium">+ R$ {ORDER_BUMP.price.toFixed(2)}</span>
                </div>
              )}
              {couponCode && (
                <div className="flex items-center justify-between text-xs text-primary font-medium">
                  <span>Cupom aplicado:</span>
                  <span>{couponCode}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-base sm:text-lg font-bold">
                <span>Total a pagar:</span>
                <span className="text-primary text-xl font-extrabold">
                  R$ {totalPrice} <span className="text-xs font-normal text-muted-foreground">{currentPlanData.period}</span>
                </span>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full py-6 text-base sm:text-lg font-bold rounded-xl shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/40 transition-all gap-2"
              disabled={isLoading}
              onClick={handleCheckout}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Conectando ao Stripe Seguro...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Ir para o Checkout Seguro Stripe ➔
                </>
              )}
            </Button>

            {/* Garantia & Segurança */}
            <div className="flex items-center justify-center gap-6 pt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Garantia de 7 Dias</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-primary" />
                <span>Criptografia 256-bit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>PIX ou Cartão</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Seção Comparativa: Aprendify vs Métodos Tradicionais */}
      <section className="py-12 px-4 sm:px-6 max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h3 className="text-xl sm:text-2xl font-bold">A matemática da sua aprovação</h3>
          <p className="text-sm text-muted-foreground mt-1">Por que continuar gastando centenas de reais todos os meses?</p>
        </div>

        <div className="border border-border/80 rounded-2xl overflow-hidden bg-card shadow-sm">
          <div className="grid grid-cols-3 p-4 bg-muted/50 font-semibold text-xs sm:text-sm border-b border-border/60">
            <div>Benefício / Recurso</div>
            <div className="text-center text-muted-foreground">Cursinho Tradicional</div>
            <div className="text-center text-primary font-bold">Aprendify Starter</div>
          </div>
          <div className="divide-y divide-border/40 text-xs sm:text-sm">
            <div className="grid grid-cols-3 p-4 items-center">
              <span className="font-medium">Custo Mensal</span>
              <span className="text-center text-red-500 font-medium">R$ 150 a R$ 400</span>
              <span className="text-center text-emerald-600 font-bold">R$ 9,90</span>
            </div>
            <div className="grid grid-cols-3 p-4 items-center">
              <span className="font-medium">Correção de Redação</span>
              <span className="text-center text-muted-foreground">Demora 7 a 15 dias</span>
              <span className="text-center text-emerald-600 font-bold">Instantânea com IA</span>
            </div>
            <div className="grid grid-cols-3 p-4 items-center">
              <span className="font-medium">Resoluções Passo a Passo</span>
              <span className="text-center text-muted-foreground">Fila com monitor</span>
              <span className="text-center text-emerald-600 font-bold">IA 24 horas por dia</span>
            </div>
            <div className="grid grid-cols-3 p-4 items-center">
              <span className="font-medium">Caderno de Erros Automático</span>
              <span className="text-center text-muted-foreground">Manual no papel</span>
              <span className="text-center text-emerald-600 font-bold">Totalmente Automatizado</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="py-12 px-4 sm:px-6 max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold">Perguntas Frequentes</h3>
          <p className="text-sm text-muted-foreground mt-1">Tire todas as suas dúvidas antes de começar</p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-3">
          <AccordionItem value="faq-1" className="border rounded-xl px-4 bg-card">
            <AccordionTrigger className="text-left font-medium text-sm sm:text-base">
              Como funciona o plano Starter de R$ 9,90?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
              O Starter é o nosso passe de entrada de baixo custo (Low Ticket). Ele libera questões ilimitadas, acesso total à IA explicativa para aprender o porquê de cada erro, 4 correções de redação mensais e o caderno de erros. Não há fidelidade e você pode cancelar quando quiser diretamente pelo portal Stripe.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-2" className="border rounded-xl px-4 bg-card">
            <AccordionTrigger className="text-left font-medium text-sm sm:text-base">
              Quais formas de pagamento são aceitas?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
              Você pode pagar via Cartão de Crédito, PIX ou Boleto Bancário através do checkout oficial da Stripe, garantindo total segurança dos seus dados.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-3" className="border rounded-xl px-4 bg-card">
            <AccordionTrigger className="text-left font-medium text-sm sm:text-base">
              Posso fazer upgrade do Starter para o Pro Anual depois?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
              Sim! A qualquer momento você pode fazer upgrade para o plano Anual para economizar 20% e destravar 12 redações por mês, simulados TRI e o cronograma gerado por inteligência artificial.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-4" className="border rounded-xl px-4 bg-card">
            <AccordionTrigger className="text-left font-medium text-sm sm:text-base">
              E se eu não gostar da plataforma?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-sm leading-relaxed">
              Você tem 7 dias de garantia incondicional. Se por qualquer motivo achar que a plataforma não atendeu às suas expectativas, basta solicitar o reembolso e devolveremos 100% do valor pago.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-4 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Aprendify. Todos os direitos reservados.</p>
        <p className="mt-1">Preparação de alta performance focada na aprovação do ENEM.</p>
        <div className="mt-3 flex justify-center gap-4 text-sm">
          <Link className="hover:text-foreground" to="/politica-de-privacidade">Política de Privacidade</Link>
          <Link className="hover:text-foreground" to="/termos-de-servico">Termos de Serviço</Link>
        </div>
      </footer>

      {/* Modal de Autenticação Rápida caso o usuário não esteja logado */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crie sua conta em 30 segundos</DialogTitle>
            <DialogDescription>
              Para vincular seu plano e manter seu histórico de estudos salvo, você precisa entrar ou se cadastrar no Aprendify.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Button 
              className="w-full" 
              onClick={() => navigate(`/auth?redirect=/planos&plano=${selectedPlan}`)}
            >
              Criar Conta ou Fazer Login
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => setShowAuthModal(false)}
            >
              Voltar e continuar olhando
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
