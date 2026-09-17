import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const migration = await readFile(
  new URL("../../migrations/20260917090000_harden_question_attempts_and_login.sql", import.meta.url),
  "utf8",
);
const loginFunction = await readFile(
  new URL("../auth-login/index.ts", import.meta.url),
  "utf8",
);

test("tentativas de questão são registradas por RPC confiável", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.record_question_attempt/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /correct_alternative/);
  assert.match(migration, /had_doubt/);
});

test("cliente não recebe permissão para forjar respostas de tentativa", () => {
  assert.match(migration, /REVOKE INSERT, DELETE, UPDATE ON public\.question_attempts/);
  assert.match(migration, /GRANT UPDATE \(had_doubt, topic\) ON public\.question_attempts/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.resolve_login_email/);
});

test("login por usuário usa limite e não expõe o e-mail no navegador", () => {
  assert.match(loginFunction, /consumeAnonymousRateLimit/);
  assert.match(loginFunction, /identifier\.includes\("@"\)/);
  assert.doesNotMatch(loginFunction, /resolve_login_email/);
  assert.match(loginFunction, /AUTHENTICATION_FAILED/);
});
