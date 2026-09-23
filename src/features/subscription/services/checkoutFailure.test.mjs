import assert from "node:assert/strict";
import test from "node:test";
import { readCheckoutDiagnosticCode } from "./checkoutFailure.ts";

test("retorna apenas códigos de diagnóstico permitidos da resposta do checkout", async () => {
  const error = { context: Response.json({ code: "PAYMENT_UNAVAILABLE", error: "mensagem interna" }, { status: 503 }) };
  assert.equal(await readCheckoutDiagnosticCode(error), "PAYMENT_UNAVAILABLE");
});

test("ignora códigos desconhecidos e corpos malformados sem expor a mensagem remota", async () => {
  const unknown = { context: Response.json({ code: "SECRET_VALUE", error: "detalhe interno" }, { status: 503 }) };
  const malformed = { context: new Response("não-json", { status: 503 }) };
  assert.equal(await readCheckoutDiagnosticCode(unknown), null);
  assert.equal(await readCheckoutDiagnosticCode(malformed), null);
  assert.equal(await readCheckoutDiagnosticCode({ context: "detalhe interno" }), null);
});
