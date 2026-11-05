require("dotenv").config();

const mongoose = require("mongoose");
const { Worker, UnrecoverableError } = require("bullmq");

const redisConnection = require("../config/redis");

const Order = require("../models/Order");
const DripFeedRun = require("../models/DripFeedRun");
const Service = require("../models/Service");
const Provider = require("../models/Provider");

const {
  createProviderOrder
} = require("../services/providerApiService");

// ======================================================
// MONGODB CONNECTION
// ======================================================

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/mini-smm-panel";

// ======================================================
// CONNECT DATABASE
// ======================================================

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(MONGO_URI);

  console.log("Worker MongoDB Connected");
}

// ======================================================
// FIND ACTIVE PROVIDERS
// ======================================================
//
// Lower priority number = higher priority.
//
// Example:
// priority 1 -> first
// priority 2 -> fallback
//
// ======================================================

async function findProviderCandidates() {
  return Provider.find({
    status: "active"
  })
    .select("+apiKey")
    .sort({
      priority: 1,
      sortOrder: 1,
      createdAt: 1
    });
}

// ======================================================
// SAVE WITH RETRY
// ======================================================
//
// Used ONLY after a provider has accepted an order.
// The provider order ID must never be lost, and we must
// never create a second provider order because a DB save
// failed.
//
// ======================================================

async function saveWithRetry(
  document,
  label,
  attempts = 3,
  delayMs = 500
) {
  let lastError = null;

  for (let i = 1; i <= attempts; i++) {
    try {
      await document.save();
      return true;
    } catch (error) {
      lastError = error;

      console.error(
        `${label} save failed (${i}/${attempts}):`,
        error.message
      );

      if (i < attempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs)
        );
      }
    }
  }

  console.error(
    `${label} could not be saved:`,
    lastError?.message
  );

  return false;
}

// ======================================================
// PROCESS DRIP FEED RUN
// ======================================================

