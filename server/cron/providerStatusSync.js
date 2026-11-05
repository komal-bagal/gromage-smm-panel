
require("dotenv").config();

const cron = require("node-cron");

const Order = require("../models/Order");
const providerStatusQueue = require("../queues/providerStatusQueue");

// ======================================================
// CONFIGURATION
// ======================================================

const CRON_SCHEDULE = "*/5 * * * *";

const ACTIVE_JOB_STATES = new Set([
  "waiting",
  "active",
  "delayed",
  "waiting-children",
  "prioritized"
]);

const TERMINAL_JOB_STATES = new Set([
  "completed",
  "failed"
]);

// ======================================================
// PROVIDER STATUS SYNC
// ======================================================

const queueProviderStatusSync = async () => {
  try {
    const orders = await Order.find({
      providerId: { $ne: null },
      providerOrderId: { $ne: null },
      status: {
        $in: [
          "pending",
          "processing",
          "in_progress"
        ]
      }
    })
      .select("_id")
      .lean();

    if (!orders.length) {
      console.log(
        "Provider Status Sync: No active provider orders found."
      );
      return;
    }

    let queuedCount = 0;
    let skippedCount = 0;
    let failedJobCount = 0;
    let errorCount = 0;

    for (const order of orders) {
      const orderId = order._id.toString();
      const jobId = `provider-status-${orderId}`;

      try {
        const existingJob =
          await providerStatusQueue.getJob(jobId);

        if (existingJob) {
          const state = await existingJob.getState();

          // --------------------------------------------------
          // 1. Skip jobs that are already pending or running.
          // --------------------------------------------------

          if (ACTIVE_JOB_STATES.has(state)) {
            skippedCount++;
            continue;
          }

          // --------------------------------------------------
          // 2. Preserve failed jobs for diagnosis.
          // Do not automatically retry failed jobs.
          // --------------------------------------------------

          if (state === "failed") {
            failedJobCount++;

            console.warn(
              "Provider Status Sync: Existing failed job found.",
              {
                jobId,
                orderId,
                attemptsMade: existingJob.attemptsMade,
                failedReason: existingJob.failedReason
              }
            );

            continue;
          }

          // --------------------------------------------------
          // 3. Skip completed jobs if they still exist.
          // --------------------------------------------------

          if (state === "completed") {
            skippedCount++;
            continue;
          }

          // --------------------------------------------------
          // 4. Skip unexpected terminal states safely.
          // --------------------------------------------------

          if (TERMINAL_JOB_STATES.has(state)) {
            skippedCount++;
            continue;
          }
        }

        // ----------------------------------------------------
        // 5. Queue a new provider status-sync job.
        // BullMQ Worker applies the configured custom backoff.
        // ----------------------------------------------------

        await providerStatusQueue.add(
          "sync-provider-status",
          { orderId },
          {
            jobId,
            attempts: 3,
            backoff: {
              type: "custom",
              delay: 5000
            },
            removeOnComplete: true,
            removeOnFail: false
          }
        );

        queuedCount++;
      } catch (error) {
        errorCount++;

        console.error(
          "Provider Status Sync: Failed to process order.",
          {
            jobId,
            orderId,
            message: error.message
          }
        );
      }
    }

    // ------------------------------------------------------
    // 6. Summary
    // ------------------------------------------------------

    console.log(
      [
        "Provider Status Sync Summary:",
        `found=${orders.length}`,
        `queued=${queuedCount}`,
        `skipped=${skippedCount}`,
        `failedJobs=${failedJobCount}`,
        `errors=${errorCount}`
      ].join(" ")
    );
  } catch (error) {
    console.error(
      "Provider Status Sync Scheduler Error:",
      error.message
    );
  }
};

// ======================================================
// RUN EVERY 5 MINUTES — ONLY ONCE
// ======================================================

if (!global.providerStatusSyncCronStarted) {
  global.providerStatusSyncCronStarted = true;

  cron.schedule(
    CRON_SCHEDULE,
    queueProviderStatusSync
  );

  console.log(
    "Provider Status Sync cron job started. Runs every 5 minutes."
  );
} else {
  console.log(
    "Provider Status Sync cron job already started. Skipping duplicate initialization."
  );
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  queueProviderStatusSync
};
