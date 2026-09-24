import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./AuthPage.tsx", import.meta.url), "utf8");

test("informa a ativação opcional para novas contas antes das opções de autenticação", () => {
  const disclosure = source.indexOf("Contas novas elegíveis podem ativar 3 dias grátis do Completo depois de criar a conta.");
  const googleButton = source.indexOf("Continuar com Google");
  assert.notEqual(disclosure, -1);
  assert.notEqual(googleButton, -1);
  assert.ok(disclosure < googleButton);
  assert.match(source, /role="note"[\s\S]*?Você escolhe quando começar, pela tela Minha Assinatura\. Sem cartão e sem cobrança automática\./);
  assert.doesNotMatch(source, /começa no primeiro acesso|iniciará automaticamente/i);
});

test("o aviso informativo não cria uma caixa de aceite obrigatória para o OAuth", () => {
  assert.doesNotMatch(source, /acceptsTrial|acceptTrial|aceito.*trial/i);
});
