import assert from "node:assert/strict";
import test from "node:test";
import { getProfileTab } from "./profileTabs.ts";

test("usa Meu Perfil como fallback para uma aba inválida", () => {
  assert.equal(getProfileTab("unknown"), "profile");
  assert.equal(getProfileTab(null), "profile");
});

test("permite as abas públicas do hub", () => {
  assert.equal(getProfileTab("statistics"), "statistics");
  assert.equal(getProfileTab("subscription"), "subscription");
  assert.equal(getProfileTab("preferences"), "preferences");
});

test("protege a aba administrativa para usuários não administradores", () => {
  assert.equal(getProfileTab("admin", false), "profile");
  assert.equal(getProfileTab("admin", true), "admin");
});
