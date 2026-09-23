import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./TrialAccessBanner.tsx", import.meta.url), "utf8");

test("banner anuncia o estado e encaminha para os planos por controle acessível", () => {
  assert.match(source, /role="status"/);
  assert.match(source, /Seu acesso Completo grátis está ativo/);
  assert.match(source, /Seu período de teste terminou/);
  assert.match(source, /<Link to="\/planos">/);
  assert.match(source, /isSubscribed \|\| !noticeState/);
});

test("banner mantém CTA e conteúdo adaptáveis para telas estreitas", () => {
  assert.match(source, /flex-col gap-3[^\"]*sm:flex-row/);
  assert.match(source, /w-full shrink-0 sm:w-auto/);
});
