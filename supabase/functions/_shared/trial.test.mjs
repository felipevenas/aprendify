import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "./api.ts";
import { STRIPE_TRIAL_OFFER, STRIPE_TRIAL_SECONDS, validateTrialCheckoutSnapshot } from "./trial.ts";

const snapshot = () => ({
  session: {
    id: "cs_test_abcdefgh",
    mode: "subscription",
    status: "complete",
    customer: "cus_123456",
    subscription: "sub_123456",
    metadata: { user_id: "user-1", trial_offer: STRIPE_TRIAL_OFFER },
  },
  subscription: {
    id: "sub_123456",
    status: "trialing",
    customer: "cus_123456",
    metadata: { user_id: "user-1", trial_offer: STRIPE_TRIAL_OFFER },
    trial_start: 1_800_000_000,
    trial_end: 1_800_000_000 + STRIPE_TRIAL_SECONDS,
    items: { data: [{ quantity: 1, price: { id: "price_annual" } }] },
  },
  customer: { id: "cus_123456", metadata: { user_id: "user-1", aprendify_trial_only: "true" } },
  userId: "user-1",
  expectedPriceId: "price_annual",
});

test("accepts only the completed, user-bound Complete trial with exact 72-hour duration", () => {
  const result = validateTrialCheckoutSnapshot(snapshot());
  assert.equal(Date.parse(result.endsAt) - Date.parse(result.startedAt), STRIPE_TRIAL_SECONDS * 1000);
  assert.equal(result.customerId, "cus_123456");
  assert.equal(result.subscriptionId, "sub_123456");
});

for (const mutate of [
  (value) => { value.session.metadata.user_id = "other-user"; },
  (value) => { value.subscription.status = "active"; },
  (value) => { value.subscription.trial_end += 1; },
  (value) => { value.subscription.items.data[0].price.id = "price_starter"; },
  (value) => { value.customer.metadata.aprendify_trial_only = "false"; },
  (value) => { value.session.customer = "cus_other"; },
  (value) => { value.session.subscription = "sub_other"; },
  (value) => { value.subscription.customer = "cus_other"; },
  (value) => { value.subscription.items.data[0].quantity = 2; },
  (value) => { value.subscription.items.data.push({ quantity: 1, price: { id: "price_annual" } }); },
]) {
  test("rejects a mismatched Stripe trial snapshot", () => {
    const value = snapshot();
    mutate(value);
    assert.throws(() => validateTrialCheckoutSnapshot(value), (error) => error instanceof ApiError && error.code === "TRIAL_CONFIRMATION_FAILED");
  });
}
