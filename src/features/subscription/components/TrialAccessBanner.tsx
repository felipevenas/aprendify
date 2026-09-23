import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Clock3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePremiumContext } from "../context/PremiumContext";
import { formatTrialDeadline, getTrialNoticeState } from "../trialPresentation";

export function TrialAccessBanner() {
  const { trialStatus, trialEndsAt, isLoading, entitlementStatus, isSubscribed } = usePremiumContext();
  const { pathname } = useLocation();
  const noticeState = getTrialNoticeState(trialStatus);

  if (isLoading || entitlementStatus !== "ready" || isSubscribed || !noticeState || pathname === "/planos" || pathname === "/oferta") {
    return null;
  }

  const active = noticeState === "active";
  const deadline = formatTrialDeadline(trialEndsAt);

  return (
    <section
      aria-labelledby="trial-access-heading"
      role="status"
      className={`border-b ${active ? "border-primary/20 bg-primary/5" : "border-amber-500/30 bg-amber-500/10"}`}
    >
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${active ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`} aria-hidden="true">
            {active ? <Sparkles className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <h2 id="trial-access-heading" className="text-sm font-semibold text-foreground">
              {active ? "Seu teste grátis de 3 dias do Completo está ativo" : "Seu período de teste terminou"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {active
                ? deadline
                  ? `Aproveite todos os recursos até ${deadline}. Sem cartão e sem cobrança automática.`
                  : "Aproveite os recursos do plano Completo por 3 dias, sem cartão e sem cobrança automática."
                : "Escolha um plano mensal ou anual para continuar com os recursos Premium."}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="w-full shrink-0 sm:w-auto">
          <Link to="/planos">
            {active ? "Conhecer os planos" : "Ver planos"}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

export default TrialAccessBanner;
