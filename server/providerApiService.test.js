
const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const originalFetch = global.fetch;

const {
  createProviderOrder,
  fetchProviderOrderStatus
} = require("./services/providerApiService");

afterEach(() => {
  global.fetch = originalFetch;
});

const provider = {
  _id: "507f1f77bcf86cd799439011",
  apiUrl: "https://provider.example/api",
  apiKey: "test-only-key"
};

const TEST_ORDER_ID = "507f1f77bcf86cd799439012";

// ======================================================
// TEST 1: CREATE ORDER MUST NOT RETRY AFTER A TIMEOUT
// ======================================================

test("Create order does not retry after a network timeout", async () => {
  let calls = 0;

  global.fetch = async () => {
    calls += 1;

    const error = new Error("Simulated timeout");
    error.name = "AbortError";

    throw error;
  };

  await assert.rejects(
    createProviderOrder({
      provider,
      orderId: TEST_ORDER_ID,
      service: "100",
      link: "https://example.com/post",
      quantity: 10
    }),
    (error) => {
      assert.equal(error.code, "PROVIDER_TIMEOUT");
      assert.equal(error.retryable, true);
      return true;
    }
  );

  assert.equal(calls, 1);
});

// ======================================================
// TEST 2: STATUS REQUEST MAKES ONE ATTEMPT ON HTTP 503
// ======================================================

test("Status request does not retry internally after HTTP 503", async () => {
  let calls = 0;

  global.fetch = async () => {
    calls += 1;

    return new Response(
      JSON.stringify({
        message: "Temporary error"
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  };

  await assert.rejects(
    fetchProviderOrderStatus({
      provider,
      providerOrderId: "provider-order-503",
      orderId: TEST_ORDER_ID
    }),
    (error) => {
      assert.equal(error.code, "PROVIDER_SERVER_ERROR");
      assert.equal(error.retryable, true);
      return true;
    }
  );

  assert.equal(
    calls,
    1,
    "Each status invocation should make only one HTTP request"
  );
});

// ======================================================
// TEST 3: STATUS REQUEST MAKES ONE ATTEMPT ON HTTP 429
// ======================================================

test("Status request does not retry internally after HTTP 429", async () => {
  let calls = 0;

  global.fetch = async () => {
    calls += 1;

    return new Response(
      JSON.stringify({
        message: "Too many requests - rate limit exceeded"
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "30"
        }
      }
    );
  };

  await assert.rejects(
    fetchProviderOrderStatus({
      provider,
      providerOrderId: "provider-order-429",
      orderId: TEST_ORDER_ID
    }),
    (error) => {
      assert.equal(error.code, "RATE_LIMIT");
      assert.equal(error.retryable, true);
      return true;
    }
  );

  assert.equal(
    calls,
    1,
    "HTTP 429 should be returned to BullMQ without an internal retry"
  );
});

// ======================================================
// TEST 4: INVALID STATUS RESPONSE MUST NOT BE RETRIED
// ======================================================

test("Invalid provider status response is non-retryable", async () => {
  let calls = 0;

  global.fetch = async () => {
    calls += 1;

    return new Response(
      JSON.stringify({
        message: "Unexpected response"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  };

  await assert.rejects(
    fetchProviderOrderStatus({
      provider,
      providerOrderId: "provider-order-invalid",
      orderId: TEST_ORDER_ID
    }),
    (error) => {
      assert.equal(error.code, "INVALID_PROVIDER_RESPONSE");
      assert.equal(error.retryable, false);
      return true;
    }
  );

  assert.equal(calls, 1);
});
