import assert from "node:assert/strict";
import test from "node:test";
import { canActivateTrial, readTrialReturn } from "./trialCheckout.ts";

test("oferece o CTA somente a conta autenticada elegível ainda sem assinatura", () => {
  assert.equal(canActivateTrial("not_started", false, true), true);
  assert.equal(canActivateTrial("not_started", false, false), false);
  assert.equal(canActivateTrial("active", false, true), false);
  assert.equal(canActivateTrial("expired", false, true), false);
  assert.equal(canActivateTrial("ineligible", false, true), false);
  assert.equal(canActivateTrial("not_started", true, true), false);
});

test("aceita somente os parâmetros esperados de retorno do Stripe", () => {
  assert.deepEqual(readTrialReturn(new URLSearchParams("trial_session=cs_test_123")), {
    sessionId: "cs_test_123",
    cancelled: false,
  });
  assert.deepEqual(readTrialReturn(new URLSearchParams("trial_session=invalid&trial=cancelled")), {
    sessionId: null,
    cancelled: true,
  });
});
