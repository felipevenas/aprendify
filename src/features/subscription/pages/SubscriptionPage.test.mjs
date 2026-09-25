import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./SubscriptionPage.tsx", import.meta.url), "utf8");

test("subscription page keeps one primary CTA and removes the quick modal offer", () => {
  assert.doesNotMatch(source, /Ver no Modal R.{1,2}pido|PremiumModal|showPlansModal/);
  assert.ok(source.includes('navigate("/planos")'));
});

test("subscription transition is short and respects reduced motion", () => {
  assert.ok(source.includes("useReducedMotion"));
  assert.ok(source.includes("key={subscriptionViewState}"));
  assert.ok(source.includes("initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}"));
  assert.ok(source.includes("duration: prefersReducedMotion ? 0 : 0.18"));
});

test("trial confirmation keeps the same session until authoritative access is active", () => {
  assert.ok(source.includes("createTrialCheckoutSession()"));
  assert.ok(source.includes("confirmTrialCheckout(pendingTrialSessionId)"));
  assert.ok(source.includes("refreshPremiumStatus()"));
  assert.ok(source.includes("finishTrialConfirmation(pendingTrialSessionId, trialEndsAt ?? confirmedTrialEndsAt)"));
  assert.ok(source.includes("trialCheckoutConfirmedAtServer"));
  assert.ok(source.includes("Verificar novamente"));
  assert.ok(source.includes('trialStatus !== "active" || isSubscribed'));
  assert.ok(source.includes('canActivateTrial(trialStatus, isSubscribed, isAuthenticated, entitlementStatus === "ready")'));
  assert.ok(source.includes("canShowFreeSubscription("));
  assert.ok(source.includes('entitlementStatus !== "ready"'));
  assert.ok(source.includes("getExpiredSessionRedirect(searchParams)"));
  assert.ok(source.includes("Ativar teste gr"));
  assert.ok(source.includes("Sem cobran&ccedil;a autom&aacute;tica"));
  assert.ok(source.includes('aria-live={trialConfirmationState === "error" ? "assertive" : "polite"}'));
});

test("existing subscribers still use their subscription view", () => {
  assert.ok(source.includes(": canDisplayFreeSubscription ?"));
  assert.ok(source.includes("O Stripe registra uma assinatura em per"));
  assert.doesNotMatch(source, /O teste n.{1,2}o inicia uma assinatura/);
});
