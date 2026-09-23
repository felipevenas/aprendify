import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const navbarSource = readFileSync(new URL("./Navbar.tsx", import.meta.url), "utf8");

test("marca mobile permanece centrada no viewport e sem animacao de fade", () => {
  const mobileBrand = navbarSource.match(/aria-label="Aprendify: ir para o painel"[\s\S]*?className="([^"]+)"/);
  assert.ok(mobileBrand, "link central da marca mobile deve existir");
  assert.match(mobileBrand[1], /left-\[50vw\]/);
  assert.match(mobileBrand[1], /-translate-x-1\/2/);
  assert.match(mobileBrand[1], /md:hidden/);
  assert.doesNotMatch(mobileBrand[1], /animate-fade|opacity-/);
});

test("streak e notificacoes ficam ocultos abaixo do breakpoint md", () => {
  assert.equal((navbarSource.match(/className="hidden md:block"/g) ?? []).length, 2);
});

test("menu e perfil mantem rotulos acessiveis e alvo de toque mobile", () => {
  assert.match(navbarSource, /aria-label="Abrir menu"[^>]*className="h-11 w-11/);
  assert.match(navbarSource, /aria-label=\{`Abrir perfil de \$\{userName\}`\}[\s\S]*?className="flex h-11 w-11/);
});
