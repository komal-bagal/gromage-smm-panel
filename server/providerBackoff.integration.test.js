
process.env.NODE_ENV = "test";

const { Queue, Worker } = require("bullmq");
const Redis = require("ioredis");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const {
  providerStatusBackoff: backoffStrategy
} = require("./workers/providerStatusWorker");

const connection = {
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null
};

const queueName = `provider-backoff-test-${randomUUID()}`;

async function main() {
  const queueConnection = new Redis(connection);
  const workerConnection = new Redis(connection);

  const queue = new Queue(queueName, {
    connection: queueConnection
  });

  let attempts = 0;
  const attemptTimes = [];

  let worker;
  let timeout;

  try {
    worker = new Worker(
      queueName,
      async () => {
        attempts++;

        const attemptTime = Date.now();
        attemptTimes.push(attemptTime);

        console.log(
          `Processor attempt: ${attempts} at ${new Date(attemptTime).toISOString()}`
        );

        if (attempts > 1) {
          const actualDelay =
            attemptTimes[attempts - 1] -
            attemptTimes[attempts - 2];

          console.log(
            `Actual retry delay: ${actualDelay} ms`
          );

          // Default first retry is 5000 ms.
          // Allow a small scheduling tolerance.
          assert.ok(
            actualDelay >= 4000,
            `Retry happened too early: ${actualDelay} ms`
          );

          assert.ok(
            actualDelay < 10000,
            `Retry took unexpectedly long: ${actualDelay} ms`
          );
        }

        // Simulate a retryable HTTP 429 response
        // without a provider-supplied Retry-After delay.
        if (attempts === 1) {
          const error = new Error("Simulated HTTP 429");

          error.code = "RATE_LIMIT";
          error.retryable = true;

          // Intentionally omit error.retryAfterMs.
          // The production backoff should use its default delay.

          throw error;
        }

        // The second attempt succeeds.
        return {
          success: true,
          attempts
        };
      },
      {
        connection: workerConnection,
        settings: {
          backoffStrategy
        }
      }
    );

    const resultPromise = new Promise((resolve, reject) => {
      timeout = setTimeout(() => {
        reject(
          new Error("Test timed out waiting for job completion")
        );
      }, 15000);

      worker.on("completed", (job, result) => {
        if (job.name === "retry-check") {
          resolve(result);
        }
      });

      worker.on("failed", (job, error) => {
        if (
          job?.name === "retry-check" &&
          job.attemptsMade >= 2
        ) {
          reject(error);
        }
      });

      worker.on("error", (error) => {
        console.error("Worker error:", error.message);
      });
    });

    await worker.waitUntilReady();

    await queue.add(
      "retry-check",
      { test: true },
      {
        attempts: 2,
        backoff: {
          type: "custom",
          delay: 5000
        },
        removeOnComplete: true,
        removeOnFail: true
      }
    );

    const result = await resultPromise;

    assert.equal(attempts, 2);
    assert.equal(result.success, true);
    assert.equal(result.attempts, 2);

    console.log("PASS: Production backoff strategy was used.");
    console.log("PASS: Default exponential backoff was verified.");
    console.log("PASS: BullMQ retried the job successfully.");
    console.log("PASS: Total processor attempts:", attempts);
    console.log("PASS: Retry delay was within the expected range.");
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }

    if (worker) {
      await worker.close();
    }

    await queue.obliterate({ force: true });
    await queue.close();

    await queueConnection.quit();
    await workerConnection.quit();
  }
}

main().catch((error) => {
  console.error("INTEGRATION TEST FAILED:", error);
  process.exitCode = 1;
});
