
const test = require("node:test");
const assert = require("node:assert/strict");

const Order = require("./models/Order");
const providerStatusQueue = require("./queues/providerStatusQueue");

const {
  retryFailedProviderStatusJob
} = require("./services/providerStatusRecoveryService");

const VALID_ORDER_ID = "507f1f77bcf86cd799439011";

const mockEligibleOrder = (t, order = { _id: VALID_ORDER_ID }) => {
  t.mock.method(Order, "findOne", () => ({
    select: () => ({
      lean: async () => order
    })
  }));
};

// ------------------------------------------------------
// CLEANUP
// Close the BullMQ queue connection after all tests.
// ------------------------------------------------------

test("provider status recovery test setup", async (t) => {
  t.after(async () => {
    await providerStatusQueue.close();
  });
});

// ------------------------------------------------------
// TEST 1: Invalid order ID
// ------------------------------------------------------

test("rejects an invalid order ID", async () => {
  await assert.rejects(
    retryFailedProviderStatusJob("invalid-id"),
    /Invalid order ID/
  );
});

// ------------------------------------------------------
// TEST 2: Order missing or ineligible
// ------------------------------------------------------

test("rejects when the order is not eligible", async (t) => {
  mockEligibleOrder(t, null);

  await assert.rejects(
    retryFailedProviderStatusJob(VALID_ORDER_ID),
    /Order not found or is not eligible/
  );
});

// ------------------------------------------------------
// TEST 3: Provider status job missing
// ------------------------------------------------------

test("rejects when the provider status job does not exist", async (t) => {
  mockEligibleOrder(t);

  t.mock.method(
    providerStatusQueue,
    "getJob",
    async () => null
  );

  await assert.rejects(
    retryFailedProviderStatusJob(VALID_ORDER_ID),
    /Provider status job not found/
  );
});

// ------------------------------------------------------
// TEST 4: Job is not failed
// ------------------------------------------------------

test("rejects a job that is not in failed state", async (t) => {
  mockEligibleOrder(t);

  t.mock.method(
    providerStatusQueue,
    "getJob",
    async () => ({
      getState: async () => "waiting"
    })
  );

  await assert.rejects(
    retryFailedProviderStatusJob(VALID_ORDER_ID),
    /expected failed state, got waiting/
  );
});

// ------------------------------------------------------
// TEST 5: Retry eligible failed job
// ------------------------------------------------------

test("retries an eligible failed job", async (t) => {
  mockEligibleOrder(t);

  let retryCalled = false;
  let retryState;

  const failedJob = {
    attemptsMade: 3,
    failedReason: "Simulated provider rate limit",

    getState: async () => "failed",

    retry: async (state) => {
      retryCalled = true;
      retryState = state;
    }
  };

  t.mock.method(
    providerStatusQueue,
    "getJob",
    async () => failedJob
  );

  const result = await retryFailedProviderStatusJob(
    VALID_ORDER_ID
  );

  assert.equal(retryCalled, true);
  assert.equal(retryState, "failed");
  assert.equal(result.success, true);
  assert.equal(result.orderId, VALID_ORDER_ID);

  assert.equal(
    result.jobId,
    `provider-status-${VALID_ORDER_ID}`
  );

  assert.equal(
    result.message,
    "Failed provider status job queued for retry"
  );
});
