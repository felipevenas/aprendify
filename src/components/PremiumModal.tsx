import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Crown } from "lucide-react";

interface PremiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PremiumModal = ({ open, onOpenChange }: PremiumModalProps) => {
  const benefits = [
    "Questões ilimitadas por dia",
    "Acesso completo às estatísticas",
    "Matérias personalizadas ilimitadas",
    "Histórico completo de desempenho",
    "Suporte prioritário",
    "Novos recursos em primeira mão",
  ];

  const handleSubscribe = () => {
    window.open(
      "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=2fab389d1e6546429376b4a50517acd2",
      "_blank",
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-w-[95vw] p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2 sm:mb-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Crown className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl sm:text-2xl">Assine o Plano Premium</DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base">
            Desbloqueie todo o potencial do Learnify
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 py-2 sm:py-3">
          <div className="space-y-2 sm:space-y-2.5">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-2 sm:gap-2.5">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                </div>
                <span className="text-xs sm:text-sm leading-snug">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="pt-2 sm:pt-3 border-t">
            <div className="text-center mb-2 sm:mb-3">
              <p className="text-2xl sm:text-3xl font-bold">R$ 14,90</p>
              <p className="text-xs sm:text-sm text-muted-foreground">por mês</p>
            </div>

            <Button onClick={handleSubscribe} className="w-full h-10 sm:h-11 text-sm sm:text-base" size="lg">
              <Crown className="w-4 h-4 mr-2" />
              Assinar Agora
            </Button>

            <p className="text-[10px] sm:text-xs text-center text-muted-foreground mt-2">
              Pagamento seguro via MercadoPago
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
