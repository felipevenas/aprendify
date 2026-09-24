import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const initialMigration = await readFile(new URL("migrations/20260923111500_add_new_user_free_trial.sql", root), "utf8");
const optInMigration = await readFile(new URL("migrations/20260923124500_opt_in_stripe_free_trial.sql", root), "utf8");
const replayMigration = await readFile(new URL("migrations/20260924013000_idempotencia_ativacao_trial.sql", root), "utf8");
const eligibilityRepair = await readFile(new URL("migrations/20260924013100_recuperar_elegibilidade_trial.sql", root), "utf8");
const subscriptionFunction = await readFile(new URL("functions/check-subscription/index.ts", root), "utf8");
const authorizeModule = await readFile(new URL("functions/_shared/authorize.ts", root), "utf8");

test("trial is eligible only for accounts created after migration and is private", () => {
  assert.match(initialMigration, /AFTER INSERT ON auth\.users/);
  assert.match(initialMigration, /INSERT INTO public\.free_trial_entitlements\(user_id\)/);
  assert.doesNotMatch(initialMigration, /INSERT INTO public\.free_trial_entitlements[\s\S]{0,250}SELECT id FROM auth\.users/i);
  assert.match(initialMigration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(initialMigration, /REVOKE ALL ON public\.free_trial_entitlements FROM PUBLIC, anon, authenticated/);
});

test("missed release cohort receives eligibility without activating a trial", () => {
  assert.match(eligibilityRepair, /u\.created_at >= timestamptz '2026-09-23 22:24:52\+00'/);
  assert.match(eligibilityRepair, /ON CONFLICT \(user_id\) DO NOTHING/);
  assert.match(eligibilityRepair, /s\.status = 'authorized'[\s\S]*?s\.end_date > now\(\)/);
  assert.doesNotMatch(eligibilityRepair, /SET\s+started_at|INSERT INTO public\.subscriptions/i);
});

test("the old activation RPC is a service-only no-op during rollout", () => {
  assert.match(optInMigration, /CREATE OR REPLACE FUNCTION public\.start_free_trial\(_user_id uuid\)/);
  assert.match(optInMigration, /RETURN NULL;/);
  assert.match(optInMigration, /GRANT EXECUTE ON FUNCTION public\.start_free_trial\(uuid\) TO service_role/);
  assert.doesNotMatch(subscriptionFunction, /rpc\("start_free_trial"/);
});

test("entitlement preserves paid subscription and grants Complete while trial is active", () => {
  assert.match(initialMigration, /s\.status = 'authorized'[\s\S]*?s\.end_date > now\(\)/);
  assert.match(initialMigration, /_premium := _paid OR _trial_active/);
  assert.match(initialMigration, /ELSIF _trial_active THEN[\s\S]*?_tier := 'complete'[\s\S]*?_essay_limit := 12/);
  assert.match(initialMigration, /CREATE OR REPLACE FUNCTION public\.is_user_premium/);
  assert.match(initialMigration, /e\.has_premium_access/);
  assert.match(initialMigration, /public\.is_user_premium\(_user_id\)/);
  assert.match(initialMigration, /FROM public\.get_user_entitlement\(_user_id\) e/);
});

test("check-subscription only reads entitlement state and keeps its response contract", () => {
  assert.doesNotMatch(subscriptionFunction, /rpc\("start_free_trial"/);
  assert.match(subscriptionFunction, /rpc\("get_user_entitlement"/);
  assert.match(subscriptionFunction, /subscribed: entitlement\.subscribed/);
  assert.match(subscriptionFunction, /has_premium_access: entitlement\.has_premium_access/);
  assert.match(subscriptionFunction, /trial_status: trialStatus/);
  assert.match(subscriptionFunction, /\? "ineligible"[\s\S]*"not_started"/);
  assert.match(subscriptionFunction, /plan_type: entitlement\.plan_type \?\? null/);
  assert.match(subscriptionFunction, /monthly_essay_limit: entitlement\.monthly_essay_limit/);
});

test("checkout reservations are locked, idempotent and exclude paid accounts", () => {
  assert.match(optInMigration, /FROM public\.free_trial_entitlements[\s\S]*?FOR UPDATE/);
  assert.match(optInMigration, /trial_checkout_idempotency_key = gen_random_uuid\(\)/);
  assert.match(optInMigration, /s\.status = 'authorized'[\s\S]*?s\.end_date > _now/);
  assert.match(optInMigration, /activate_free_trial_from_stripe/);
  assert.match(optInMigration, /_trial_ends_at <> _trial_started_at \+ interval '72 hours'/);
  assert.match(optInMigration, /GRANT EXECUTE ON FUNCTION public\.activate_free_trial_from_stripe/);
});

test("a confirmed trial replay remains idempotent after a later paid subscription", () => {
  const replayCheck = replayMigration.indexOf("IF _trial.started_at IS NOT NULL THEN");
  const paidCheck = replayMigration.indexOf("IF EXISTS (", replayCheck);
  assert.ok(replayCheck > 0 && paidCheck > replayCheck);
  assert.match(replayMigration, /_trial\.trial_stripe_subscription_id = _stripe_subscription_id/);
  assert.match(replayMigration, /GRANT EXECUTE ON FUNCTION public\.activate_free_trial_from_stripe[\s\S]*?TO service_role/);
});

test("shared premium gates fail closed when entitlement is unavailable", async () => {
  assert.match(authorizeModule, /export async function hasPremiumAccess/);
  assert.match(authorizeModule, /ENTITLEMENT_UNAVAILABLE/);
  for (const filename of ["generate-study-schedule", "analyze-simulado", "ai-study-suggestion"]) {
    const source = await readFile(new URL(`functions/${filename}/index.ts`, root), "utf8");
    assert.match(source, /hasPremiumAccess/);
    assert.match(source, /PREMIUM_REQUIRED/);
  }
  assert.match(initialMigration, /_is_premium := public\.is_user_premium\(_user_id\)/);
});
