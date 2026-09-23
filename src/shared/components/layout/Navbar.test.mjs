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
  assert.match(navbarSource, /className="hidden whitespace-nowrap text-md font-bold text-gradient sm:inline">Aprendify/);
});

test("streak faz parte do menu da conta e nao ocupa a barra superior", () => {
  const dropdownStart = navbarSource.indexOf("<DropdownMenuContent");
  const dropdownEnd = navbarSource.indexOf("</DropdownMenuContent>", dropdownStart);
  const dropdownSource = navbarSource.slice(dropdownStart, dropdownEnd);

  assert.notEqual(dropdownStart, -1);
  assert.ok(dropdownSource.includes("streakData.currentStreak"));
  assert.ok(dropdownSource.includes("<Flame"));
  assert.doesNotMatch(navbarSource.slice(0, dropdownStart), /StreakIndicator|streakData\.currentStreak/);
});

test("tema fica na barra em desktop e dentro do menu da conta em mobile", () => {
  const themeTogglePosition = navbarSource.indexOf("aria-label={`Ativar tema");
  const accountMenuPosition = navbarSource.indexOf("<DropdownMenu>");
  const dropdownStart = navbarSource.indexOf("<DropdownMenuContent");
  const dropdownEnd = navbarSource.indexOf("</DropdownMenuContent>", dropdownStart);
  const dropdownSource = navbarSource.slice(dropdownStart, dropdownEnd);

  assert.notEqual(themeTogglePosition, -1);
  assert.ok(themeTogglePosition < accountMenuPosition);
  assert.match(navbarSource.slice(themeTogglePosition, accountMenuPosition), /hidden[^\n]*md:inline-flex/);
  assert.match(dropdownSource, /<DropdownMenuCheckboxItem[\s\S]*?className="[^"]*md:hidden"[\s\S]*?Tema escuro[\s\S]*?<\/DropdownMenuCheckboxItem>/);
  assert.match(navbarSource, /aria-label=\{`Ativar tema \$\{theme === "dark" \? "claro" : "escuro"\}`\}/);
  assert.match(navbarSource, /aria-pressed=\{theme === "dark"\}/);
  assert.match(navbarSource, /onClick=\{\(\) => setTheme\(theme === "dark" \? "light" : "dark"\)\}/);
  assert.doesNotMatch(navbarSource, /<Switch/);
});

test("sino continua visivel fora do menu e antes do toggle desktop", () => {
  assert.equal((navbarSource.match(/<NotificationBell \/>/g) ?? []).length, 1);
  assert.ok(navbarSource.indexOf("<NotificationBell />") < navbarSource.indexOf("aria-label={`Ativar tema"));
  assert.doesNotMatch(navbarSource.slice(navbarSource.indexOf("<NotificationBell />") - 100, navbarSource.indexOf("<NotificationBell />")), /hidden md:block/);
});

test("menu e perfil mantem rotulos acessiveis e alvo de toque mobile", () => {
  assert.match(navbarSource, /aria-label="Abrir menu"[^>]*className="h-11 w-11/);
  assert.match(navbarSource, /aria-label=\{`Abrir perfil de \$\{userName\}`\}[\s\S]*?className="flex h-11 w-11/);
  assert.equal((navbarSource.match(/<DropdownMenuSeparator/g) ?? []).length, 1);
  assert.doesNotMatch(navbarSource, /DropdownMenuLabel|Ferramentas de Admin|>Conexões</);
});
