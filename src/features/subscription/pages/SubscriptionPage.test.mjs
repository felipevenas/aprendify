import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./SubscriptionPage.tsx", import.meta.url), "utf8");

test("assinatura mantém um CTA principal e remove a oferta do modal rápido", () => {
  assert.doesNotMatch(source, /Ver no Modal Rápido|PremiumModal|showPlansModal/);
  assert.match(source, /onClick=\{\(\) => navigate\("\/planos"\)\}/);
});

test("transição do estado da assinatura é curta e respeita movimento reduzido", () => {
  assert.match(source, /useReducedMotion/);
  assert.match(source, /key=\{subscriptionViewState\}/);
  assert.match(source, /initial=\{prefersReducedMotion \? false : \{ opacity: 0, y: 8 \}\}/);
  assert.match(source, /duration: prefersReducedMotion \? 0 : 0\.18/);
});
