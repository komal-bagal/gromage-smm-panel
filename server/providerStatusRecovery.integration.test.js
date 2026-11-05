
require("dotenv").config();

const {
  test,
  after
} = require("node:test");

const assert = require("node:assert/strict");
const { Queue, Worker } = require("bullmq");

const redisConnection = require("./config/redis");

// ======================================================
// ISOLATED INTEGRATION TEST QUEUE
// Never use the production queue for this test.
// ======================================================

const QUEUE_NAME =
  `provider-status-recovery-integration-test-${process.pid}`;

const connection = {
  ...redisConnection,
  maxRetriesPerRequest: null
};

const queue = new Queue(QUEUE_NAME, {
  connection
});

let worker;

// ======================================================
// WAIT FOR EXPECTED JOB STATE
// ======================================================

const waitForState = async (
  job,
  expectedState,
  timeoutMs = 15000
) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const currentState = await job.getState();

    if (currentState === expectedState) {
      return currentState;
    }

    if (
      currentState === "failed" &&
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
    `Timed out waiting for job state "${expectedState}"`
  );
};

// ======================================================
// CLEANUP
// ======================================================

after(async () => {
  try {
    if (worker) {
      await worker.close();
    }
  } finally {
    try {
      // This queue name is unique to this test process.
      await queue.obliterate({ force: true });
    } finally {
      await queue.close();
    }
  }
});

// ======================================================
// INTEGRATION TEST
// ======================================================

test(
  "BullMQ retries a manually recovered failed job and completes it",
  async () => {
    await queue.waitUntilReady();

    let processorAttempts = 0;

    worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        processorAttempts += 1;

        console.log(
          "INTEGRATION PROCESSOR ATTEMPT:",
          {
            jobId: job.id,
            attempt: processorAttempts
          }
        );

        // Simulate a failure on the first attempt.
        if (processorAttempts === 1) {
          throw new Error(
            "Simulated first-attempt failure"
          );
        }

        // The manually retried attempt succeeds.
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

    const job = await queue.add(
      "test-provider-status-recovery",
      {
        orderId: "integration-test-order"
      },
      {
        // First failure moves the job to failed state.
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false
      }
    );

    // --------------------------------------------------
    // 1. Confirm that the first attempt fails.
    // --------------------------------------------------

    await waitForState(job, "failed");

    assert.equal(
      processorAttempts,
      1,
      "First attempt should fail exactly once"
    );

    console.log(
      "FAILED JOB CONFIRMED:",
      job.id
    );

    // --------------------------------------------------
    // 2. Retry the existing failed job.
    // --------------------------------------------------

    await job.retry("failed");

    console.log(
      "FAILED JOB RETRIED:",
      job.id
    );

    // --------------------------------------------------
    // 3. Wait for the worker to complete the retry.
    // --------------------------------------------------

    await waitForState(job, "completed");

    // Reload the latest job data from Redis.
    // The original job object may contain stale returnvalue.
    const completedJob = await queue.getJob(job.id);

    assert.ok(
      completedJob,
      "Completed job should still exist in Redis"
    );

    const finalState = await completedJob.getState();
    const result = completedJob.returnvalue;

    // --------------------------------------------------
    // 4. Verify the actual result.
    // --------------------------------------------------

    assert.equal(
      finalState,
      "completed",
      "Recovered job should reach completed state"
    );

    assert.equal(
      processorAttempts,
      2,
      "Worker should process the recovered job again"
    );

    assert.deepEqual(result, {
      success: true,
      orderId: "integration-test-order"
    });

    console.log(
      "INTEGRATION RESULT: PASS",
      {
        jobId: completedJob.id,
        processorAttempts,
        finalState,
        result
      }
    );
  }
);
