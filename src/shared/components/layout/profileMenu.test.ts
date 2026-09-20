import assert from "node:assert/strict";
import test from "node:test";
import { PROFILE_DROPDOWN_ITEMS } from "./profileMenu.ts";

test("mantém apenas o hub Meu Perfil no dropdown do usuário", () => {
  assert.deepEqual(PROFILE_DROPDOWN_ITEMS, [
    { key: "profile", label: "Meu Perfil" },
  ]);
});
