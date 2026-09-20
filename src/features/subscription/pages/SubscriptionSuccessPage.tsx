import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, MotionConfig } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Crown,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import Confetti from "react-confetti";
import { useWindowSize } from "@/hooks/useWindowSize";
import { usePremium } from "../hooks/usePremium";

type PaymentState = "payment_pending" | "payment_failed" | "cancelled";

export default function SubscriptionSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { width, height } = useWindowSize();
  const {
    isPremium,
    isLoading,
    entitlementStatus,
    monthlyEssayLimit,
    dailyQuestionLimit,
    refreshPremiumStatus,
  } = usePremium();
  const [showConfetti, setShowConfetti] = useState(false);

  const requestedState = searchParams.get("payment");
  const paymentState: PaymentState | "confirmed" = (requestedState === "failed" || requestedState === "payment_failed")
    ? "payment_failed"
    : requestedState === "cancelled"
      ? "cancelled"
      : !isLoading && entitlementStatus === "ready" && isPremium
        ? "confirmed"
        : "payment_pending";

  useEffect(() => {
    if (paymentState !== "confirmed") return;
    setShowConfetti(true);
    const timer = window.setTimeout(() => setShowConfetti(false), 8000);
    return () => window.clearTimeout(timer);
  }, [paymentState]);

  const benefits = useMemo(() => [
    {
      icon: Brain,
      title: dailyQuestionLimit === null ? "Questões ilimitadas" : `${dailyQuestionLimit} questões por dia`,
      description: "Pratique dentro do limite autorizado pelo seu plano.",
    },
    {
      icon: FileText,
      title: monthlyEssayLimit ? `${monthlyEssayLimit} correções de redação/mês` : "Correções de redação",
      description: "Correções completas seguindo os critérios do ENEM.",
    },
    {
      icon: Sparkles,
      title: "Recursos do seu plano",
      description: "O acesso é liberado conforme a confirmação do servidor.",
    },
    {
      icon: Sparkles,
      title: "Acompanhamento seguro",
      description: "O status da assinatura é confirmado no backend antes de liberar recursos.",
    },
  ], [dailyQuestionLimit, monthlyEssayLimit]);

  const isFailure = paymentState === "payment_failed" || paymentState === "cancelled";

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={300} gravity={0.1} />}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-3xl"
        >
          <Card className="overflow-hidden border-primary/20">
            <div className={`p-8 text-center ${paymentState === "confirmed" ? "bg-primary" : "bg-muted"}`}>
              <div className={`mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full ${paymentState === "confirmed" ? "bg-white/20" : "bg-background"}`}>
                {paymentState === "confirmed" ? <Crown className="h-8 w-8 text-primary-foreground" /> : isFailure ? <XCircle className="h-8 w-8 text-destructive" /> : <Loader2 className="h-8 w-8 animate-spin text-primary" />}
              </div>
              <h1 className={`text-2xl font-bold ${paymentState === "confirmed" ? "text-primary-foreground" : "text-foreground"}`}>
                {paymentState === "confirmed" ? "Assinatura confirmada" : isFailure ? "Pagamento não confirmado" : "Confirmando seu pagamento"}
              </h1>
              <p className={`mt-2 ${paymentState === "confirmed" ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                {paymentState === "confirmed"
                  ? "Seu acesso Premium foi confirmado pelo servidor."
                  : paymentState === "payment_failed"
                    ? "Não identificamos uma confirmação do pagamento. Nenhum acesso foi liberado."
                    : paymentState === "cancelled"
                      ? "O checkout foi cancelado e nenhum acesso foi liberado."
                      : "O pagamento pode levar alguns instantes para ser processado. Ainda não liberamos o acesso."}
              </p>
            </div>

            <CardContent className="space-y-6 p-6 sm:p-8">
              {paymentState === "payment_pending" && (
                <Alert aria-live="polite">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Estamos confirmando a assinatura com segurança. Você pode atualizar o status ou voltar ao painel; o acesso só será liberado após a confirmação do servidor.
                  </AlertDescription>
                </Alert>
              )}
              {paymentState === "payment_failed" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Não conseguimos confirmar o pagamento. Verifique o método de pagamento ou inicie um novo checkout.</AlertDescription>
                </Alert>
              )}
              {paymentState === "cancelled" && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>O checkout foi cancelado e seu acesso não foi alterado.</AlertDescription>
                </Alert>
              )}

              {paymentState === "confirmed" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {benefits.map(({ icon: Icon, title, description }) => (
                    <div key={title} className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-medium">{title}</h2>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                        </div>
                        <p className="text-sm text-muted-foreground">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                {paymentState === "payment_pending" && (
                  <Button type="button" variant="outline" onClick={refreshPremiumStatus} disabled={isLoading}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Atualizar status
                  </Button>
                )}
                <Button type="button" onClick={() => navigate(paymentState === "confirmed" ? "/dashboard" : "/settings?tab=subscription")}>
                  {isFailure ? "Voltar para assinatura" : paymentState === "confirmed" ? "Ir para o Dashboard" : "Voltar sem liberar acesso"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
