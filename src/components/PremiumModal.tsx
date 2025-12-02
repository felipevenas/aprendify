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
      <DialogContent className="sm:max-w-[500px] max-w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-center mb-3 sm:mb-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl sm:text-2xl">Assine o Plano Premium</DialogTitle>
          <DialogDescription className="text-center text-sm sm:text-base">Desbloqueie todo o potencial do Learnify</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 sm:py-4">
          <div className="space-y-2.5 sm:space-y-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-2.5 sm:gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <span className="text-xs sm:text-sm leading-relaxed">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 sm:pt-4 border-t">
            <div className="text-center mb-3 sm:mb-4">
              <p className="text-2xl sm:text-3xl font-bold">R$ 19,90</p>
              <p className="text-xs sm:text-sm text-muted-foreground">por mês</p>
            </div>

            <Button onClick={handleSubscribe} className="w-full h-11 sm:h-12 text-sm sm:text-base" size="lg">
              <Crown className="w-4 h-4 mr-2" />
              Assinar Agora
            </Button>

            <p className="text-[10px] sm:text-xs text-center text-muted-foreground mt-2 sm:mt-3">Pagamento seguro via MercadoPago</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
