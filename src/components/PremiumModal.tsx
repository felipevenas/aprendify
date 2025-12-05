import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Crown, Star } from "lucide-react";

interface PremiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPremium?: boolean;
}

/**
 * Modal de Premium - mostra benefícios da assinatura
 * Se o usuário for premium, mostra os benefícios que ele já possui
 * Se não for, mostra opção de assinar
 */
export const PremiumModal = ({ open, onOpenChange, isPremium = false }: PremiumModalProps) => {
  const benefits = [
    "Questões ilimitadas por dia",
    "Explicações de questões por IA",
    "Flashcards ilimitados",
    "4 correções de redação por mês",
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
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ${
                isPremium
                  ? "bg-gradient-to-br from-yellow-500 to-amber-500"
                  : "bg-gradient-to-br from-primary to-primary/60"
              }`}
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

        <div className="space-y-3 sm:space-y-4 py-2 sm:py-3">
          {/* Lista de benefícios */}
          <div className="space-y-2 sm:space-y-2.5">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-2 sm:gap-2.5">
                <div
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isPremium ? "bg-green-500/20" : "bg-primary/10"
                  }`}
                >
                  <Check className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${isPremium ? "text-green-600" : "text-primary"}`} />
                </div>
                <span className="text-xs sm:text-sm leading-snug">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Seção inferior - diferente para premium e free */}
          <div className="pt-2 sm:pt-3 border-t">
            {isPremium ? (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 mb-3">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-yellow-600">Assinatura Ativa</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Obrigado por apoiar o Aprendify! Aproveite todos os recursos premium.
                </p>
              </div>
            ) : (
              <>
                <div className="text-center mb-2 sm:mb-3">
                  <p className="text-2xl sm:text-3xl font-bold">R$ 19,90</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">por mês</p>
                </div>

                <Button onClick={handleSubscribe} className="w-full h-10 sm:h-11 text-sm sm:text-base" size="lg">
                  <Crown className="w-4 h-4 mr-2" />
                  Assinar Agora
                </Button>

                <p className="text-[10px] sm:text-xs text-center text-muted-foreground mt-2">
                  Pagamento seguro via MercadoPago
                </p>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
