import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Crown, Star, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPremium?: boolean;
}

type PlanType = "monthly" | "annual";

const PLANS = {
  monthly: {
    price: 19.9,
    period: "mês",
    mercadoPagoId: "2fab389d1e6546429376b4a50517acd2",
  },
  annual: {
    price: 191.04, // 19.90 * 12 * 0.8 (20% discount)
    period: "ano",
    mercadoPagoId: "aa593ab5788f43a29726b7a45381baaa",
    monthlyEquivalent: 15.92, // 191.04 / 12
    discount: 20,
  },
};

/**
 * Modal de Premium - mostra benefícios da assinatura
 * Se o usuário for premium, mostra os benefícios que ele já possui
 * Se não for, mostra opção de assinar
 */
export const PremiumModal = ({ open, onOpenChange, isPremium = false }: PremiumModalProps) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("annual");

  const benefits = [
    "Questões ilimitadas por dia",
    "Todas as questões explicadas",
    "Flashcards ilimitados",
    "12 correções de redação por mês",
    "Acesso completo às estatísticas",
    "Matérias personalizadas ilimitadas",
    "Histórico completo de desempenho",
    "Suporte prioritário",
    "Novos recursos em primeira mão",
  ];

  const handleSubscribe = () => {
    const plan = PLANS[selectedPlan];
    window.open(
      `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${plan.mercadoPagoId}`,
      "_blank",
    );
  };

  const currentPlan = PLANS[selectedPlan];

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
            {isPremium ? "Você é Premium!" : "Assine o Plano Premium"}
          </DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base">
            {isPremium ? "Confira todos os benefícios que você possui" : "Desbloqueie todo o potencial do Aprendify"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 sm:py-3">
          {/* Seletor de plano - apenas para não premium */}
          {!isPremium && (
            <div className="flex items-center justify-center gap-1 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setSelectedPlan("monthly")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all",
                  selectedPlan === "monthly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Mensal
              </button>
              <button
                onClick={() => setSelectedPlan("annual")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all relative",
                  selectedPlan === "annual"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Anual
                <span className="absolute -top-2 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-green-500 text-white rounded-full">
                  -20%
                </span>
              </button>
            </div>
          )}

          {/* Lista de benefícios */}
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

          {/* Seção inferior - diferente para premium e free */}
          <div className="pt-3 border-t">
            {isPremium ? (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 mb-3">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-600">Assinatura Ativa</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Obrigado por apoiar o Learnify! Aproveite todos os recursos premium.
                </p>
              </div>
            ) : (
              <>
                {/* Preço */}
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

                <Button onClick={handleSubscribe} className="w-full h-11 text-sm sm:text-base" size="lg">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {selectedPlan === "annual" ? "Assinar Plano Anual" : "Assinar Plano Mensal"}
                </Button>

                <p className="text-[10px] sm:text-xs text-center text-muted-foreground mt-2">
                  Pagamento seguro via MercadoPago • Cancele quando quiser
                </p>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
