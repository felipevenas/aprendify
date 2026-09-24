import { ApiError } from "../_shared/api.ts";
import { requireOrderBumpPrice, requirePlanPrice, REDACAO_ADD_ON_CODE, resolvePlanFromConfiguredPrice, type PlanKey, type StripeCatalog } from "../_shared/catalog.ts";

function invalid(message: string): never {
  throw new ApiError(400, "INVALID_CHECKOUT_REQUEST", message);
}

export function resolveItems(body: Record<string, unknown>, catalog: StripeCatalog) {
  const requestedPlan = body.plan === undefined
    ? null
    : body.plan === "starter" || body.plan === "annual" ? body.plan as PlanKey : null;
  const legacyPlan = body.priceId === undefined ? null : resolvePlanFromConfiguredPrice(catalog, body.priceId);
  if (body.plan !== undefined && !requestedPlan) invalid("Plano inválido");
  if (body.priceId !== undefined && !legacyPlan) invalid("Plano inválido");
  if (requestedPlan && legacyPlan && requestedPlan !== legacyPlan) invalid("Planos conflitantes");

  let plan: PlanKey | null = requestedPlan ?? legacyPlan;
  let includeBump = body.orderBump === true;
  if (body.orderBump !== undefined && body.orderBump !== true && body.orderBump !== false) invalid("Order bump inválido");
  if (body.includeOrderBump !== undefined && typeof body.includeOrderBump !== "boolean") invalid("Order bump inválido");
  if (body.includeOrderBump === true) includeBump = true;
  if (body.orderBumpPriceId !== undefined) {
    // The old client sends this symbolic key. A raw Stripe price is never accepted.
    if (body.orderBumpPriceId !== REDACAO_ADD_ON_CODE) invalid("Order bump inválido");
    includeBump = true;
  }
  if (body.quantity !== undefined && (body.quantity !== 1 || !Number.isInteger(body.quantity))) invalid("Quantidade inválida");

  if (body.items !== undefined) {
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 2) invalid("Itens inválidos");
    for (const raw of body.items) {
      if (!raw || typeof raw !== "object") invalid("Itens inválidos");
      const item = raw as Record<string, unknown>;
      if (item.quantity !== 1 || !Number.isInteger(item.quantity)) invalid("Quantidade inválida");
      const itemId = item.id ?? item.plan ?? item.priceId ?? item.price;
      if (itemId === REDACAO_ADD_ON_CODE) {
        includeBump = true;
        continue;
      }
      const itemPlan = itemId === "starter" || itemId === "annual"
        ? itemId as PlanKey
        : resolvePlanFromConfiguredPrice(catalog, itemId);
      if (!itemPlan || (plan && plan !== itemPlan)) invalid("Item não permitido");
      plan = itemPlan;
    }
  }

  if (!plan) invalid("Plano obrigatório");
  const lineItems: { price: string; quantity: 1 }[] = [{ price: requirePlanPrice(catalog, plan), quantity: 1 }];
  if (includeBump) lineItems.push({ price: requireOrderBumpPrice(catalog), quantity: 1 });
  return { plan, lineItems, includeOrderBump: includeBump };
}
