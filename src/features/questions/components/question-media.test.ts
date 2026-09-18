import assert from "node:assert/strict";
import test from "node:test";
import { getAlternativeImages, getQuestionImages } from "./question-media-utils.ts";

test("combina imagens do enunciado, remove vazios e preserva apenas URLs únicas", () => {
  const images = getQuestionImages({
    files: [" https://cdn.test/enunciado.png ", "", "https://cdn.test/grafico.png"],
    images: ["https://cdn.test/grafico.png", "https://cdn.test/tabela.png"],
  });

  assert.deepEqual(images, [
    "https://cdn.test/enunciado.png",
    "https://cdn.test/grafico.png",
    "https://cdn.test/tabela.png",
  ]);
});

test("mantém compatibilidade com o campo legado file das alternativas", () => {
  assert.deepEqual(
    getAlternativeImages({
      file: "https://cdn.test/alternativa-a.png",
      files: ["https://cdn.test/alternativa-a.png", "https://cdn.test/alternativa-a-2.png"],
    }),
    ["https://cdn.test/alternativa-a.png", "https://cdn.test/alternativa-a-2.png"],
  );
});
