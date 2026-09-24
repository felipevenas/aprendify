import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../_shared/api.ts";
import { checkoutFailure } from "./checkout-errors.ts";

test("preserves known API failures", () => {
  const expected = new ApiError(400, "INVALID_CHECKOUT_REQUEST", "Inválido");
  assert.equal(checkoutFailure(expected, "validate"), expected);
});

test("maps a missing configured Stripe price to plan unavailable", () => {
  const original = console.error;
  console.error = () => {};
  try {
    const result = checkoutFailure({
      type: "StripeInvalidRequestError",
      code: "resource_missing",
      param: "line_items[0][price]",
      statusCode: 400,
    }, "session");
    assert.equal(result.status, 503);
    assert.equal(result.code, "PLAN_UNAVAILABLE");
  } finally {
    console.error = original;
  }
});

test("hides provider details and classifies transient Stripe failure as unavailable", () => {
  const original = console.error;
  let logged;
  console.error = (...args) => { logged = args; };
  try {
    const result = checkoutFailure({
      type: "StripeAPIError",
      statusCode: 500,
      message: "secret customer email",
      requestId: "req_123",
    }, "customers");
    assert.equal(result.status, 503);
    assert.equal(result.code, "CHECKOUT_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(logged), /secret customer email/);
    assert.equal(logged[1].stage, "customers");
  } finally {
    console.error = original;
  }
});

test("classifies an invalid Stripe promotion code without exposing provider text", () => {
  const original = console.error;
  console.error = () => {};
  try {
    const result = checkoutFailure({
      type: "StripeInvalidRequestError",
      code: "resource_missing",
      param: "discounts[0][promotion_code]",
      statusCode: 400,
      message: "Sensitive provider text",
    }, "session");
    assert.equal(result.status, 422);
    assert.equal(result.code, "INVALID_COUPON");
    assert.doesNotMatch(result.message, /Sensitive provider text/);
  } finally {
    console.error = original;
  }
});
