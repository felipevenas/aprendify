import assert from "node:assert/strict";
import test from "node:test";
import { hasContextContent, separateTextAndReference } from "./formatters.ts";

test("não considera contexto vazio como uma seção visível", () => {
  assert.equal(hasContextContent(separateTextAndReference(" \n\t ")), false);
});

test("preserva contexto com texto ou referência", () => {
  assert.equal(hasContextContent({ mainText: "Leia o texto.", reference: null }), true);
  assert.equal(hasContextContent({ mainText: "", reference: "Fonte: ENEM" }), true);
});
