import assert from "node:assert/strict";
import test from "node:test";
import { validatePassword, usernameSchema } from "./authValidation.ts";

test("aceita usernames com ponto e underscore", () => {
  assert.equal(usernameSchema.safeParse("ana.souza").success, true);
  assert.equal(usernameSchema.safeParse("ana_souza").success, true);
});

test("mantém limites básicos do username", () => {
  assert.equal(usernameSchema.safeParse(".ana").success, false);
  assert.equal(usernameSchema.safeParse("ana__souza").success, false);
  assert.equal(usernameSchema.safeParse("ana-souza").success, false);
});

test("aceita símbolos comuns como caractere especial da senha", () => {
  const validation = validatePassword("Senha+123");

  assert.deepEqual(validation, {
    minLength: true,
    hasUpperCase: true,
    hasLowerCase: true,
    hasNumber: true,
    hasSpecialChar: true,
  });
});

test("não considera espaço como caractere especial", () => {
  assert.equal(validatePassword("Senha 123").hasSpecialChar, false);
});

test("rejeita senha sem símbolo", () => {
  assert.equal(Object.values(validatePassword("Senha123")).every(Boolean), false);
});
