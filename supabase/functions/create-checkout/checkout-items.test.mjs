import assert from "node:assert/strict";
import test from "node:test";
import { resolveItems } from "./checkout-items.ts";

const catalog = {
  starter: ["price_mensal"],
  annual: ["price_anual"],
  orderBumpRedacao: ["price_redacao"],
};

test("monta checkout anual sem adicional com o indicador correto", () => {
  assert.deepEqual(resolveItems({ plan: "annual", includeOrderBump: false }, catalog), {
    plan: "annual",
    lineItems: [{ price: "price_anual", quantity: 1 }],
    includeOrderBump: false,
  });
});

test("monta checkout mensal com adicional quando solicitado", () => {
  assert.deepEqual(resolveItems({ plan: "starter", includeOrderBump: true }, catalog), {
    plan: "starter",
    lineItems: [
      { price: "price_mensal", quantity: 1 },
      { price: "price_redacao", quantity: 1 },
    ],
    includeOrderBump: true,
  });
});

test("não aceita preço arbitrário enviado pelo cliente", () => {
  assert.throws(
    () => resolveItems({ priceId: "price_externo" }, catalog),
    (error) => error.code === "INVALID_CHECKOUT_REQUEST" && error.status === 400,
  );
});
