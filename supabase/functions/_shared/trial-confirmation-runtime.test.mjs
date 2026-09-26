import assert from "node:assert/strict";
import test from "node:test";
import { trialConfirmationDiagnostic, trialConfirmationStripeOptions } from "./trial-confirmation-runtime.ts";

test("confirmation Stripe calls have bounded retries and timeout", () => {
  assert.deepEqual(trialConfirmationStripeOptions, {
    apiVersion: "2025-08-27.basil",
    maxNetworkRetries: 1,
    timeout: 15_000,
  });
});

test("confirmation diagnostics omit untrusted values", () => {
  assert.equal(
    trialConfirmationDiagnostic("stripe_subscription_customer", "TRIAL_CONFIRMATION_UNAVAILABLE"),
    "stage=stripe_subscription_customer code=TRIAL_CONFIRMATION_UNAVAILABLE",
  );
  assert.equal(
    trialConfirmationDiagnostic("user@example.com", "cs_live_sensitive"),
    "stage=unknown code=TRIAL_CONFIRMATION_UNAVAILABLE",
  );
});
