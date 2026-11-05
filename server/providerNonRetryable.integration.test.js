
const { Queue, Worker, UnrecoverableError } = require("bullmq");
const Redis = require("ioredis");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const connection = {
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null
};

const queueName = `provider-nonretry-test-${randomUUID()}`;

async function main() {
  const queueConnection = new Redis(connection);
  const workerConnection = new Redis(connection);

  const queue = new Queue(queueName, {
    connection: queueConnection
  });

  let attempts = 0;
  let worker;
  let timeout;

  try {
    worker = new Worker(
      queueName,
      async () => {
        attempts++;

        console.log(`Processor attempt: ${attempts}`);

        const error = new Error("Simulated invalid provider response");
        error.retryable = false;

        throw new UnrecoverableError(error.message);
      },
      {
        connection: workerConnection
      }
    );

    const failedPromise = new Promise((resolve, reject) => {
      timeout = setTimeout(() => {
        reject(new Error("Test timed out waiting for job failure"));
      }, 10000);

      worker.on("failed", (job, error) => {
        if (job?.name === "non-retryable-check") {
          resolve({ job, error });
        }
      });

      worker.on("error", (error) => {
        console.error("Worker error:", error.message);
      });
    });

    await worker.waitUntilReady();

    await queue.add(
      "non-retryable-check",
      { test: true },
      {
        attempts: 3,
        backoff: {
          type: "custom",
          delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: true
      }
    );

    const { job, error } = await failedPromise;

    assert.equal(attempts, 1);
    assert.equal(job.attemptsMade, 1);
    assert.equal(error.message, "Simulated invalid provider response");

    console.log("PASS: Non-retryable job failed without retry.");
    console.log("PASS: Total processor attempts:", attempts);
  } finally {
    if (timeout) clearTimeout(timeout);

    if (worker) await worker.close();

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
