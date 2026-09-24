import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { usePremium } from "@/hooks/usePremium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Crown, 
  CreditCard, 
  Calendar, 
  Clock3,
  Settings, 
  Loader2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageLoader } from "@/components/ui/page-loader";
import { getPlanLabel as getCatalogPlanLabel } from "../catalog";
import { formatTrialDeadline } from "../trialPresentation";
import { canActivateTrial, readTrialReturn } from "../trialCheckout";
import { confirmTrialCheckout, createTrialCheckoutSession } from "../services/trialCheckoutService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SubscriptionDetails {
  id: string;
  status: string;
  plan_type: string | null;
  start_date: string | null;
  end_date: string | null;
  stripe_subscription_id: string | null;
}

/**
 * Página de Assinatura do usuário
 * Permite assinar o Premium ou gerenciar a assinatura atual via Stripe
 */
interface SubscriptionPageProps {
  embedded?: boolean;
}

export default function Subscription({ embedded = false }: SubscriptionPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const { isPremium, isLoading: isPremiumLoading, trialStatus, trialEndsAt, isSubscribed, refreshPremiumStatus } = usePremium();
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isTrialCheckoutLoading, setIsTrialCheckoutLoading] = useState(false);
  const [trialCheckoutError, setTrialCheckoutError] = useState<string | null>(null);
  const [trialConfirmationState, setTrialConfirmationState] = useState<"idle" | "confirming" | "error" | "success" | "cancelled">("idle");
  const [pendingTrialSessionId, setPendingTrialSessionId] = useState<string | null>(null);
  const [confirmedTrialEndsAt, setConfirmedTrialEndsAt] = useState<string | null>(null);
  const [confirmationAttempt, setConfirmationAttempt] = useState(0);
  const attemptedTrialConfirmation = useRef<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    const returned = readTrialReturn(searchParams);
    if (returned.sessionId) {
      setPendingTrialSessionId(returned.sessionId);
      setTrialConfirmationState("confirming");
      return;
    }
    if (returned.cancelled) {
      setTrialConfirmationState("cancelled");
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("trial");
      setSearchParams(nextParams, { replace: true });
    } else {
      return;
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!pendingTrialSessionId) return;
    const attemptKey = `${pendingTrialSessionId}:${confirmationAttempt}`;
    if (attemptedTrialConfirmation.current === attemptKey) return;
    attemptedTrialConfirmation.current = attemptKey;
    let active = true;
    setTrialConfirmationState("confirming");

    void confirmTrialCheckout(pendingTrialSessionId).then((confirmed) => {
      if (!active) return;
      setConfirmedTrialEndsAt(confirmed.trial_ends_at);
      setTrialConfirmationState("success");
      setPendingTrialSessionId(null);
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        if (nextParams.get("trial_session") === pendingTrialSessionId) {
          nextParams.delete("trial_session");
        }
        return nextParams;
      }, { replace: true });
      refreshPremiumStatus();
    }).catch(() => {
      if (!active) return;
      attemptedTrialConfirmation.current = null;
      setTrialConfirmationState("error");
    });

    return () => { active = false; };
  }, [confirmationAttempt, pendingTrialSessionId, refreshPremiumStatus, setSearchParams]);

  const subscriptionViewState = subscriptionError
    ? "error"
    : trialStatus === "active" && !isSubscribed
      ? "trial-active"
      : trialStatus === "expired" && !isSubscribed
        ? "trial-expired"
        : !isPremium && !isSubscribed
          ? "free"
          : "subscription";

  const fetchSubscription = useCallback(async () => {
    setIsLoading(true);
    setSubscriptionError(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAuthenticated(false);
        navigate("/auth");
        return;
      }
      setIsAuthenticated(true);

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error("Error fetching subscription:", error);
      setSubscriptionError(true);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  const beginTrialCheckout = async () => {
    setIsTrialCheckoutLoading(true);
    setTrialCheckoutError(null);
    try {
      const { url } = await createTrialCheckoutSession();
      window.location.assign(url);
    } catch (error) {
      setTrialCheckoutError(error instanceof Error ? error.message : "Não foi possível iniciar o teste. Tente novamente.");
      setIsTrialCheckoutLoading(false);
    }
  };

  const retryTrialConfirmation = () => {
    attemptedTrialConfirmation.current = null;
    setTrialConfirmationState("confirming");
    setConfirmationAttempt((attempt) => attempt + 1);
  };

  const canOfferTrial = canActivateTrial(trialStatus, isSubscribed, isAuthenticated)
    && !pendingTrialSessionId
    && !["confirming", "error", "success"].includes(trialConfirmationState);

  const openCustomerPortal = async (mode: "manage" | "cancel" = "manage") => {
    setIsPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        return;
      }

      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.isAdminGrant) {
        toast.info("Sua assinatura foi concedida pelo administrador e não requer gerenciamento pelo Stripe.");
        return;
      }

      if (data?.url) {
        if (mode === "cancel") {
          toast.info("Você será redirecionado para o portal do Stripe para confirmar o cancelamento.");
        }
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error("URL do portal não recebida");
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error(mode === "cancel" ? "Erro ao abrir o portal de cancelamento" : "Erro ao abrir o portal de gerenciamento");
    } finally {
      setIsPortalLoading(false);
      setShowCancelDialog(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "authorized":
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Ativa
          </Badge>
        );
      case "cancelled":
      case "canceled":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelada
          </Badge>
        );
      case "payment_failed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Pagamento Pendente
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {status}
          </Badge>
        );
    }
  };

  const getPlanLabel = (planType: string | null) => {
    switch (planType) {
      case "annual":
        return "Completo";
      case "monthly":
        return "Prática";
      case "god":
        return "Administrador";
      case "creator":
        return "Criador";
      default:
        return getCatalogPlanLabel(planType);
    }
  };

  return (
    <div className={embedded ? "w-full" : "min-h-screen bg-background app-layout-container"}>
      {!embedded && <Navbar />}
      
      <main className={embedded ? "w-full" : "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"}>
        <PageLoader loading={isLoading || isPremiumLoading} variant="default">
          <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gerenciar Assinatura</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Gerencie sua assinatura e métodos de pagamento</p>
              </div>
            </div>

            <motion.div
              key={subscriptionViewState}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: "easeOut" }}
            >
            {trialConfirmationState !== "idle" && (
              <Card
                role={trialConfirmationState === "error" ? "alert" : "status"}
                aria-live={trialConfirmationState === "error" ? "assertive" : "polite"}
                className={`mb-5 ${trialConfirmationState === "success" ? "border-green-500/30 bg-green-500/[0.04]" : trialConfirmationState === "error" ? "border-destructive/30" : "border-primary/20"}`}
              >
                <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold">
                      {trialConfirmationState === "confirming" ? "Confirmando seu teste grátis" : null}
                      {trialConfirmationState === "error" ? "Não foi possível confirmar o teste" : null}
                      {trialConfirmationState === "success" ? "Teste grátis do Completo ativado" : null}
                      {trialConfirmationState === "cancelled" ? "Você não ativou o teste" : null}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {trialConfirmationState === "confirming" ? "Estamos validando sua confirmação com segurança. Seu acesso só muda depois que o servidor confirmar." : null}
                      {trialConfirmationState === "error" ? "A confirmação ainda não foi recebida. Você pode tentar novamente; não inicie outro checkout enquanto verificamos." : null}
                      {trialConfirmationState === "success" ? `Acesso grátis por 3 dias, até ${formatTrialDeadline(confirmedTrialEndsAt) ?? "a data confirmada pelo Stripe"}. Sem cobrança automática.` : null}
                      {trialConfirmationState === "cancelled" ? "Você não ativou o teste. Não houve cobrança." : null}
                    </p>
                  </div>
                  {trialConfirmationState === "confirming" && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-label="Confirmando" />}
                  {trialConfirmationState === "error" && (
                    <Button type="button" variant="outline" onClick={retryTrialConfirmation}>
                      Tentar confirmar novamente
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
            {subscriptionError ? (
              <Card role="alert" className="border-destructive/30">
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h2 className="font-semibold">Não foi possível carregar sua assinatura</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Tente novamente. Seu acesso e suas informações de pagamento não foram alterados.</p>
                  </div>
                  <Button type="button" onClick={() => void fetchSubscription()} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Tentar novamente
                  </Button>
                </CardContent>
              </Card>
            ) : trialStatus === "active" && !isSubscribed ? (
              <Card className="border-primary/30 bg-primary/[0.04] shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    Teste grátis do plano Completo
                  </CardTitle>
                  <CardDescription>Você tem acesso aos recursos do Completo sem cobrança e sem cadastrar cartão.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-lg border border-border/60 bg-background p-4">
                    <p className="text-sm text-muted-foreground">Seu acesso de teste termina em</p>
                    <p className="mt-1 font-semibold text-foreground">{formatTrialDeadline(trialEndsAt) ?? "A data de encerramento será atualizada em instantes."}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">O Stripe registra uma assinatura em período de teste, sem cobrança durante os 3 dias. Sem forma de pagamento cadastrada, ela é cancelada ao terminar. Para continuar depois, escolha um plano mensal ou anual.</p>
                  <Button size="lg" onClick={() => navigate("/planos")}>
                    Conhecer os planos
                  </Button>
                </CardContent>
              </Card>
            ) : trialStatus === "expired" && !isSubscribed ? (
              <Card className="border-amber-500/30 bg-amber-500/[0.04] shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock3 className="h-5 w-5 text-amber-600" />
                    Seu período de teste terminou
                  </CardTitle>
                  <CardDescription>Seu acesso voltou ao plano Básico. Contrate quando quiser continuar com os recursos do Completo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Escolha entre o plano Prática mensal ou Completo anual. Nenhuma cobrança é feita sem você iniciar uma contratação.</p>
                  <Button size="lg" onClick={() => navigate("/planos")}>
                    Ver planos mensais e anuais
                  </Button>
                </CardContent>
              </Card>
            ) : !isPremium && !isSubscribed ? (
              <Card className="border-2 border-primary/20 shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-4">
                    <Crown className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Você está na versão Gratuita</h2>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto text-sm sm:text-base">
                    Desbloqueie questões ilimitadas, IA explicativa, correções de redação e simulados oficiais a partir de apenas <strong>R$ 9,90/mês</strong>.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button 
                      size="lg" 
                      className="w-full sm:w-auto shadow-md shadow-primary/20"
                      onClick={() => navigate("/planos")}
                    >
                      Ver Página de Ofertas & Combos
                    </Button>
                  </div>
                  {canOfferTrial && (
                    <section className="mx-auto mt-7 max-w-xl rounded-xl border border-primary/20 bg-primary/[0.035] p-5 text-left" aria-labelledby="trial-offer-heading">
                      <h3 id="trial-offer-heading" className="font-semibold text-foreground">Experimente o Completo por 3 dias</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Confirme o teste no Stripe para ativar seu acesso. Não é necessário cadastrar cartão e não há cobrança automática.</p>
                      {trialCheckoutError && <p id="trial-checkout-error" className="mt-3 text-sm text-destructive" role="alert">{trialCheckoutError}</p>}
                      <Button
                        type="button"
                        size="lg"
                        className="mt-4 w-full sm:w-auto"
                        onClick={() => void beginTrialCheckout()}
                        disabled={isTrialCheckoutLoading}
                        aria-describedby={trialCheckoutError ? "trial-checkout-error" : undefined}
                      >
                        {isTrialCheckoutLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                        {isTrialCheckoutLoading ? "Abrindo confirmação segura…" : "Ativar teste grátis por 3 dias"}
                      </Button>
                    </section>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Status Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-primary" />
                      Status da Assinatura
                    </CardTitle>
                    <CardDescription>
                      Informações sobre sua assinatura atual
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      {subscription ? getStatusBadge(subscription.status) : (
                        <Badge variant="secondary">Não encontrada</Badge>
                      )}
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Plano</span>
                      <span className="font-medium">
                        {subscription ? getPlanLabel(subscription.plan_type) : "—"}
                      </span>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Data de início</span>
                      <span className="font-medium">
                        {subscription?.start_date 
                          ? format(new Date(subscription.start_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : "—"}
                      </span>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Próxima cobrança</span>
                      <span className="font-medium">
                        {subscription?.end_date 
                          ? format(new Date(subscription.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Management Card */}
                {subscription?.stripe_subscription_id && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Gerenciamento
                      </CardTitle>
                      <CardDescription>
                        Gerencie sua assinatura pelo portal do Stripe
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        No portal de gerenciamento você pode:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        <li className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-primary" />
                          Atualizar seu método de pagamento
                        </li>
                        <li className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          Alterar seu plano (mensal/anual)
                        </li>
                        <li className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-primary" />
                          Cancelar sua assinatura
                        </li>
                      </ul>
                      
                      <div className="grid gap-3 sm:grid-cols-2 mt-4">
                        <Button
                          onClick={() => void openCustomerPortal("manage")}
                          disabled={isPortalLoading}
                          className="w-full"
                        >
                          {isPortalLoading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <ExternalLink className="w-4 h-4 mr-2" />
                          )}
                          Gerenciar plano
                        </Button>

                        <Button
                          onClick={() => setShowCancelDialog(true)}
                          variant="destructive"
                          disabled={isPortalLoading}
                          className="w-full"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancelar plano
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Info Card */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-medium text-foreground mb-1">
                          Dúvidas sobre sua assinatura?
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Se você tiver qualquer problema com sua assinatura ou pagamento, 
                          entre em contato conosco pelo email de suporte.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            </motion.div>
          </div>
        </PageLoader>
        </main>
        
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
              <AlertDialogDescription>
                Ao confirmar, você será redirecionado para o portal do Stripe para concluir o cancelamento do plano ativo.
                Seus benefícios premium continuarão disponíveis até o fim do período atual.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Manter assinatura</AlertDialogCancel>
              <AlertDialogAction onClick={() => void openCustomerPortal("cancel")}>
                Continuar para o cancelamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  );
}
