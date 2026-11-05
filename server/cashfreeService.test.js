
const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");

// Use dummy sandbox configuration only.
// No real Cashfree credentials or network requests are needed.
process.env.CASHFREE_ENVIRONMENT = "sandbox";
process.env.CASHFREE_CLIENT_ID = "test_client_id";
process.env.CASHFREE_CLIENT_SECRET = "test_client_secret";
process.env.CASHFREE_RETURN_URL =
  "http://localhost:5175/payment/return";
delete process.env.CASHFREE_NOTIFY_URL;

const axios = require("axios");
const {
  createCashfreeOrder,
  generateCashfreeOrderId,
  generateCashfreeIdempotencyKey,
  formatCashfreeAmount,
} = require("./services/cashfreeService");

const originalPost = axios.post;
const originalConsoleError = console.error;

afterEach(() => {
  axios.post = originalPost;
  console.error = originalConsoleError;
});

function validOrderInput(overrides = {}) {
  return {
    reference: "cashfree-test-reference-001",
    amount: 100,
    userId: "test-user-001",
    name: "Test Customer",
    email: "test@example.com",
    phone: "9876543210",
    ...overrides,
  };
}

test("formats valid payment amounts to two decimal places", () => {
  assert.equal(formatCashfreeAmount(100), 100);
  assert.equal(formatCashfreeAmount(12.345), 12.35);
});

test("rejects zero, negative, and invalid payment amounts", () => {
  assert.throws(() => formatCashfreeAmount(0));
  assert.throws(() => formatCashfreeAmount(-10));
  assert.throws(() => formatCashfreeAmount("invalid"));
});

test("generates deterministic order IDs and idempotency keys", () => {
  const reference = "cashfree-test-reference-001";

  assert.equal(
    generateCashfreeOrderId(reference),
    generateCashfreeOrderId(reference)
  );

  assert.equal(
    generateCashfreeIdempotencyKey(reference),
    generateCashfreeIdempotencyKey(reference)
  );

  assert.notEqual(
    generateCashfreeOrderId(reference),
    generateCashfreeOrderId("different-reference")
  );
});

test("creates an order and returns sanitized gateway metadata", async () => {
  let capturedUrl;
  let capturedPayload;
  let capturedConfig;

  const expectedOrderId = generateCashfreeOrderId(
    "cashfree-test-reference-001"
  );

  axios.post = async (url, payload, config) => {
    capturedUrl = url;
    capturedPayload = payload;
    capturedConfig = config;

    return {
      data: {
        order_id: expectedOrderId,
        payment_session_id: "test_payment_session",
        cf_order_id: "test_cf_order_id",
        order_status: "ACTIVE",
        order_amount: 100,
        order_currency: "INR",
      },
    };
  };

  const result = await createCashfreeOrder(validOrderInput());

  assert.equal(result.success, true);
  assert.equal(result.orderId, expectedOrderId);
  assert.equal(result.amount, 100);
  assert.equal(result.currency, "INR");
  assert.equal(result.paymentSessionId, "test_payment_session");

  assert.equal(capturedUrl, "https://sandbox.cashfree.com/pg/orders");
  assert.equal(capturedPayload.order_id, expectedOrderId);
  assert.equal(capturedPayload.order_amount, 100);
  assert.equal(capturedPayload.order_currency, "INR");
  assert.equal(capturedPayload.customer_details.customer_phone, "9876543210");

  assert.equal(
    capturedConfig.headers["x-idempotency-key"],
    generateCashfreeIdempotencyKey("cashfree-test-reference-001")
  );

  assert.equal(capturedConfig.timeout, 15000);

  // Do not expose the payment session in sanitized metadata.
  assert.equal(
    Object.hasOwn(result.response, "payment_session_id"),
    false
  );
});

test("reuses the same order ID and idempotency key for the same reference", async () => {
  const calls = [];

  axios.post = async (url, payload, config) => {
    calls.push({ payload, config });

    return {
      data: {
        order_id: payload.order_id,
        payment_session_id: "test_session",
        order_amount: payload.order_amount,
        order_currency: "INR",
      },
    };
  };

  await createCashfreeOrder(validOrderInput());
  await createCashfreeOrder(validOrderInput());

  assert.equal(calls.length, 2);

  assert.equal(
    calls[0].payload.order_id,
    calls[1].payload.order_id
  );

  assert.equal(
    calls[0].config.headers["x-idempotency-key"],
    calls[1].config.headers["x-idempotency-key"]
  );
});

test("classifies a network failure as an uncertain outcome", async () => {
  axios.post = async () => {
    const error = new Error("Simulated network failure");
    error.code = "ECONNRESET";
    throw error;
  };

  console.error = () => {};

  await assert.rejects(
    createCashfreeOrder(validOrderInput()),
    (error) => {
      assert.equal(error.code, "CASHFREE_UNCERTAIN_OUTCOME");
      assert.equal(error.retryable, true);
      assert.equal(error.outcomeUnknown, true);
      return true;
    }
  );
});

test("classifies an HTTP rejection as a definite failure", async () => {
  axios.post = async () => {
    const error = new Error("Invalid request");
    error.response = {
      status: 400,
      data: { message: "Invalid request" },
    };
    throw error;
  };

  console.error = () => {};

  await assert.rejects(
    createCashfreeOrder(validOrderInput()),
    (error) => {
      assert.equal(error.code, "CASHFREE_ORDER_CREATION_FAILED");
      assert.equal(error.retryable, false);
      assert.equal(error.outcomeUnknown, false);
      return true;
    }
  );
});

test("classifies a malformed successful response as uncertain", async () => {
  axios.post = async () => ({
    data: {
      order_id: "unexpected-order-id",
      payment_session_id: "test_session",
    },
  });

  console.error = () => {};

  await assert.rejects(
    createCashfreeOrder(validOrderInput()),
    (error) => {
      assert.equal(error.code, "CASHFREE_UNCERTAIN_OUTCOME");
      assert.equal(error.retryable, true);
      assert.equal(error.outcomeUnknown, true);
      return true;
    }
  );
});

test("rejects an invalid phone number before making a request", async () => {
  let requestCalled = false;

  axios.post = async () => {
    requestCalled = true;
    throw new Error("Unexpected network request");
  };

  await assert.rejects(
    createCashfreeOrder(
      validOrderInput({ phone: "12345" })
    )
  );

  assert.equal(requestCalled, false);
});
