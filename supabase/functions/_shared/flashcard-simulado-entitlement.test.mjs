import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../../migrations/20260923113000_harden_flashcards_and_simulados.sql", import.meta.url),
  "utf8",
);
const completeTrialConstraint = /ADD CONSTRAINT free_trial_start_end_pair CHECK \([\s\S]*?started_at IS NOT NULL[\s\S]*?ends_at IS NOT NULL[\s\S]*?ends_at = started_at \+ interval '72 hours'/;

test("constraint de trial só aceita nenhum timestamp ou par completo de 72 horas", () => {
  assert.match(migration, completeTrialConstraint);
});

test("flashcards gratuitos têm teto server-side serializado sem bloquear edição e exclusão", () => {
  assert.match(migration, /BEFORE INSERT ON public\.flashcards/);
  assert.match(migration, /public\.is_user_premium\(auth\.uid\(\)\)/);
  assert.match(migration, /public\.profiles WHERE id = _user_id FOR UPDATE/);
  assert.match(migration, /count\(\*\)::integer INTO _current_count[\s\S]*?WHERE user_id = _user_id/);
  assert.match(migration, /_current_count >= 10/);
  assert.match(migration, /FLASHCARD_FREE_LIMIT_REACHED/);
  assert.match(migration, /CREATE POLICY "Users can view their own flashcards"/);
  assert.match(migration, /CREATE POLICY "Users can update their own flashcards"/);
  assert.match(migration, /CREATE POLICY "Users can delete their own flashcards"/);
});

test("simulados exigem entitlement para criar e continuar, mantendo histórico e limpeza", () => {
  assert.match(migration, /CREATE POLICY "Users can view their own simulados"/);
  assert.match(migration, /CREATE POLICY "Premium users can create their own simulados"[\s\S]*?public\.is_user_premium\(auth\.uid\(\)\)/);
  assert.match(migration, /CREATE POLICY "Premium users can update their own simulados"[\s\S]*?public\.is_user_premium\(auth\.uid\(\)\)/);
  assert.match(migration, /CREATE POLICY "Users can delete their own simulados"/);
});

test("respostas de simulado exigem entitlement nas mutações; resultados são somente leitura", () => {
  assert.match(migration, /CREATE POLICY "Users can view their own simulado answers"/);
  assert.match(migration, /CREATE POLICY "Premium users can insert their own simulado answers"[\s\S]*?public\.is_user_premium\(auth\.uid\(\)\)/);
  assert.match(migration, /CREATE POLICY "Premium users can update their own simulado answers"[\s\S]*?public\.is_user_premium\(auth\.uid\(\)\)/);
  assert.match(migration, /CREATE POLICY "Users can delete their own simulado answers"/);
  assert.match(migration, /CREATE POLICY "Users can view their own simulado results"/);
  assert.match(migration, /CREATE POLICY "Users can delete their own simulado results"/);
  assert.doesNotMatch(migration, /CREATE POLICY "Users can (?:insert|update) their own simulado results"/);
});
