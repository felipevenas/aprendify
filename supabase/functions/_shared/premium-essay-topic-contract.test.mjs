import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const endpoint = await readFile(
  new URL("../generate-essay-topic/index.ts", import.meta.url),
  "utf8",
);

test("tema de redaÃ§Ã£o exige entitlement Premium antes de chamar a IA", () => {
  const entitlementCheck = endpoint.indexOf('.rpc("is_user_premium", { _user_id: user.id })');
  const deniedStatus = endpoint.indexOf("status: 403", entitlementCheck);
  const providerCall = endpoint.indexOf('fetch("https://api.groq.com/openai/v1/chat/completions"');

  assert.notEqual(entitlementCheck, -1);
  assert.notEqual(deniedStatus, -1);
  assert.notEqual(providerCall, -1);
  assert.ok(entitlementCheck < deniedStatus);
  assert.ok(deniedStatus < providerCall);
  assert.match(endpoint, /ENTITLEMENT_UNAVAILABLE[\s\S]*?status: 503/);
  assert.match(endpoint, /PREMIUM_REQUIRED[\s\S]*?status: 403/);
});
