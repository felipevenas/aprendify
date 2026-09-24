import assert from "node:assert/strict";
import test from "node:test";
import { webhookFailureDiagnostic, webhookStripeOptions } from "./webhook-runtime.ts";

test("Stripe webhook network calls have a bounded timeout and one retry", () => {
  assert.deepEqual(webhookStripeOptions, {
    apiVersion: "2025-08-27.basil",
    maxNetworkRetries: 1,
    timeout: 15_000,
  });
});

test("webhook diagnostics contain only allowlisted stages and safe error codes", () => {
  assert.equal(
    webhookFailureDiagnostic("process_event", "TRIAL_ACTIVATION_UNAVAILABLE"),
    "stage=process_event code=TRIAL_ACTIVATION_UNAVAILABLE",
  );
  assert.equal(
    webhookFailureDiagnostic("unknown stage", "email@example.com"),
    "stage=unknown code=PROCESSING_FAILED",
  );
});