async function processDripFeedRun(job) {
  const {
    orderId,
    runId,
    userId,
    runNumber,
    quantity
  } = job.data;

  console.log("----------------------------------------");
  console.log("Processing Drip Feed Run");
  console.log("Job ID:", job.id);
  console.log("Order ID:", orderId);
  console.log("Run ID:", runId);
  console.log("Run Number:", runNumber);
  console.log("Quantity:", quantity);
  console.log("----------------------------------------");

  // ====================================================
  // FIND RUN
  // ====================================================

  const run = await DripFeedRun.findById(runId);

  if (!run) {
    console.log(
      "Drip Feed Run not found. Skipping job."
    );

    return {
      success: false,
      skipped: true,
      reason: "RUN_NOT_FOUND"
    };
  }

  // ====================================================
  // SKIP ALREADY COMPLETED / CANCELLED
  // ====================================================

  if (
    run.status === "completed" ||
    run.status === "canceled"
  ) {
    console.log(
      `Run ${run.runNumber} already ${run.status}. Skipping.`
    );

    return {
      success: true,
      skipped: true,
      reason: `RUN_${run.status.toUpperCase()}`
    };
  }

  // ====================================================
  // IDEMPOTENCY: PROVIDER ORDER ALREADY CREATED
  // ====================================================
  //
  // If this run already has a provider order ID, a previous
  // attempt reached the provider. Never create another one.
  //
  // ====================================================

  if (run.providerOrderId) {
    console.log(
      `Run ${run.runNumber} already has provider order ${run.providerOrderId}. Skipping.`
    );

    // Repair parent order if a previous attempt crashed
    // before the parent order was saved.
    try {
      await Order.updateOne(
        {
          _id: orderId,
          status: "pending"
        },
        {
          $set: { status: "processing" }
        }
      );
    } catch (repairError) {
      console.error(
        "Parent order repair failed:",
        repairError.message
      );
    }

    return {
      success: true,
      skipped: true,
      reason: "PROVIDER_ORDER_ALREADY_CREATED",
      runId: run._id,
      providerOrderId: run.providerOrderId
    };
  }

  // ====================================================
  // FIND PARENT ORDER
  // ====================================================

  const order = await Order.findById(orderId);

  if (!order) {
    run.status = "failed";
    run.error = "Parent order not found";

    await run.save();

    throw new Error(
      "Parent order not found"
    );
  }

  // ====================================================
  // VERIFY USER
  // ====================================================

  if (
    userId &&
    String(order.userId) !== String(userId)
  ) {
    run.status = "failed";
    run.error = "Order user mismatch";

    await run.save();

    throw new Error(
      "Order user mismatch"
    );
  }

  // ====================================================
  // FIND SERVICE
  // ====================================================

  const service = await Service.findById(
    order.serviceId
  );

  if (!service) {
    run.status = "failed";
    run.error = "Service not found";

    await run.save();

    throw new Error(
      "Service not found"
    );
  }

  // ====================================================
  // VERIFY RUN QUANTITY
  // ====================================================

  const runQuantity =
    Number(quantity) ||
    Number(run.quantity);

  if (
    !Number.isFinite(runQuantity) ||
    runQuantity <= 0
  ) {
    run.status = "failed";
    run.error = "Invalid run quantity";

    await run.save();

    throw new Error(
      "Invalid run quantity"
    );
  }

  // ====================================================
  // MARK RUN AS PROCESSING
  // ====================================================

  run.status = "processing";
  run.startedAt = new Date();
  run.error = null;

  await run.save();

  // ====================================================
  // FIND PROVIDERS
  // ====================================================

  let providers;

  // ----------------------------------------------------
  // If parent order already has a provider,
  // try that provider first.
  // ----------------------------------------------------

  if (order.providerId) {
    const assignedProvider =
      await Provider.findById(
        order.providerId
      ).select("+apiKey");

    if (
      assignedProvider &&
      assignedProvider.status === "active"
    ) {
      providers = [
        assignedProvider
      ];

      // ------------------------------------------------
      // Add other active providers as fallback.
      // ------------------------------------------------

      const fallbackProviders =
        await findProviderCandidates();

      for (
        const provider of fallbackProviders
      ) {
        if (
          String(provider._id) !==
          String(assignedProvider._id)
        ) {
          providers.push(provider);
        }
      }
    } else {
      providers =
        await findProviderCandidates();
    }
  } else {
    providers =
      await findProviderCandidates();
  }

  // ====================================================
  // CHECK PROVIDERS
  // ====================================================

  if (
    !providers ||
    providers.length === 0
  ) {
    run.status = "failed";
    run.error =
      "No active provider available";

    await run.save();

    throw new Error(
      "No active provider available"
    );
  }

  // ====================================================
  // PROVIDER SERVICE ID
  // ====================================================

  const providerServiceId =
    service.providerServiceId ||
    service.providerServiceID;

  if (!providerServiceId) {
    run.status = "failed";
    run.error =
      "Provider service ID is missing";

    await run.save();

    throw new Error(
      "Provider service ID is missing"
    );
  }

  // ====================================================
  // TRY PROVIDERS
  // ====================================================
  //
  // This loop ONLY talks to providers. No database saves
  // happen inside it, so a DB failure can never trigger
  // fallback to another provider.
  //
  // Fallback happens ONLY when the provider definitely
  // rejected the request. If the outcome is uncertain
  // (timeout, network loss, 5xx), we stop, because the
  // provider may already have created the order.
  //
  // ====================================================

  let lastProviderError = null;
  let result = null;
  let selectedProvider = null;

  for (
    const provider of providers
  ) {
    try {
      console.log(
        `Trying provider: ${provider.name}`
      );

      // ------------------------------------------------
      // CREATE PROVIDER ORDER
      // ------------------------------------------------

      const providerResult =
        await createProviderOrder({
          provider,

          // Use parent order ID for provider logs.
          orderId: order._id,

          service:
            providerServiceId,

          link:
            order.link,

          quantity:
            runQuantity
        });

      // ------------------------------------------------
      // VALIDATE PROVIDER RESPONSE
      // ------------------------------------------------

      if (
        !providerResult ||
        !providerResult.providerOrderId
      ) {
        const missingIdError = new Error(
          "Provider order ID was not returned"
        );

        // Provider answered but gave no ID: it may
        // still have created the order.
        missingIdError.outcomeUncertain = true;

        throw missingIdError;
      }

      result = providerResult;
      selectedProvider = provider;

      break;
    } catch (error) {
      lastProviderError =
        error;

      console.error(
        `Provider ${provider.name} failed:`,
        error.message
      );

      console.error(
        "Provider Error Stack:",
        error.stack
      );

      if (error.outcomeUncertain) {
        console.error(
          "Provider outcome uncertain. Stopping fallback to avoid duplicate orders."
        );

        break;
      }

      // ------------------------------------------------
      // Definite rejection: safe to try next provider
      // ------------------------------------------------
    }
  }

  // ====================================================
  // PROVIDER ACCEPTED THE ORDER: SAVE RESULT
  // ====================================================

  if (selectedProvider && result) {
    // ------------------------------------------------
    // SAVE PROVIDER DETAILS ON RUN
    // ------------------------------------------------

    run.providerOrderId =
      result.providerOrderId;

    run.providerResponse =
      result.providerResponse || null;

    run.status =
      "processing";

    run.error = null;

    const runSaved = await saveWithRetry(
      run,
      "Drip Feed run"
    );

    if (!runSaved) {
      console.error(
        "CRITICAL: provider accepted order but run could not be saved",
        {
          runId: String(run._id),
          orderId: String(order._id),
          providerId: String(selectedProvider._id),
          providerOrderId: result.providerOrderId
        }
      );

      // UnrecoverableError stops BullMQ retries, so no
      // duplicate provider order can be created.
      throw new UnrecoverableError(
        "Provider order created but run could not be saved. Manual review required."
      );
    }

    // ------------------------------------------------
    // SAVE PROVIDER ON PARENT ORDER
    // ------------------------------------------------
    //
    // The run is already saved. If this fails, the
    // idempotency check repairs the parent status on retry.
    //
    // ------------------------------------------------

    try {
      if (!order.providerId) {
        order.providerId =
          selectedProvider._id;
      }

      if (
        order.status === "pending"
      ) {
        order.status =
          "processing";
      }

      await order.save();
    } catch (orderSaveError) {
      console.error(
        "Parent order save failed (run already saved):",
        orderSaveError.message
      );
    }

    // ------------------------------------------------
    // SUCCESS LOGS
    // ------------------------------------------------

    console.log(
      "Drip Feed provider order created successfully"
    );

    console.log(
      "Provider:",
      selectedProvider.name
    );

    console.log(
      "Provider Order ID:",
      result.providerOrderId
    );

    return {
      success: true,

      runId:
        run._id,

      runNumber:
        run.runNumber,

      providerId:
        selectedProvider._id,

      providerOrderId:
        result.providerOrderId
    };
  }

  // ====================================================
  // PROVIDER OUTCOME UNCERTAIN
  // ====================================================
  //
  // Do NOT let BullMQ retry: the provider may already
  // have created this order.
  //
  // ====================================================

  if (lastProviderError?.outcomeUncertain) {
    run.status = "failed";

    run.error =
      `Provider outcome uncertain - manual review required: ${lastProviderError.message}`;

    const uncertainSaved = await saveWithRetry(
      run,
      "Drip Feed run (uncertain outcome)"
    );

    console.error(
      "Provider outcome uncertain for Drip Feed Run:",
      {
        runId: String(run._id),
        orderId: String(order._id),
        savedToDatabase: uncertainSaved,
        reason: lastProviderError.message
      }
    );

    // Always UnrecoverableError, even if the save above failed:
    // retrying could create a duplicate provider order.
    throw new UnrecoverableError(
      run.error
    );
  }

  // ====================================================
  // ALL PROVIDERS FAILED (DEFINITE REJECTIONS)
  // ====================================================

  run.status = "failed";

  run.error =
    lastProviderError?.message ||
    "All providers failed";

  await run.save();

  console.error(
    "All providers failed for Drip Feed Run:",
    run._id
  );

  throw (
    lastProviderError ||
    new Error(
      "All providers failed"
    )
  );
}

