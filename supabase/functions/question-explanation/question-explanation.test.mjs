import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./index.ts", import.meta.url), "utf8");

test("usa modelo de visão Groq suportado para questões com imagens", () => {
  assert.match(source, /meta-llama\/llama-4-scout-17b-16e-instruct/);
  assert.doesNotMatch(source, /llama-3\.2-11b-vision-preview/);
});

test("autoriza preflight CORS para POST da aplicação web", () => {
  assert.match(source, /"Access-Control-Allow-Methods":\s*"POST, OPTIONS"/);
});
