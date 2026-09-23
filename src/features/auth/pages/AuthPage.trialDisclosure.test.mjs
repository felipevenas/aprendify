import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./AuthPage.tsx", import.meta.url), "utf8");

test("informa o trial antes das opções de autenticação, inclusive no acesso Google", () => {
  const disclosure = source.indexOf("Novas contas recebem 3 dias grátis do Completo.");
  const googleButton = source.indexOf("Continuar com Google");
  assert.notEqual(disclosure, -1);
  assert.notEqual(googleButton, -1);
  assert.ok(disclosure < googleButton);
  assert.match(source, /role="note"[\s\S]*?O período começa no primeiro acesso após a confirmação do e-mail, sem cartão e sem cobrança automática\./);
});

test("o aviso informativo não cria uma caixa de aceite obrigatória para o OAuth", () => {
  assert.doesNotMatch(source, /acceptsTrial|acceptTrial|aceito.*trial/i);
});
