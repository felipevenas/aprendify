import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Crown, Star, Sparkles, Loader2, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createCheckoutSession } from "../services/checkoutService";
import { RemoteFailure, retryAfterLabel } from "@/features/auth/services/remoteErrors";
import { PLAN_CATALOG } from "../catalog";

interface PremiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPremium?: boolean;
  title?: string;
  description?: string;
}

type PlanType = "monthly" | "annual";

const PLANS = {
  monthly: {
    price: PLAN_CATALOG.monthly.price,
    period: "mês",
  },
  annual: {
    price: PLAN_CATALOG.annual.price,
    period: "ano",
    monthlyEquivalent: 7.92,
    discount: 20,
  },
};

export const PremiumModal = ({ open, onOpenChange, isPremium = false, title, description }: PremiumModalProps) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("annual");
  const [isLoading, setIsLoading] = useState(false);
  
  // Estado do cupom de desconto
  const [couponCode, setCouponCode] = useState("");
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [checkoutError, setCheckoutError] = useState<RemoteFailure | null>(null);

  const benefits = [
    "Questões ilimitadas por dia",
    "Todas as questões explicadas",
    "Flashcards ilimitados",
    "Correções de redação conforme o limite do plano",
    "Acesso completo às estatísticas",
    "Matérias personalizadas ilimitadas",
    "Histórico completo de desempenho",
    "Suporte prioritário",
    "Novos recursos em primeira mão",
  ];

  // Função para iniciar o processo de assinatura
  const handleSubscribe = async () => {
    setCheckoutError(null);
    setIsLoading(true);
    try {
      const checkout = await createCheckoutSession(selectedPlan === "monthly" ? "starter" : "annual", false, couponCode);
      window.open(checkout.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      const failure = error instanceof RemoteFailure ? error : new RemoteFailure(500, "Não foi possível iniciar o pagamento. Tente novamente.", "server_error");
      setCheckoutError(failure);
      toast.error(failure.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função para limpar o cupom
  const handleClearCoupon = () => {
    setCouponCode("");
    setShowCouponInput(false);
  };

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) {
        throw new Error(error.message);
      }

      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        throw new Error("Não foi possível acessar o portal");
      }
    } catch (error) {
      console.error("Erro ao acessar portal:", error);
      toast.error("Erro ao acessar gerenciamento. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-w-[95vw] p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2 sm:mb-3">
            <div
              className={cn(
                "w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center",
                isPremium
                  ? "bg-gradient-to-br from-yellow-500 to-amber-500"
                  : "bg-gradient-to-br from-primary to-primary/60",
              )}
            >
              <Crown className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl sm:text-2xl">
            {isPremium ? "Você é Premium!" : title || "Assine o Plano Premium"}
          </DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base">
            {isPremium ? "Confira todos os benefícios que você possui" : description || "Desbloqueie todo o potencial do Aprendify"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 sm:py-3">
          {!isPremium && (
            <div className="flex items-center justify-center gap-1 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setSelectedPlan("monthly")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all",
                  selectedPlan === "monthly"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Prática (Mensal)
              </button>
              <button
                onClick={() => setSelectedPlan("annual")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all relative",
                  selectedPlan === "annual"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Completo (Anual)
                <span className="absolute -top-2 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded-full">
                  -20%
                </span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-2">
                <div
                  className={cn(
                    "w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                    isPremium ? "bg-green-500/20" : "bg-primary/10",
                  )}
                >
                  <Check className={cn("w-2.5 h-2.5 sm:w-3 sm:h-3", isPremium ? "text-green-600" : "text-primary")} />
                </div>
                <span className="text-xs sm:text-sm leading-snug">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t">
            {checkoutError && !isPremium && (
              <div role="alert" aria-live="assertive" className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <p>{checkoutError.message}</p>
                {retryAfterLabel(checkoutError.retryAfterSeconds) && <p className="mt-1 text-xs">{retryAfterLabel(checkoutError.retryAfterSeconds)}</p>}
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void handleSubscribe()} disabled={isLoading}>
                  Tentar novamente
                </Button>
              </div>
            )}
            {isPremium ? (
              <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-600">Assinatura Ativa</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Obrigado por apoiar o Aprendify! Aproveite todos os recursos premium.
                </p>
                <Button 
                  onClick={handleManageSubscription} 
                  variant="outline" 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Gerenciar Assinatura
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  {selectedPlan === "annual" ? (
                    <>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="text-lg text-muted-foreground line-through">
                          R$ {(PLANS.monthly.price * 12).toFixed(2).replace(".", ",")}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-bold bg-green-500/10 text-green-600 rounded-full">
                          Economize R$ {(PLANS.monthly.price * 12 - PLANS.annual.price).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                      <p className="text-3xl sm:text-4xl font-bold">
                        R$ {PLANS.annual.price.toFixed(2).replace(".", ",")}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        por ano{" "}
                        <span className="text-primary">
                          (≈ R$ {PLANS.annual.monthlyEquivalent.toFixed(2).replace(".", ",")}/mês)
                        </span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-3xl sm:text-4xl font-bold">
                        R$ {PLANS.monthly.price.toFixed(2).replace(".", ",")}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">por mês</p>
                    </>
                  )}
                </div>

                {/* Campo de cupom de desconto */}
                <div className="mb-4">
                  {showCouponInput ? (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Digite seu cupom"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          className="pl-9 uppercase"
                          maxLength={20}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleClearCoupon}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCouponInput(true)}
                      className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1 mx-auto"
                    >
                      <Tag className="h-3 w-3" />
                      Tenho um cupom de desconto
                    </button>
                  )}
                </div>

                <Button 
                  onClick={handleSubscribe} 
                  className="w-full h-11 text-sm sm:text-base" 
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  {selectedPlan === "annual" ? "Assinar Plano Anual" : "Assinar Plano Mensal"}
                </Button>

                <p className="text-[10px] sm:text-xs text-center text-muted-foreground mt-2">
                  Pagamento seguro via Stripe • Cancele quando quiser
                </p>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PremiumModal;