// ======================================================
// CREATE WORKER
// ======================================================

async function startWorker() {
  await connectDatabase();

  const worker =
    new Worker(
      "drip-feed",

      async (job) => {
        return processDripFeedRun(job);
      },

      {
        connection: {
          ...redisConnection,

          // Required for BullMQ workers
          // when using ioredis.
          maxRetriesPerRequest: null
        },

        concurrency: 1
      }
    );

  // ====================================================
  // READY
  // ====================================================

  worker.on(
    "ready",
    () => {
      console.log(
        "Drip Feed Worker is ready and connected to Redis..."
      );
    }
  );

  // ====================================================
  // COMPLETED
  // ====================================================

  worker.on(
    "completed",
    (job, result) => {
      console.log(
        "========================================"
      );

      console.log(
        "Drip Feed job completed:",
        job.id
      );

      console.log(
        "Result:",
        result
      );

      console.log(
        "========================================"
      );
    }
  );

  // ====================================================
  // FAILED
  // ====================================================

  worker.on(
    "failed",
    (job, error) => {
      console.error(
        "========================================"
      );

      console.error(
        "Drip Feed job failed:",
        job
          ? job.id
          : "unknown"
      );

      console.error(
        "Error:",
        error.message
      );

      console.error(
        "Stack:",
        error.stack
      );

      console.error(
        "========================================"
      );
    }
  );

  // ====================================================
  // ERROR
  // ====================================================

  worker.on(
    "error",
    (error) => {
      console.error(
        "Drip Feed Worker Error:",
        error.message
      );
    }
  );

  // ====================================================
  // STARTED
  // ====================================================

  console.log(
    "Drip Feed Worker started..."
  );

  return worker;
}

// ======================================================
// START
// ======================================================

if (process.env.NODE_ENV !== "test") {
  startWorker().catch((error) => {
    console.error(
      "Failed to start Drip Feed Worker:",
      error
    );

    process.exit(1);
  });
} else {
  console.log(
    "Drip Feed Worker skipped in test mode."
  );
}
module.exports = { processDripFeedRun, saveWithRetry };
