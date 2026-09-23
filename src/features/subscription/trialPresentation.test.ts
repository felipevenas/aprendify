import assert from "node:assert/strict";
import test from "node:test";
import { formatTrialDeadline, getTrialNoticeState } from "./trialPresentation.ts";

test("aviso ativo só muda quando chega o estado expirado do servidor", () => {
  assert.equal(getTrialNoticeState("active"), "active");
  assert.equal(getTrialNoticeState("expired"), "expired");
});

test("estados sem trial ativo ou expirado não exibem banner", () => {
  assert.equal(getTrialNoticeState("ineligible"), null);
  assert.equal(getTrialNoticeState("not_started"), null);
});

test("formata prazo válido em português e ignora data inválida", () => {
  assert.match(formatTrialDeadline("2026-09-25T12:00:00.000Z") ?? "", /2026/);
  assert.equal(formatTrialDeadline("invalida"), null);
});
