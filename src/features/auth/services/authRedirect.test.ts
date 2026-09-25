import assert from "node:assert/strict";
import test from "node:test";
import { getExpiredSessionRedirect, getPostAuthRedirect, getPostAuthRedirectParams, getSafePostAuthRedirectTarget } from "./authRedirect.ts";

test("preserva o checkout do trial após autenticação e valida o ID de sessão", () => {
  assert.equal(
    getPostAuthRedirect(new URLSearchParams("redirect=%2Fsettings&trial_session=cs_test_12345678")),
    "/settings?tab=subscription&trial_session=cs_test_12345678",
  );
  assert.equal(
    getPostAuthRedirect(new URLSearchParams("redirect=%2Fsettings&trial_session=https%3A%2F%2Fevil.example")),
    "/dashboard",
  );
});

test("mantém destinos de planos legados sem aceitar redirect arbitrário", () => {
  assert.equal(
    getPostAuthRedirect(new URLSearchParams("redirect=%2Fplanos&plano=annual&bump=redacao&cupom=ENEM10")),
    "/planos?plano=annual&bump=redacao&cupom=ENEM10",
  );
  assert.equal(getPostAuthRedirect(new URLSearchParams("redirect=https%3A%2F%2Fevil.example")), "/dashboard");
});


test("preserves only validated redirect parameters after signup", () => {
  assert.equal(
    getPostAuthRedirectParams(new URLSearchParams("redirect=%2Fsettings&trial_session=cs_test_12345678")).toString(),
    "redirect=%2Fsettings&tab=subscription&trial_session=cs_test_12345678",
  );
  assert.equal(
    getPostAuthRedirectParams(new URLSearchParams("redirect=%2Fsettings&trial_session=https%3A%2F%2Fevil.example")).toString(),
    "",
  );
});

test("preserves a valid Stripe session when sending an expired user to auth", () => {
  assert.equal(
    getExpiredSessionRedirect(new URLSearchParams("tab=subscription&trial_session=cs_test_12345678")),
    "/auth?redirect=%2Fsettings&trial_session=cs_test_12345678",
  );
  assert.equal(getExpiredSessionRedirect(new URLSearchParams("tab=subscription&trial_session=invalid")), "/auth");
});


test("validates OAuth continuation targets before navigating", () => {
  assert.equal(
    getSafePostAuthRedirectTarget("/settings?tab=subscription&trial_session=cs_test_12345678"),
    "/settings?tab=subscription&trial_session=cs_test_12345678",
  );
  assert.equal(getSafePostAuthRedirectTarget("https://evil.example"), "/dashboard");
  assert.equal(getSafePostAuthRedirectTarget(null), "/dashboard");
});
