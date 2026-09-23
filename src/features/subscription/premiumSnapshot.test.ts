import assert from "node:assert/strict";
import test from "node:test";
import { readPremiumSnapshot } from "./premiumSnapshot.ts";

test("trata trial como acesso efetivo, sem classificá-lo como assinatura paga", () => {
  const snapshot = readPremiumSnapshot({
    subscribed: false,
    has_premium_access: true,
    trial_status: "active",
    trial_ends_at: "2026-09-25T12:00:00.000Z",
    plan_type: null,
    tier: "complete",
    monthly_essay_limit: 12,
    daily_question_limit: null,
  });

  assert.ok(snapshot);
  assert.equal(snapshot.isSubscribed, false);
  assert.equal(snapshot.hasPremiumAccess, true);
  assert.equal(snapshot.trialStatus, "active");
  assert.equal(snapshot.planType, null);
  assert.equal(snapshot.tier, "complete");
  assert.equal(snapshot.monthlyEssayLimit, 12);
  assert.equal(snapshot.dailyQuestionLimit, null);
});

test("normaliza valores de trial antigos e mantém estado gratuito expirado", () => {
  const snapshot = readPremiumSnapshot({
    subscribed: false,
    has_premium_access: false,
    trial_status: "not_eligible",
    plan_type: null,
  });

  assert.equal(snapshot?.trialStatus, "ineligible");
  assert.equal(snapshot?.hasPremiumAccess, false);
  assert.equal(snapshot?.dailyQuestionLimit, 10);
});

test("não infere acesso pago ou Completo quando o payload não confirma isso", () => {
  const snapshot = readPremiumSnapshot({ subscribed: false, tier: "complete" });

  assert.equal(snapshot?.isSubscribed, false);
  assert.equal(snapshot?.hasPremiumAccess, false);
  assert.equal(snapshot?.planType, null);
});

test("rejeita payload sem estado pago explícito", () => {
  assert.equal(readPremiumSnapshot({ has_premium_access: true }), null);
});

test("preserva plano contratado quando a assinatura paga já está ativa", () => {
  const snapshot = readPremiumSnapshot({
    subscribed: true,
    has_premium_access: true,
    trial_status: "active",
    plan_type: "annual",
  });

  assert.equal(snapshot?.isSubscribed, true);
  assert.equal(snapshot?.planType, "annual");
});
