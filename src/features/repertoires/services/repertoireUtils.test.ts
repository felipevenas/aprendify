import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_REPERTOIRE_DRAFT } from "../types.ts";
import { matchesRepertoireSearch, parseList, resolveGenerationTopic, toDraft, validateRepertoire } from "./repertoireUtils.ts";

test("resolveGenerationTopic uses the selected saved essay title", () => {
  assert.equal(resolveGenerationTopic("essay-1", "manual text", [
    { id: "essay-1", title: "  Acesso à cultura  " },
    { id: "essay-2", title: "Educação pública" },
  ]), "Acesso à cultura");
});

test("resolveGenerationTopic preserves and trims the manual topic for Outro", () => {
  assert.equal(resolveGenerationTopic("__other_topic__", "  Inclusão digital  ", []), "Inclusão digital");
});

test("resolveGenerationTopic rejects missing or stale selections", () => {
  assert.equal(resolveGenerationTopic("", "manual text", []), "");
  assert.equal(resolveGenerationTopic("deleted-essay", "manual text", []), "");
  assert.equal(resolveGenerationTopic("__other_topic__", "   ", []), "");
});

test("parseList trims entries, splits delimiters and removes duplicates case-insensitively", () => {
  assert.deepEqual(parseList(" Direitos humanos; escola\n direitos humanos, saúde "), [
    "Direitos humanos",
    "escola",
    "saúde",
  ]);
});

test("validateRepertoire returns field-specific errors for required content and unsafe URL format", () => {
  const errors = validateRepertoire({ ...EMPTY_REPERTOIRE_DRAFT, source_url: "example.com" });
  assert.equal(errors.title, "Informe um título para o repertório.");
  assert.equal(errors.application_example, "Inclua um exemplo de aplicação em uma redação.");
  assert.equal(errors.source_url, "Informe um endereço começando com http:// ou https://.");
});

test("validateRepertoire enforces the database size limits before saving", () => {
  const errors = validateRepertoire({
    ...EMPTY_REPERTOIRE_DRAFT,
    title: "t".repeat(181),
    category: "c".repeat(81),
    summary: "s".repeat(1201),
    purpose: "p".repeat(1201),
    application_example: "a".repeat(2401),
    themes: Array.from({ length: 13 }, (_, index) => `tema ${index}`),
    niches: Array.from({ length: 13 }, (_, index) => `recorte ${index}`),
    source_title: "o".repeat(181),
    source_author: "a".repeat(121),
    source_year: "2".repeat(41),
    source_url: `https://${"x".repeat(500)}`,
  });

  for (const field of ["title", "category", "summary", "purpose", "application_example", "themes", "niches", "source_title", "source_author", "source_year", "source_url"] as const) {
    assert.ok(errors[field], `${field} should be rejected before sending to the database`);
  }
});

test("validateRepertoire enforces the serialized byte limit for themes and niches", () => {
  const errors = validateRepertoire({
    ...EMPTY_REPERTOIRE_DRAFT,
    themes: ["tema ".repeat(1300)],
    niches: ["recorte ".repeat(800)],
  });

  assert.ok(errors.themes);
  assert.ok(errors.niches);
});

test("toDraft keeps generated content editable and labels it as AI-originated", () => {
  const draft = toDraft({
    title: "  O contrato social ", category: "Livro", summary: "Síntese", purpose: "Função",
    application_example: "Aplicação", themes: ["cidadania"], niches: ["educação"], source_year: "1762",
  });
  assert.equal(draft.title, "O contrato social");
  assert.equal(draft.origin, "ai");
  assert.equal(draft.source_year, "1762");
});

test("toDraft preserves the origin when editing a manually created repertoire", () => {
  const draft = toDraft({
    title: "Título", category: "Conceito", summary: "Síntese", purpose: "Uso",
    application_example: "Aplicação", themes: ["cidadania"], niches: ["educação"],
  }, "manual");

  assert.equal(draft.origin, "manual");
});

test("search matches theme and niche terms regardless of casing", () => {
  assert.equal(matchesRepertoireSearch({ ...EMPTY_REPERTOIRE_DRAFT, themes: ["Desigualdade"] }, "DESIGUALDADE"), true);
  assert.equal(matchesRepertoireSearch(EMPTY_REPERTOIRE_DRAFT, "saúde"), false);
});
