import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { consumeRateLimit, rateLimitHeaders } from "./rate-limit.ts";

const sample = (overrides = {}) => ({
  allowed: true,
  remaining: 2,
  limit_value: 3,
  retry_after_seconds: 0,
  reset_at: "2026-09-22T14:00:00.000Z",
  ...overrides,
});

function serviceWith(result) {
  const calls = [];
  return {
    calls,
    client: {
      async rpc(name, args) {
        calls.push({ name, args });
        return result;
      },
    },
  };
}

test("consome o RPC atomico com identidade do usuario e endereco de origem hasheado", async () => {
  const service = serviceWith({ data: [sample()], error: null });
  const req = new Request("https://local.test", { headers: { "cf-connecting-ip": "203.0.113.9" } });

  const result = await consumeRateLimit(service.client, req, "user-id", "correct-essay", 3, 60);

  assert.equal(result.allowed, true);
  assert.equal(service.calls.length, 1);
  assert.equal(service.calls[0].name, "consume_rate_limit");
  assert.deepEqual(
    { user: service.calls[0].args._user_id, endpoint: service.calls[0].args._function_name, max: service.calls[0].args._max_calls, minutes: service.calls[0].args._window_minutes },
    { user: "user-id", endpoint: "correct-essay", max: 3, minutes: 60 },
  );
  assert.match(service.calls[0].args._client_key, /^[a-f0-9]{64}$/);
});

test("nega consumo acima do limite e prepara Retry-After para HTTP 429", async () => {
  const service = serviceWith({ data: [sample({ allowed: false, remaining: 0, retry_after_seconds: 47 })], error: null });
  const result = await consumeRateLimit(service.client, new Request("https://local.test"), "user-id", "ai-study-suggestion", 10, 60);

  assert.equal(result.allowed, false);
  assert.deepEqual(rateLimitHeaders(result), {
    "X-RateLimit-Limit": "3",
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": String(Math.floor(Date.parse(result.resetAt) / 1000)),
    "Retry-After": "47",
  });
});

test("falha fechada em erro do RPC e dados de retorno malformados", async () => {
  const failed = serviceWith({ data: null, error: { code: "503" } });
  const malformed = serviceWith({ data: [{ allowed: true, remaining: "NaN" }], error: null });
  const request = new Request("https://local.test");

  await assert.rejects(consumeRateLimit(failed.client, request, "user-id", "correct-essay", 3, 60), { code: "RATE_LIMIT_UNAVAILABLE" });
  await assert.rejects(consumeRateLimit(malformed.client, request, "user-id", "correct-essay", 3, 60), { code: "RATE_LIMIT_UNAVAILABLE" });
});

test("os 11 endpoints Groq autorizam e limitam antes de executar a chamada na rota", async () => {
  const endpoints = [
    "ai-study-suggestion", "analyze-simulado", "generate-essay-topic", "classify-questions",
    "analyze-question-difficulty", "format-question", "classify-and-difficulty",
    "generate-study-schedule", "extract-question-topic", "question-explanation", "correct-essay",
  ];
  for (const endpoint of endpoints) {
    const source = await readFile(new URL(`../${endpoint}/index.ts`, import.meta.url), "utf8");
    const handlerStart = source.indexOf("serve(async (req)");
    assert.notEqual(handlerStart, -1, `${endpoint} handler`);
    const route = source.slice(handlerStart);
    const gate = Math.min(...[route.indexOf("authorizeAI("), route.indexOf("consumeRateLimit("), route.indexOf("consume_rate_limit")].filter((at) => at >= 0));
    assert.ok(Number.isFinite(gate), `${endpoint} must call a server-side limiter`);
    assert.match(route.slice(0, gate), /authorizeAI\(|authenticateRequest\(|authorization|Authorization/, `${endpoint} must authenticate before limiting`);
    assert.match(source, /Access-Control-Expose-Headers[^\n]*Retry-After/, `${endpoint} must expose retry metadata to browsers`);
    const groqKey = route.indexOf("GROQ_API_KEY");
    const groqFetch = route.indexOf("api.groq.com");
    const provider = Math.min(...[groqKey, groqFetch].filter((at) => at >= 0));
    assert.ok(provider > gate, `${endpoint} must gate before accessing Groq`);
  }
});

test("a migration usa locks por bucket e incrementa somente requests autorizados", async () => {
  const migration = await readFile(new URL("../../migrations/20260912020000_billing_security_and_atomic_quotas.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.consume_rate_limit/);
  assert.match(migration, /FOR UPDATE/);
  assert.match(migration, /IF _all_allowed THEN[\s\S]*?calls_count = calls_count \+ 1/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.consume_rate_limit[\s\S]*?TO service_role/);
});
