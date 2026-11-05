
require("dotenv").config();

const {
  Worker,
  UnrecoverableError
} = require("bullmq");

const connectDB = require("../config/db");
const redisConnection = require("../config/redis");

// Import the service object so integration tests can mock
// syncOrderProviderStatus before the worker processes a job.
const providerStatusService = require("../services/providerStatusService");

// ======================================================
// PROVIDER STATUS RETRY BACKOFF CONFIGURATION
// ======================================================

const DEFAULT_RETRY_DELAY_MS = 5000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;

// ======================================================
// CUSTOM BACKOFF STRATEGY
// ======================================================

const providerStatusBackoff = (
  attemptsMade,
  type,
  error,
  job
) => {
  const retryAfterValue = error?.retryAfterMs;

  // Prefer the provider's Retry-After value when valid.
  if (
    retryAfterValue !== undefined &&
    retryAfterValue !== null &&
    retryAfterValue !== ""
  ) {
    const retryAfterMs = Number(retryAfterValue);

    if (
      Number.isFinite(retryAfterMs) &&
      retryAfterMs >= 0
    ) {
      const delay = Math.min(
        retryAfterMs,
        MAX_RETRY_DELAY_MS
      );

      console.log("Provider retry delay selected", {
        jobId: job?.id,
        attemptsMade,
        retryAfterMs,
        delayMs: delay,
        source: "Retry-After"
      });

      return delay;
    }
  }

  // Fallback: exponential backoff.
  // First retry: 5 seconds; second retry: 10 seconds.
  // Maximum retry delay: 15 minutes.
  const exponent = Math.max(0, attemptsMade - 1);

  const delay = Math.min(
    DEFAULT_RETRY_DELAY_MS * (2 ** exponent),
    MAX_RETRY_DELAY_MS
  );

  console.log("Provider retry delay selected", {
    jobId: job?.id,
    attemptsMade,
    delayMs: delay,
    source: "exponential"
  });

  return delay;
};

// ======================================================
// PROVIDER STATUS SYNC WORKER
// ======================================================

const processProviderStatusSync = async (job) => {
  const { orderId } = job.data || {};

  if (!orderId) {
    throw new UnrecoverableError(
      "Order ID is required for provider status sync"
    );
  }

  console.log("====================================");
  console.log("PROVIDER STATUS SYNC JOB");
  console.log("JOB ID:", job.id);
  console.log("ORDER ID:", orderId);
  console.log("====================================");

  try {
    // Access the method through the service object.
    // This allows integration tests to replace the method.
    const result =
      await providerStatusService.syncOrderProviderStatus({
        orderId
      });

    console.log(
      "Provider status sync completed:",
      orderId
    );

    return result;
  } catch (error) {
    console.error("Provider status sync job error", {
      jobId: job.id,
      orderId,
      message: error.message,
      code: error.code || "UNKNOWN_ERROR",
      retryable: error.retryable,
      retryAfterMs: error.retryAfterMs
    });

    // Stop retries for explicitly non-retryable errors.
    if (error.retryable === false) {
      throw new UnrecoverableError(error.message);
    }

    // Let BullMQ handle retryable errors and backoff.
    throw error;
  }
};

// ======================================================
// START WORKER
// ======================================================

const startWorker = async () => {
  try {
    await connectDB("Provider Status Worker");

    const worker = new Worker(
      "provider-status-sync",
      processProviderStatusSync,
      {
        connection: {
          ...redisConnection,
          maxRetriesPerRequest: null
        },

        concurrency: 3,

        settings: {
          backoffStrategy: providerStatusBackoff
        }
      }
    );

    worker.on("ready", () => {
      console.log(
        "Provider Status Worker is ready and connected to Redis..."
      );
    });

    worker.on("completed", (job) => {
      console.log(
        `Provider Status Sync Job Completed: ${job.id}`
      );
    });

    worker.on("failed", (job, error) => {
      console.error(
        `Provider Status Sync Job Failed: ${job?.id}`,
        {
          message: error.message,
          code: error.code || "UNKNOWN_ERROR",
          attemptsMade: job?.attemptsMade
        }
      );
    });

    worker.on("error", (error) => {
      console.error(
        "Provider Status Worker Error:",
        error.message
      );
    });

    console.log("Provider Status Worker started...");
  } catch (error) {
    console.error(
      "Failed to start Provider Status Worker:",
      error
    );

    process.exit(1);
  }
};

// ======================================================
// START ONLY OUTSIDE TEST MODE
// ======================================================

if (process.env.NODE_ENV !== "test") {
  startWorker().catch((error) => {
    console.error(
      "Provider Status Worker startup error:",
      error
    );
  });
} else {
  console.log(
    "Provider Status Worker skipped in test mode."
  );
}

// ======================================================
// EXPORTS FOR TESTING
// ======================================================

module.exports = {
  processProviderStatusSync,
  providerStatusBackoff
};
