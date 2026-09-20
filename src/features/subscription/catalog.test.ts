import assert from "node:assert/strict";
import test from "node:test";
import { getPlanLabel, getPlanVisual, PLAN_CATALOG } from "./catalog.ts";

test("mantém os nomes comerciais dos planos da landing", () => {
  assert.equal(PLAN_CATALOG.basic.label, "Básico");
  assert.equal(PLAN_CATALOG.monthly.label, "Prática");
  assert.equal(PLAN_CATALOG.annual.label, "Completo");
  assert.equal(PLAN_CATALOG.annual.price, 95.04);
});

test("aplica o anel dourado ao plano mensal", () => {
  const visual = getPlanVisual("monthly", true);

  assert.equal(visual.label, "Prática");
  assert.match(visual.ringClassName, /amber/);
  assert.equal(visual.isPremium, true);
});

test("aplica o anel azul degradê ao plano anual", () => {
  const visual = getPlanVisual("annual", true);

  assert.equal(visual.label, "Completo");
  assert.match(visual.ringClassName, /blue/);
  assert.equal(visual.isPremium, true);
});

test("mantém a conta gratuita sem anel Premium", () => {
  const visual = getPlanVisual(null, false);

  assert.equal(visual.label, "Básico");
  assert.equal(visual.isPremium, false);
  assert.equal(visual.ringClassName, "bg-border");
});

test("usa Básico como fallback seguro para plano desconhecido sem premium", () => {
  assert.equal(getPlanLabel("unknown"), "Básico");
});
