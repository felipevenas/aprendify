import { ApiError } from "./api.ts";

export type PlanKey = "starter" | "annual";
export type AddOnKey = "order_bump_redacao";
export const REDACAO_ADD_ON_CODE: AddOnKey = "order_bump_redacao";

export type StripeCatalog = {
  starter: string[];
  annual: string[];
  orderBumpRedacao: string[];
};

function configuredIds(name: string): string[] {
  return (Deno.env.get(name) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^price_[A-Za-z0-9]+$/.test(value));
}

export function stripeCatalog(): StripeCatalog {
  return {
    starter: configuredIds("STRIPE_PRICE_STARTER"),
    annual: configuredIds("STRIPE_PRICE_ANNUAL"),
    orderBumpRedacao: configuredIds("STRIPE_PRICE_ORDER_BUMP_REDACAO"),
  };
}

export function requirePlanPrice(catalog: StripeCatalog, plan: PlanKey): string {
  const price = catalog[plan][0];
  if (!price) throw new ApiError(503, "PLAN_UNAVAILABLE", "Plano temporariamente indisponível");
  return price;
}

export function resolvePlanFromConfiguredPrice(
  catalog: StripeCatalog,
  value: unknown,
): PlanKey | null {
  if (typeof value !== "string") return null;
  if (catalog.starter.includes(value)) return "starter";
  if (catalog.annual.includes(value)) return "annual";
  return null;
}

export function requireOrderBumpPrice(catalog: StripeCatalog): string {
  const price = catalog.orderBumpRedacao[0];
  if (!price) throw new ApiError(503, "ADD_ON_UNAVAILABLE", "Este adicional está temporariamente indisponível");
  return price;
}
