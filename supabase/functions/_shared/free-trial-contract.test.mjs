import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const migration = await readFile(new URL("migrations/20260923111500_add_new_user_free_trial.sql", root), "utf8");
const subscriptionFunction = await readFile(new URL("functions/check-subscription/index.ts", root), "utf8");
const authorizeModule = await readFile(new URL("functions/_shared/authorize.ts", root), "utf8");
const attemptMigration = await readFile(new URL("migrations/20260923111500_add_new_user_free_trial.sql", root), "utf8");

test("trial elegível apenas para contas criadas após a migration, sem escrita pelo cliente", () => {
  assert.match(migration, /AFTER INSERT ON auth\.users/);
  assert.match(migration, /INSERT INTO public\.free_trial_entitlements\(user_id\)/);
  assert.doesNotMatch(migration, /INSERT INTO public\.free_trial_entitlements[\s\S]{0,250}SELECT id FROM auth\.users/i);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL ON public\.free_trial_entitlements FROM PUBLIC, anon, authenticated/);
});

test("ativação exige service role e e-mail confirmado; a repetição preserva o fim original", () => {
  assert.match(migration, /FUNCTION public\.start_free_trial\(_user_id uuid\)/);
  assert.match(migration, /auth\.role\(\) IS DISTINCT FROM 'service_role'/);
  assert.match(migration, /email_confirmed_at IS NOT NULL OR confirmed_at IS NOT NULL/);
  assert.match(migration, /started_at IS NULL[\s\S]*?RETURNING ends_at INTO _ends_at/);
  assert.match(migration, /_now \+ interval '72 hours'/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.start_free_trial\(uuid\) TO service_role/);
});

test("entitlement preserva assinatura paga e aplica Completo durante o trial ativo", () => {
  assert.match(migration, /s\.status = 'authorized'[\s\S]*?s\.end_date > now\(\)/);
  assert.match(migration, /_premium := _paid OR _trial_active/);
  assert.match(migration, /ELSIF _trial_active THEN[\s\S]*?_tier := 'complete'[\s\S]*?_essay_limit := 12/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.is_user_premium/);
  assert.match(migration, /e\.has_premium_access/);
  assert.match(migration, /public\.is_user_premium\(_user_id\)/);
  assert.match(migration, /FROM public\.get_user_entitlement\(_user_id\) e/);
});

test("check-subscription inicia após confirmação e publica o contrato acordado", () => {
  assert.match(subscriptionFunction, /auth\.user\.email_confirmed_at \|\| auth\.user\.confirmed_at/);
  assert.match(subscriptionFunction, /rpc\("start_free_trial"/);
  assert.match(subscriptionFunction, /rpc\("get_user_entitlement"/);
  assert.match(subscriptionFunction, /subscribed: entitlement\.subscribed/);
  assert.match(subscriptionFunction, /has_premium_access: entitlement\.has_premium_access/);
  assert.match(subscriptionFunction, /trial_status: trialStatus/);
  assert.match(subscriptionFunction, /\? "ineligible"[\s\S]*"not_started"/);
  assert.match(subscriptionFunction, /plan_type: entitlement\.plan_type \?\? null/);
  assert.match(subscriptionFunction, /monthly_essay_limit: entitlement\.monthly_essay_limit/);
});

test("gates premium compartilhados falham fechados quando entitlement não está disponível", async () => {
  assert.match(authorizeModule, /export async function hasPremiumAccess/);
  assert.match(authorizeModule, /ENTITLEMENT_UNAVAILABLE/);
  for (const filename of ["generate-study-schedule", "analyze-simulado", "ai-study-suggestion"]) {
    const source = await readFile(new URL(`functions/${filename}/index.ts`, root), "utf8");
    assert.match(source, /hasPremiumAccess/);
    assert.match(source, /PREMIUM_REQUIRED/);
  }
  assert.match(attemptMigration, /_is_premium := public\.is_user_premium\(_user_id\)/);
  assert.match(attemptMigration, /public\.get_user_entitlement\(_user_id\) e/);
});
