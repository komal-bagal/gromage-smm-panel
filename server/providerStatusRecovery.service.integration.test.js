
require("dotenv").config();

const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { Queue, Worker } = require("bullmq");

const Order = require("./models/Order");
const redisConnection = require("./config/redis");

// Import the service and its default queue.
// The integration test itself uses a separate queue.
const {
  retryFailedProviderStatusJob
} = require("./services/providerStatusRecoveryService");

const productionQueue = require("./queues/providerStatusQueue");

// ======================================================
// ISOLATED TEST QUEUE
// ======================================================

const QUEUE_NAME =
  `provider-status-recovery-service-test-${process.pid}`;

const connection = {
  ...redisConnection,
  maxRetriesPerRequest: null
};

const queue = new Queue(QUEUE_NAME, {
  connection
});

let worker = null;
let restoreOrderFindOne = null;

const TEST_ORDER_ID =
  new mongoose.Types.ObjectId().toString();

const TEST_JOB_ID =
  `provider-status-${TEST_ORDER_ID}`;

// ======================================================
// WAIT FOR EXPECTED JOB STATE
// ======================================================

const waitForState = async (
  job,
  expectedState,
  timeoutMs = 15000
) => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const state = await job.getState();

    if (state === expectedState) {
      return state;
    }

    if (
      state === "failed" &&
      expectedState === "completed"
    ) {
      throw new Error(
        `Job failed instead of completing: ${job.failedReason}`
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 100)
    );
  }

  throw new Error(
    `Timed out waiting for state: ${expectedState}`
  );
};

// ======================================================
// CLEANUP
// ======================================================

after(async () => {
  try {
    // Restore the original Order.findOne method.
    if (restoreOrderFindOne) {
      restoreOrderFindOne();
      restoreOrderFindOne = null;
    }

    // Stop the test worker before cleaning its queue.
    if (worker) {
      await worker.close();
      worker = null;
    }
  } finally {
    try {
      // Remove jobs only from this isolated test queue.
      await queue.obliterate({ force: true });
    } finally {
      try {
        await queue.close();
      } finally {
        // Close the default queue created by the service module.
        // Do not obliterate or remove its production jobs.
        await productionQueue.close();
      }
    }
  }
});

// ======================================================
// SERVICE INTEGRATION TEST
// ======================================================

test(
  "Recovery service retries a failed job using an isolated BullMQ queue",
  async () => {
    await queue.waitUntilReady();

    // Mock the Order lookup.
    // No real MongoDB orders are modified.
    const originalFindOne = Order.findOne;

    Order.findOne = () => ({
      select() {
        return this;
      },

      lean: async () => ({
        _id: TEST_ORDER_ID
      })
    });

    restoreOrderFindOne = () => {
      Order.findOne = originalFindOne;
    };

    let processorAttempts = 0;

    // Start a worker on the isolated integration-test queue.
    worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        processorAttempts += 1;

        console.log(
          "SERVICE TEST PROCESSOR ATTEMPT:",
          {
            jobId: job.id,
            attempt: processorAttempts
          }
        );

        // Simulate a failure on the initial attempt.
        if (processorAttempts === 1) {
          throw new Error(
            "Simulated initial failure"
          );
        }

        // The recovered attempt succeeds.
        return {
          success: true,
          orderId: job.data.orderId
        };
      },
      {
        connection,
        concurrency: 1
      }
    );

    await worker.waitUntilReady();

    // Create a job that will become failed after one attempt.
    const job = await queue.add(
      "provider-status-recovery-test",
      {
        orderId: TEST_ORDER_ID
      },
      {
        jobId: TEST_JOB_ID,
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false
      }
    );

    // --------------------------------------------------
    // 1. Confirm initial failure.
    // --------------------------------------------------

    await waitForState(job, "failed");

    assert.equal(
      processorAttempts,
      1,
      "The initial attempt should fail exactly once"
    );

    console.log(
      "FAILED JOB CONFIRMED:",
      TEST_JOB_ID
    );

    // --------------------------------------------------
    // 2. Invoke the recovery service with the test queue.
    // --------------------------------------------------

    const recoveryResult =
      await retryFailedProviderStatusJob(
        TEST_ORDER_ID,
        { queue }
      );

    assert.equal(recoveryResult.success, true);

    assert.equal(
      recoveryResult.jobId,
      TEST_JOB_ID
    );

    assert.equal(
      recoveryResult.orderId,
      TEST_ORDER_ID
    );

    console.log(
      "RECOVERY SERVICE RESULT:",
      recoveryResult
    );

    // --------------------------------------------------
    // 3. Verify the recovered job completes.
    // --------------------------------------------------

    await waitForState(job, "completed");

    // Reload the job from Redis for its latest result.
    const completedJob =
      await queue.getJob(TEST_JOB_ID);

    assert.ok(
      completedJob,
      "Completed job should still exist in Redis"
    );

    const finalState =
      await completedJob.getState();

    assert.equal(finalState, "completed");

    assert.equal(
      processorAttempts,
      2,
      "The worker should process the recovered job again"
    );

    assert.deepEqual(
      completedJob.returnvalue,
      {
        success: true,
        orderId: TEST_ORDER_ID
      }
    );

    console.log(
      "SERVICE INTEGRATION RESULT: PASS",
      {
        jobId: TEST_JOB_ID,
        processorAttempts,
        finalState,
        result: completedJob.returnvalue
      }
    );
  }
);
