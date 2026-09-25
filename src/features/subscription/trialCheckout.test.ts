import assert from "node:assert/strict";
import test from "node:test";
import { canActivateTrial, canShowFreeSubscription, readTrialReturn } from "./trialCheckout.ts";

test("trial CTA requires an authenticated eligible account and verified entitlement", () => {
  assert.equal(canActivateTrial("not_started", false, true, true), true);
  assert.equal(canActivateTrial("not_started", false, false, true), false);
  assert.equal(canActivateTrial("active", false, true, true), false);
  assert.equal(canActivateTrial("expired", false, true, true), false);
  assert.equal(canActivateTrial("ineligible", false, true, true), false);
  assert.equal(canActivateTrial("not_started", true, true, true), false);
  assert.equal(canActivateTrial("not_started", false, true, false), false);
});

test("unknown entitlement and pending trial do not show the free subscription screen", () => {
  assert.equal(canShowFreeSubscription(true, false, false, false), true);
  assert.equal(canShowFreeSubscription(false, false, false, false), false);
  assert.equal(canShowFreeSubscription(true, true, false, false), false);
  assert.equal(canShowFreeSubscription(true, false, true, false), false);
  assert.equal(canShowFreeSubscription(true, false, false, true), false);
});

test("Stripe return parsing only accepts expected parameters", () => {
  assert.deepEqual(readTrialReturn(new URLSearchParams("trial_session=cs_test_123")), {
    sessionId: "cs_test_123",
    cancelled: false,
  });
  assert.deepEqual(readTrialReturn(new URLSearchParams("trial_session=invalid&trial=cancelled")), {
    sessionId: null,
    cancelled: true,
  });
});
