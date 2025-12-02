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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Crown className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">Assine o Plano Premium</DialogTitle>
          <DialogDescription className="text-center">Desbloqueie todo o potencial do Learnify</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t">
            <div className="text-center mb-4">
              <p className="text-3xl font-bold">R$ 19,90</p>
              <p className="text-sm text-muted-foreground">por mês</p>
            </div>

            <Button onClick={handleSubscribe} className="w-full" size="lg">
              <Crown className="w-4 h-4 mr-2" />
              Assinar Agora
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-3">Pagamento seguro via MercadoPago</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
