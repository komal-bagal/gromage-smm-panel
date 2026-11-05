
process.env.NODE_ENV = "test";

const { Queue, Worker } = require("bullmq");
const Redis = require("ioredis");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const providerStatusService = require("./services/providerStatusService");

const {
  processProviderStatusSync,
  providerStatusBackoff
} = require("./workers/providerStatusWorker");

const connection = {
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null
};

const queueName = `provider-worker-test-${randomUUID()}`;

async function main() {
  const queueConnection = new Redis(connection);
  const workerConnection = new Redis(connection);

  const queue = new Queue(queueName, {
    connection: queueConnection
  });

  let attempts = 0;
  let worker;
  let timeout;
  let originalSync;
  let serviceMockInstalled = false;

  try {
    // Mock the service so no database or provider API is called.
    originalSync = providerStatusService.syncOrderProviderStatus;

    providerStatusService.syncOrderProviderStatus = async ({ orderId }) => {
      attempts++;

      console.log(`Mock service attempt: ${attempts}`);

      if (attempts === 1) {
        const error = new Error("Simulated provider rate limit");
        error.code = "RATE_LIMIT";
        error.retryable = true;
        error.retryAfterMs = 1500;
        throw error;
      }

      return {
        orderId,
        status: "completed",
        statusChanged: true
      };
    };

    serviceMockInstalled = true;

    worker = new Worker(
      queueName,
      processProviderStatusSync,
      {
        connection: workerConnection,
        settings: {
          backoffStrategy: providerStatusBackoff
        }
      }
    );

    const resultPromise = new Promise((resolve, reject) => {
      timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for worker job"));
      }, 15000);

      worker.on("completed", (job, result) => {
        if (job.name === "sync-provider-status") {
          resolve(result);
        }
      });

      worker.on("failed", (job, error) => {
        if (
          job?.name === "sync-provider-status" &&
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
      "sync-provider-status",
      { orderId: "integration-test-order" },
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
    assert.equal(result.orderId, "integration-test-order");
    assert.equal(result.status, "completed");
    assert.equal(result.statusChanged, true);

    console.log("PASS: Production worker processed the job.");
    console.log("PASS: Retryable service error was retried.");
    console.log("PASS: Job succeeded on the second attempt.");
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

    if (serviceMockInstalled) {
      providerStatusService.syncOrderProviderStatus = originalSync;
    }
  }
}

main().catch((error) => {
  console.error("INTEGRATION TEST FAILED:", error);
  process.exitCode = 1;
});
