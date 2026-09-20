import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_SIDEBAR_GROUP, SIDEBAR_GROUPS, SIDEBAR_WIDTHS } from "./sidebarNavigation.ts";

test("mantém a sidebar principal organizada em Estudos e Prática", () => {
  assert.deepEqual(SIDEBAR_GROUPS.map((group) => group.title), ["Estudos", "Prática"]);
  assert.equal(SIDEBAR_GROUPS.flatMap((group) => group.items).some((item) => item.name === "Estatísticas"), false);
  assert.equal(SIDEBAR_GROUPS.flatMap((group) => group.items).some((item) => item.name === "Minha Assinatura"), false);
  assert.equal(SIDEBAR_GROUPS.flatMap((group) => group.items).some((item) => item.name.includes("Feedback")), false);
});

test("preserva a área administrativa fora da navegação principal", () => {
  assert.equal(ADMIN_SIDEBAR_GROUP.title, "Administração");
  assert.equal(ADMIN_SIDEBAR_GROUP.items.some((item) => item.path === "/admin/users"), true);
});

test("usa dimensões compacta e expandida consistentes com o layout", () => {
  assert.equal(SIDEBAR_WIDTHS.expanded, "16rem");
  assert.equal(SIDEBAR_WIDTHS.collapsed, "5rem");
});
