const mongoose = require("mongoose");

const Order = require("../models/Order");
const DripFeedRun = require("../models/DripFeedRun");
const Provider = require("../models/Provider");

const {
  createProviderOrder
} = require("./providerApiService");

// ======================================================
// CREATE DRIP FEED RUNS
// ======================================================

const createDripFeedRuns = async (order) => {
  if (!order) {
    throw new Error("Order is required");
  }

  if (!order.dripFeed) {
    throw new Error("Order is not a drip-feed order");
  }

  if (!Number.isInteger(order.runs) || order.runs < 1) {
    throw new Error("Invalid drip-feed runs");
  }

  if (!Number.isInteger(order.interval) || order.interval < 1) {
    throw new Error("Invalid drip-feed interval");
  }

  const existingRuns = await DripFeedRun.find({
    orderId: order._id
  }).sort({ runNumber: 1 });

  if (existingRuns.length > 0) {
    return existingRuns;
  }

  const baseQuantity = Math.floor(
    order.quantity / order.runs
  );

  const remainder =
    order.quantity -
    baseQuantity * order.runs;

  const runs = [];

  for (let i = 1; i <= order.runs; i++) {
    const quantity =
      i === order.runs
        ? baseQuantity + remainder
        : baseQuantity;

    runs.push({
      orderId: order._id,
      userId: order.userId,
      runNumber: i,
      quantity,
      status: "pending",
      scheduledAt: new Date(
        Date.now() +
        (i - 1) * order.interval * 1000
      )
    });
  }

  return DripFeedRun.insertMany(runs);
};

// ======================================================
// PROCESS SINGLE DRIP FEED RUN
// ======================================================

const processDripFeedRun = async (runId) => {
  if (!mongoose.Types.ObjectId.isValid(runId)) {
    throw new Error("Invalid drip-feed run ID");
  }

  const run = await DripFeedRun.findById(runId);

  if (!run) {
    throw new Error("Drip-feed run not found");
  }

  if (run.status !== "pending") {
    return run;
  }

  const order = await Order.findById(run.orderId)
    .populate("serviceId")
    .populate("providerId");

  if (!order) {
    run.status = "failed";
    run.error = "Parent order not found";
    await run.save();

    return run;
  }

  // ----------------------------------------------------
  // STOP IF PARENT ORDER IS NO LONGER ACTIVE
  // ----------------------------------------------------

  if (
    [
      "canceled",
      "refunded",
      "failed"
    ].includes(order.status)
  ) {
    run.status = "canceled";
    run.error =
      "Parent order is no longer active";

    await run.save();

    return run;
  }

  // ----------------------------------------------------
  // PROVIDER VALIDATION
  // ----------------------------------------------------

  if (!order.providerId) {
    run.status = "failed";
    run.error = "Provider not assigned";

    await run.save();

    return run;
  }

  const provider = await Provider.findById(
    order.providerId._id
  ).select("+apiKey");

  if (!provider) {
    run.status = "failed";
    run.error = "Provider not found";

    await run.save();

    return run;
  }

  if (provider.status !== "active") {
    run.status = "failed";
    run.error = "Provider is inactive";

    await run.save();

    return run;
  }

  if (!provider.apiKey || !provider.apiUrl) {
    run.status = "failed";
    run.error =
      "Provider credentials/configuration missing";

    await run.save();

    return run;
  }

  if (!order.serviceId?.providerServiceId) {
    run.status = "failed";
    run.error =
      "Provider service ID is missing";

    await run.save();

    return run;
  }

  // ----------------------------------------------------
  // MARK PROCESSING
  // ----------------------------------------------------

  run.status = "processing";
  run.startedAt = new Date();
  run.error = null;

  await run.save();

  // ----------------------------------------------------
  // CREATE PROVIDER ORDER
  // ----------------------------------------------------

  try {
    const providerResult =
      await createProviderOrder({
        provider,
        orderId: order._id,

        service:
          order.serviceId.providerServiceId,

        link: order.link,

        quantity: run.quantity
      });

    run.status = "completed";
    run.completedAt = new Date();

    run.providerOrderId =
      providerResult.providerOrderId;

    run.providerResponse =
      providerResult.providerResponse;

    run.error = null;

    await run.save();

    return run;

  } catch (error) {
    run.status = "failed";

    run.error =
      error?.message ||
      "Provider order creation failed";

    await run.save();

    return run;
  }
};

// ======================================================
// PROCESS DUE RUNS
// ======================================================

const processDueDripFeedRuns = async () => {
  const dueRuns = await DripFeedRun.find({
    status: "pending",
    scheduledAt: {
      $lte: new Date()
    }
  }).sort({
    scheduledAt: 1
  });

  const results = [];

  for (const run of dueRuns) {
    try {
      const result =
        await processDripFeedRun(
          run._id
        );

      results.push(result);

    } catch (error) {
      results.push({
        runId: run._id,
        status: "failed",
        error: error.message
      });
    }
  }

  return results;
};

// ======================================================
// GET DRIP FEED RUNS
// ======================================================

const getDripFeedRuns = async (orderId) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error("Invalid order ID");
  }

  return DripFeedRun.find({
    orderId
  }).sort({
    runNumber: 1
  });
};

// ======================================================
// CANCEL PENDING RUNS
// ======================================================

const cancelPendingDripFeedRuns = async (
  orderId
) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error("Invalid order ID");
  }

  return DripFeedRun.updateMany(
    {
      orderId,
      status: "pending"
    },
    {
      $set: {
        status: "canceled",
        error: "Canceled by order cancellation"
      }
    }
  );
};

// ======================================================
// PAUSE DRIP FEED
// ======================================================

const pauseDripFeed = async (orderId) => {
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error("Invalid order ID");
  }

  const order =
    await Order.findById(orderId);

  if (!order) {
    throw new Error("Order not found");
  }

  if (!order.dripFeed) {
    throw new Error(
      "Order is not a drip-feed order"
    );
  }

  await DripFeedRun.updateMany(
    {
      orderId,
      status: "pending"
    },
    {
      $set: {
        status: "canceled",
        error: "Drip-feed paused"
      }
    }
  );

  return order;
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createDripFeedRuns,
  processDripFeedRun,
  processDueDripFeedRuns,
  getDripFeedRuns,
  cancelPendingDripFeedRuns,
  pauseDripFeed
};