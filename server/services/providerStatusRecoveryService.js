
const mongoose = require("mongoose");
const Order = require("../models/Order");
const providerStatusQueue = require("../queues/providerStatusQueue");

const ACTIVE_ORDER_STATUSES = [
  "pending",
  "processing",
  "in_progress",
];

const retryFailedProviderStatusJob = async (
  orderId,
  { queue = providerStatusQueue } = {}
) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error("Invalid order ID");
  }

  const order = await Order.findOne({
    _id: orderId,
    providerId: { $ne: null },
    providerOrderId: { $ne: null },
    status: { $in: ACTIVE_ORDER_STATUSES },
  })
    .select("_id")
    .lean();

  if (!order) {
    throw new Error(
      "Order not found or is not eligible for provider status recovery"
    );
  }

  const jobId = `provider-status-${orderId}`;
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new Error("Provider status job not found");
  }

  const state = await job.getState();

  if (state !== "failed") {
    throw new Error(
      `Cannot recover job: expected failed state, got ${state}`
    );
  }

  console.warn("Manually retrying failed provider status job", {
    jobId,
    orderId,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
  });

  await job.retry("failed");

  return {
    success: true,
    jobId,
    orderId,
    message: "Failed provider status job queued for retry",
  };
};

module.exports = {
  retryFailedProviderStatusJob,
};
