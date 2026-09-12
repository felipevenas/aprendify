import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paymentReturnUrl, APP_ORIGIN } from './redirects.ts';

test('payment returns preserve trusted app paths only', () => {
  assert.equal(paymentReturnUrl('/subscription/success?session_id=123', '/dashboard'), `${APP_ORIGIN}/subscription/success?session_id=123`);
  assert.equal(paymentReturnUrl(`${APP_ORIGIN}/dashboard`, '/dashboard'), `${APP_ORIGIN}/dashboard`);
});

test('external, malformed and misleading redirect URLs fall back to the app', () => {
  for (const input of [undefined, {}, 'https://evil.test', '//evil.test', 'https://app.aprendify.cloud.evil.test', 'https://app.aprendify.cloud@evil.test', 'https://user:pass@app.aprendify.cloud', 'javascript:alert(1)', '/\\evil.test', '\nhttps://evil.test', 'http://app.aprendify.cloud', 'https://aprendify.cloud']) {
    assert.equal(paymentReturnUrl(input, '/dashboard'), `${APP_ORIGIN}/dashboard`, String(input));
  }
});
