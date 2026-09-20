import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CreditCard, Loader2, Lock, ShieldCheck, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createCheckoutSession } from "../services/checkoutService";
import { RemoteFailure, retryAfterLabel } from "@/features/auth/services/remoteErrors";
import { PLAN_CATALOG } from "../catalog";

const PLANS = {
  starter: {
    name: PLAN_CATALOG.monthly.label,
    price: PLAN_CATALOG.monthly.price,
    period: PLAN_CATALOG.monthly.period,
    description: "Questões ilimitadas, IA explicativa e 4 redações por mês.",
  },
  annual: {
    name: PLAN_CATALOG.annual.label,
    price: PLAN_CATALOG.annual.price,
    period: PLAN_CATALOG.annual.period,
    description: "Tudo do Prática, simulados TRI, cronograma IA e 12 redações por mês.",
  },
} as const;

const ORDER_BUMP = {
  title: "Combo Redação",
  price: 7.9,
  description: "+5 análises aprofundadas por IA.",
};

type PlanId = keyof typeof PLANS;

function formatPrice(value: number) {
  return value.toFixed(2).replace(".", ",");
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPlan = searchParams.get("plano");
  const initialPlan: PlanId = requestedPlan === "starter" ? "starter" : "annual";
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(initialPlan);
  const [includeOrderBump, setIncludeOrderBump] = useState(searchParams.get("bump") === "redacao");
  const [couponCode, setCouponCode] = useState(searchParams.get("cupom")?.toUpperCase() || "");
  const [showCoupon, setShowCoupon] = useState(Boolean(searchParams.get("cupom")));
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<RemoteFailure | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setCurrentUser(data.session?.user ? { id: data.session.user.id } : null);
        setAuthChecked(true);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ? { id: session.user.id } : null);
      setAuthChecked(true);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const plan = PLANS[selectedPlan];
  const total = plan.price + (includeOrderBump ? ORDER_BUMP.price : 0);
  const checkoutQuery = new URLSearchParams({ redirect: "/planos", plano: selectedPlan });
  if (includeOrderBump) checkoutQuery.set("bump", "redacao");
  if (couponCode.trim()) checkoutQuery.set("cupom", couponCode.trim().toUpperCase());
  const authUrl = `/auth?${checkoutQuery.toString()}`;

  const handleContinue = async () => {
    setCheckoutError(null);
    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        navigate(authUrl);
        return;
      }

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
    <main className="min-h-screen bg-muted/20 text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="text-lg font-bold tracking-tight">Aprendify</Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Checkout seguro
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Link to={currentUser ? "/dashboard" : "https://aprendify.cloud/#planos"} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="mb-8 max-w-2xl">
          <Badge variant="secondary" className="mb-3">Etapa 1 de 2</Badge>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Escolha seu plano</h1>
          <p className="mt-2 text-muted-foreground">Confirme sua opção. Na próxima etapa, você fará login ou criará sua conta antes do pagamento.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader><CardTitle className="text-lg">Planos disponíveis</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(Object.keys(PLANS) as PlanId[]).map((id) => {
                const option = PLANS[id];
                const isSelected = selectedPlan === id;
                return (
                  <button key={id} type="button" onClick={() => setSelectedPlan(id)} aria-pressed={isSelected}
                    className={cn("w-full rounded-lg border p-4 text-left transition-colors", isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50")}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 font-semibold">
                          {option.name}
                          {id === "annual" && <Badge className="bg-amber-500 text-white">20% OFF</Badge>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-bold">R$ {formatPrice(option.price)}</div>
                        <div className="text-xs text-muted-foreground">{option.period}</div>
                      </div>
                    </div>
                  </button>
                );
              })}

              <Separator className="my-5" />
              <div className="rounded-lg border border-dashed p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox checked={includeOrderBump} onCheckedChange={(checked) => setIncludeOrderBump(Boolean(checked))} className="mt-0.5" />
                  <span className="flex-1"><span className="block font-medium">{ORDER_BUMP.title} <span className="text-emerald-600">+ R$ {formatPrice(ORDER_BUMP.price)}</span></span><span className="text-sm text-muted-foreground">{ORDER_BUMP.description}</span></span>
                </label>
              </div>

              {!showCoupon ? <Button type="button" variant="link" className="h-auto px-0 text-sm" onClick={() => setShowCoupon(true)}><Tag className="mr-1 h-3.5 w-3.5" /> Tenho um cupom</Button> : <Input aria-label="Cupom de desconto" placeholder="Código do cupom" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} />}
            </CardContent>
          </Card>

          <Card className="h-fit lg:sticky lg:top-6">
            <CardHeader><CardTitle className="text-lg">Resumo do pedido</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {checkoutError && (
                <div role="alert" aria-live="assertive" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  <p>{checkoutError.message}</p>
                  {retryAfterLabel(checkoutError.retryAfterSeconds) && <p className="mt-1 text-xs">{retryAfterLabel(checkoutError.retryAfterSeconds)}</p>}
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void handleContinue()} disabled={isLoading}>
                    Tentar novamente
                  </Button>
                </div>
              )}
              <div className="flex justify-between gap-4 text-sm"><span>{plan.name}</span><span>R$ {formatPrice(plan.price)}</span></div>
              {includeOrderBump && <div className="flex justify-between gap-4 text-sm"><span>{ORDER_BUMP.title}</span><span>R$ {formatPrice(ORDER_BUMP.price)}</span></div>}
              <Separator />
              <div className="flex items-end justify-between gap-4"><span className="font-semibold">Total</span><span className="text-right text-xl font-bold text-primary">R$ {formatPrice(total)}<small className="ml-1 text-xs font-normal text-muted-foreground">{plan.period}</small></span></div>
              <Button className="w-full" size="lg" onClick={handleContinue} disabled={isLoading || !authChecked}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aguarde...</> : currentUser ? <><CreditCard className="mr-2 h-4 w-4" /> Ir para pagamento</> : <>Continuar para autenticação <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Você precisará estar autenticado para prosseguir ao Stripe.</p>
              <div className="grid grid-cols-3 gap-2 border-t pt-4 text-center text-[11px] text-muted-foreground"><span><ShieldCheck className="mx-auto mb-1 h-4 w-4 text-emerald-600" />7 dias</span><span><Lock className="mx-auto mb-1 h-4 w-4 text-primary" />Seguro</span><span><Check className="mx-auto mb-1 h-4 w-4 text-emerald-600" />PIX/cartão</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
