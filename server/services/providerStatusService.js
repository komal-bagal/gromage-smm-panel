
const mongoose = require("mongoose");

const Order = require("../models/Order");
const OrderStatusLog = require("../models/OrderStatusLog");
const Provider = require("../models/Provider");

const {
  fetchProviderOrderStatus
} = require("./providerApiService");

// ======================================================
// STATUS MAPPING
// ======================================================

const mapProviderStatus = (providerStatus) => {
  if (
    typeof providerStatus !== "string" ||
    !providerStatus.trim()
  ) {
    return null;
  }

  const status = providerStatus.trim().toLowerCase();

  const statusMap = {
    pending: "pending",
    processing: "processing",
    "in progress": "in_progress",
    in_progress: "in_progress",
    completed: "completed",
    complete: "completed",
    partial: "partial",
    canceled: "canceled",
    cancelled: "canceled",
    cancel: "canceled",
    refunded: "refunded",
    failed: "failed"
  };

  return statusMap[status] || null;
};

// ======================================================
// TERMINAL STATUSES
// ======================================================

const TERMINAL_STATUSES = new Set([
  "completed",
  "partial",
  "canceled",
  "refunded",
  "failed"
]);

// ======================================================
// SAFE NON-NEGATIVE NUMBER
// ======================================================

const getSafeNumber = (value, fallback = 0) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
    : fallback;
};

// ======================================================
// OBJECT ID VALIDATION
// ======================================================

const isValidObjectId = (id) => {
  if (!id) {
    return false;
  }

  return mongoose.Types.ObjectId.isValid(String(id));
};

// ======================================================
// CREATE WRAPPED PROVIDER ERROR
// ======================================================

const createStatusSyncError = (error) => {
  const wrappedError = new Error(
    `Unable to fetch provider order status: ${
      error?.message || "Unknown provider error"
    }`
  );

  wrappedError.code =
    error?.code || "PROVIDER_STATUS_SYNC_ERROR";

  wrappedError.retryable =
    typeof error?.retryable === "boolean"
      ? error.retryable
      : false;

  // Preserve Retry-After only when a real value is present.
  // null and empty strings must not become zero milliseconds.
  if (
    error?.retryAfterMs !== undefined &&
    error.retryAfterMs !== null &&
    error.retryAfterMs !== ""
  ) {
    const retryAfterMs = Number(error.retryAfterMs);

    if (
      Number.isFinite(retryAfterMs) &&
      retryAfterMs >= 0
    ) {
      wrappedError.retryAfterMs = retryAfterMs;
    }
  }

  return wrappedError;
};

// ======================================================
// CREATE NON-RETRYABLE ERROR
// ======================================================

const createNonRetryableError = (message, code) => {
  const error = new Error(message);

  error.code = code;
  error.retryable = false;

  return error;
};

// ======================================================
// SYNC SINGLE ORDER STATUS
// ======================================================

