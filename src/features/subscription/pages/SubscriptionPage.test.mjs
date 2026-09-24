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

test("a ativação do trial passa pela confirmação do servidor e oferece estados acessíveis", () => {
  assert.match(source, /createTrialCheckoutSession\(\)/);
  assert.match(source, /confirmTrialCheckout\(pendingTrialSessionId\)/);
  assert.match(source, /refreshPremiumStatus\(\)/);
  assert.match(source, /trialConfirmationState === "confirming"/);
  assert.match(source, /trialConfirmationState === "error"/);
  assert.match(source, /trialConfirmationState === "success"/);
  assert.match(source, /Você não ativou o teste\. Não houve cobrança\./);
  assert.match(source, /canActivateTrial\(trialStatus, isSubscribed, isAuthenticated\)/);
  assert.match(source, /Ativar teste grátis por 3 dias/);
});

test("conta elegível com assinatura histórica ainda recebe o trial", () => {
  assert.match(source, /: !isPremium && !isSubscribed \?/);
  assert.match(source, /O Stripe registra uma assinatura em período de teste/);
  assert.doesNotMatch(source, /O teste não inicia uma assinatura/);
});
