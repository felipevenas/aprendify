import test from "node:test";
import assert from "node:assert/strict";
import { parseGeneratedRepertoire, validateRepertoireInput } from "./domain.ts";

const validOutput = {
  title: "A cidade e o direito à memória",
  category: "Cinema brasileiro",
  summary: "A obra permite discutir a preservação da memória coletiva e seus conflitos.",
  purpose: "Relacionar apagamento cultural, identidade e políticas de preservação.",
  application_example: "No debate sobre patrimônio cultural, a narrativa evidencia como a ausência de políticas de preservação pode enfraquecer a memória coletiva e limitar o reconhecimento de grupos historicamente marginalizados.",
  themes: ["Patrimônio cultural", "Memória coletiva"],
  niches: ["Políticas de preservação", "Identidade cultural"],
  source_title: "Narrativas da cidade",
  source_author: "Autoria coletiva",
  source_year: "2020",
  source_url: "https://example.org/obra",
};

test("valida tema e aceita recorte e contexto opcionais", () => {
  assert.deepEqual(validateRepertoireInput({ topic: "  Patrimônio cultural  ", focus: "memória urbana" }), {
    ok: true,
    value: { topic: "Patrimônio cultural", focus: "memória urbana" },
  });
  assert.equal(validateRepertoireInput({ topic: "   " }).ok, false);
  assert.equal(validateRepertoireInput({ topic: "Tema", context: "x".repeat(801) }).ok, false);
  assert.equal(validateRepertoireInput([]).ok, false);
});

test("parseia JSON válido e normaliza referências opcionais", () => {
  const parsed = parseGeneratedRepertoire(JSON.stringify(validOutput));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.origin, "ai");
  assert.deepEqual(parsed.value.themes, validOutput.themes);
  assert.equal(parsed.value.source_year, "2020");
  const numericYear = parseGeneratedRepertoire(JSON.stringify({ ...validOutput, source_year: 2020 }));
  assert.equal(numericYear.ok, true);
  if (numericYear.ok) assert.equal(numericYear.value.source_year, "2020");
  assert.equal(parseGeneratedRepertoire(JSON.stringify({ ...validOutput, source_title: null, source_author: null, source_year: null, source_url: null })).ok, true);
});

test("aceita fence JSON e rejeita conteúdo que não seja JSON", () => {
  assert.equal(parseGeneratedRepertoire(`\`\`\`json\n${JSON.stringify(validOutput)}\n\`\`\``).ok, true);
  assert.equal(parseGeneratedRepertoire("texto livre sem objeto").ok, false);
  assert.equal(parseGeneratedRepertoire("null").ok, false);
  const invalidJson = parseGeneratedRepertoire("texto livre sem objeto");
  assert.equal(invalidJson.ok, false);
  if (!invalidJson.ok) assert.equal(invalidJson.reason, "invalid_json");
});

test("rejeita campos ausentes, listas inválidas, URL insegura e saída excessiva", () => {
  assert.equal(parseGeneratedRepertoire(JSON.stringify({ ...validOutput, application_example: " " })).ok, false);
  assert.equal(parseGeneratedRepertoire(JSON.stringify({ ...validOutput, themes: [] })).ok, false);
  assert.equal(parseGeneratedRepertoire(JSON.stringify({ ...validOutput, niches: ["x".repeat(101)] })).ok, false);
  assert.equal(parseGeneratedRepertoire(JSON.stringify({ ...validOutput, source_url: "javascript:alert(1)" })).ok, false);
  assert.equal(parseGeneratedRepertoire("x".repeat(16_001)).ok, false);
});