const syncOrderProviderStatus = async ({ orderId } = {}) => {
  // ----------------------------------------------------
  // 1. VALIDATE ORDER ID
  // ----------------------------------------------------

  if (!orderId) {
    throw createNonRetryableError(
      "Order ID is required",
      "ORDER_ID_REQUIRED"
    );
  }

  if (!isValidObjectId(orderId)) {
    throw createNonRetryableError(
      "Invalid Order ID",
      "INVALID_ORDER_ID"
    );
  }

  // ----------------------------------------------------
  // 2. FIND ORDER
  // ----------------------------------------------------

  const order = await Order.findById(orderId);

  if (!order) {
    throw createNonRetryableError(
      "Order not found",
      "ORDER_NOT_FOUND"
    );
  }

  if (!order.providerId) {
    throw createNonRetryableError(
      "Order does not have a provider",
      "ORDER_PROVIDER_MISSING"
    );
  }

  if (!order.providerOrderId) {
    throw createNonRetryableError(
      "Provider order ID is missing",
      "PROVIDER_ORDER_ID_MISSING"
    );
  }

  // ----------------------------------------------------
  // 3. FIND PROVIDER
  // ----------------------------------------------------

  const provider = await Provider.findById(order.providerId)
    .select("+apiKey");

  if (!provider) {
    throw createNonRetryableError(
      "Provider not found",
      "PROVIDER_NOT_FOUND"
    );
  }

  if (
    String(provider.status || "").toLowerCase() !== "active"
  ) {
    throw createNonRetryableError(
      "Provider is inactive",
      "PROVIDER_INACTIVE"
    );
  }

  if (
    typeof provider.apiKey !== "string" ||
    !provider.apiKey.trim()
  ) {
    throw createNonRetryableError(
      "Provider API key is missing",
      "PROVIDER_API_KEY_MISSING"
    );
  }

  // ----------------------------------------------------
  // 4. LOG SYNC REQUEST
  // ----------------------------------------------------

  console.log("Provider status sync started", {
    orderId: order._id.toString(),
    providerOrderId: order.providerOrderId,
    currentStatus: order.status
  });

  // ----------------------------------------------------
  // 5. FETCH PROVIDER STATUS
  // ----------------------------------------------------

  let providerResult;

  try {
    providerResult = await fetchProviderOrderStatus({
      provider,
      providerOrderId: order.providerOrderId,
      orderId: order._id
    });
  } catch (error) {
    console.error("Provider status fetch failed", {
      orderId: order._id.toString(),
      message: error.message,
      code: error.code || "PROVIDER_STATUS_SYNC_ERROR",
      retryable: error.retryable,
      retryAfterMs: error.retryAfterMs
    });

    // Preserve retry classification and Retry-After.
    throw createStatusSyncError(error);
  }

  // ----------------------------------------------------
  // 6. VALIDATE PROVIDER RESPONSE
  // ----------------------------------------------------

  if (
    !providerResult ||
    typeof providerResult !== "object" ||
    Array.isArray(providerResult)
  ) {
    throw createNonRetryableError(
      "Invalid response received from provider",
      "INVALID_PROVIDER_RESPONSE"
    );
  }

  if (
    typeof providerResult.status !== "string" ||
    !providerResult.status.trim()
  ) {
    throw createNonRetryableError(
      "Provider response does not contain order status",
      "PROVIDER_STATUS_MISSING"
    );
  }

  const providerStatus = providerResult.status
    .trim()
    .toLowerCase();

  const mappedStatus = mapProviderStatus(providerStatus);

  if (!mappedStatus) {
    throw createNonRetryableError(
      `Unsupported provider status: ${providerStatus}`,
      "UNSUPPORTED_PROVIDER_STATUS"
    );
  }

  // ----------------------------------------------------
  // 7. CAPTURE PREVIOUS VALUES
  // ----------------------------------------------------

  const previousStatus = String(order.status || "");

  const previousStartCount = getSafeNumber(
    order.startCount,
    0
  );

  const previousRemains = getSafeNumber(
    order.remains,
    0
  );

  // ----------------------------------------------------
  // 8. PREVENT TERMINAL STATUS REGRESSION
  // ----------------------------------------------------

  let finalStatus = mappedStatus;

  if (
    TERMINAL_STATUSES.has(previousStatus) &&
    !TERMINAL_STATUSES.has(mappedStatus)
  ) {
    console.warn("Ignoring provider status regression", {
      orderId: order._id.toString(),
      previousStatus,
      providerStatus: mappedStatus
    });

    finalStatus = previousStatus;
  }

  // ----------------------------------------------------
  // 9. UPDATE COUNTS SAFELY
  // ----------------------------------------------------

  const providerStartCount = getSafeNumber(
    providerResult.startCount,
    previousStartCount
  );

  const providerRemains = getSafeNumber(
    providerResult.remains,
    previousRemains
  );

  if (
    !TERMINAL_STATUSES.has(previousStatus) ||
    TERMINAL_STATUSES.has(mappedStatus)
  ) {
    order.startCount = providerStartCount;
    order.remains = providerRemains;
  }

  // ----------------------------------------------------
  // 10. UPDATE PROVIDER RESPONSE
  // ----------------------------------------------------

  if (providerResult.providerResponse !== undefined) {
    order.providerResponse = providerResult.providerResponse;
  }

  // ----------------------------------------------------
  // 11. DETERMINE STATUS CHANGE
  // ----------------------------------------------------

  const statusChanged = previousStatus !== finalStatus;

  if (statusChanged) {
    order.status = finalStatus;
  }

  // ----------------------------------------------------
  // 12. SAVE ORDER
  // ----------------------------------------------------

  await order.save();

  // ----------------------------------------------------
  // 13. CREATE AUDIT LOG FOR STATUS CHANGES
  // ----------------------------------------------------

  if (statusChanged) {
    try {
      await OrderStatusLog.create({
        orderId: order._id,
        previousStatus,
        newStatus: finalStatus,
        source: "provider",
        message: `Provider status synchronized: ${providerStatus}`,
        providerResponse: providerResult.providerResponse
      });
    } catch (logError) {
      // Logging failure should not turn a successful
      // order update into a failed status-sync job.
      console.error("Failed to create OrderStatusLog", {
        orderId: order._id.toString(),
        previousStatus,
        newStatus: finalStatus,
        message: logError.message
      });
    }
  }

  // ----------------------------------------------------
  // 14. RETURN RESULT
  // ----------------------------------------------------

  const result = {
    orderId: order._id,
    providerOrderId: order.providerOrderId,
    previousStatus,
    providerStatus,
    status: order.status,
    startCount: order.startCount,
    remains: order.remains,
    statusChanged,
    providerResponse: providerResult.providerResponse
  };

  console.log("Provider status sync finished", {
    orderId: order._id.toString(),
    previousStatus,
    status: order.status,
    statusChanged
  });

  return result;
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  syncOrderProviderStatus,
  mapProviderStatus,
  createStatusSyncError
};
