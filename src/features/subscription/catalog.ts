export type CheckoutPlanKey = "starter" | "annual";
export type AccountPlanType = "monthly" | "annual" | "god" | "creator";

export interface PlanVisual {
  label: string;
  billingLabel: string;
  ringClassName: string;
  isPremium: boolean;
}

export const PLAN_CATALOG = {
  basic: {
    label: "Básico",
    billingLabel: "Plano gratuito",
    price: 0,
    period: "sempre",
    isPremium: false,
  },
  monthly: {
    label: "Prática",
    billingLabel: "Plano mensal",
    price: 9.9,
    period: "/mês",
    isPremium: true,
  },
  annual: {
    label: "Completo",
    billingLabel: "Plano anual",
    price: 95.04,
    monthlyEquivalent: 7.92,
    period: "/ano",
    discount: 20,
    isPremium: true,
  },
  creator: {
    label: "Criador",
    billingLabel: "Plano Criador",
    isPremium: true,
  },
  god: {
    label: "Administrador",
    billingLabel: "Acesso administrativo",
    isPremium: true,
  },
} as const;

const RING_CLASSES = {
  basic: "bg-border",
  monthly: "bg-gradient-to-br from-amber-300 via-amber-500 to-yellow-700",
  annual: "bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600",
  creator: "bg-gradient-to-br from-violet-400 via-purple-600 to-fuchsia-700",
  god: "bg-primary",
} as const;

export function getPlanVisual(planType: string | null, isPremium: boolean): PlanVisual {
  if (planType === "annual") {
    return {
      label: PLAN_CATALOG.annual.label,
      billingLabel: PLAN_CATALOG.annual.billingLabel,
      ringClassName: RING_CLASSES.annual,
      isPremium: true,
    };
  }

  if (planType === "monthly" || planType === "starter") {
    return {
      label: PLAN_CATALOG.monthly.label,
      billingLabel: PLAN_CATALOG.monthly.billingLabel,
      ringClassName: RING_CLASSES.monthly,
      isPremium: true,
    };
  }

  if (planType === "creator") {
    return {
      label: PLAN_CATALOG.creator.label,
      billingLabel: PLAN_CATALOG.creator.billingLabel,
      ringClassName: RING_CLASSES.creator,
      isPremium: true,
    };
  }

  if (planType === "god") {
    return {
      label: PLAN_CATALOG.god.label,
      billingLabel: PLAN_CATALOG.god.billingLabel,
      ringClassName: RING_CLASSES.god,
      isPremium: true,
    };
  }

  return {
    label: isPremium ? "Premium" : PLAN_CATALOG.basic.label,
    billingLabel: isPremium ? "Assinatura Premium" : PLAN_CATALOG.basic.billingLabel,
    ringClassName: RING_CLASSES.basic,
    isPremium,
  };
}

export function getPlanLabel(planType: string | null, isPremium = false): string {
  return getPlanVisual(planType, isPremium).label;
}
