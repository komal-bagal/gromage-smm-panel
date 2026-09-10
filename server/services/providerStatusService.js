const mongoose = require("mongoose");

const Order = require("../models/Order");
const OrderStatusLog = require("../models/OrderStatusLog");
const Provider = require("../models/Provider");

const {
  fetchProviderOrderStatus
} = require("./providerApiService");

// ======================================================
// MAP PROVIDER STATUS TO LOCAL ORDER STATUS
// ======================================================

const mapProviderStatus = (providerStatus) => {

  const status =
    String(providerStatus || "")
      .trim()
      .toLowerCase();

  const statusMap = {

    pending:
      "pending",

    processing:
      "processing",

    "in progress":
      "in_progress",

    in_progress:
      "in_progress",

    completed:
      "completed",

    complete:
      "completed",

    partial:
      "partial",

    canceled:
      "canceled",

    cancelled:
      "canceled",

    cancel:
      "canceled",

    refunded:
      "refunded",

    failed:
      "failed"
  };

  return (
    statusMap[status] ||
    null
  );
};

// ======================================================
// TERMINAL ORDER STATUS
// ======================================================

const TERMINAL_STATUSES = new Set([
  "completed",
  "partial",
  "canceled",
  "refunded",
  "failed"
]);

// ======================================================
// SAFE NUMBER HELPER
// ======================================================

const getSafeNumber = (
  value,
  fallback = 0
) => {

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

// ======================================================
// CHECK VALID OBJECT ID
// ======================================================

const isValidObjectId = (
  id
) => {

  return mongoose.Types.ObjectId.isValid(
    id
  );
};

// ======================================================
// SYNC SINGLE ORDER STATUS
// ======================================================

const syncOrderProviderStatus = async ({
  orderId
}) => {

  // ----------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------

  if (!orderId) {

    throw new Error(
      "Order ID is required"
    );
  }

  if (!isValidObjectId(orderId)) {

    throw new Error(
      "Invalid Order ID"
    );
  }

  // ----------------------------------------------------
  // FIND ORDER
  // ----------------------------------------------------

  const order =
    await Order.findById(
      orderId
    );

  if (!order) {

    throw new Error(
      "Order not found"
    );
  }

  // ----------------------------------------------------
  // PROVIDER VALIDATION
  // ----------------------------------------------------

  if (!order.providerId) {

    throw new Error(
      "Order does not have a provider"
    );
  }

  if (!order.providerOrderId) {

    throw new Error(
      "Provider order ID is missing"
    );
  }

  // ----------------------------------------------------
  // FIND PROVIDER
  // ----------------------------------------------------

  const provider =
    await Provider.findById(
      order.providerId
    ).select(
      "+apiKey"
    );

  if (!provider) {

    throw new Error(
      "Provider not found"
    );
  }

  // ----------------------------------------------------
  // PROVIDER STATUS VALIDATION
  // ----------------------------------------------------

  if (
    String(provider.status || "")
      .toLowerCase() !==
    "active"
  ) {

    throw new Error(
      "Provider is inactive"
    );
  }

  // ----------------------------------------------------
  // PROVIDER API KEY VALIDATION
  // ----------------------------------------------------

  if (!provider.apiKey) {

    throw new Error(
      "Provider API key is missing"
    );
  }

  // ----------------------------------------------------
  // LOG SYNC REQUEST
  // ----------------------------------------------------

  console.log(
    "===================================="
  );

  console.log(
    "SYNCING ORDER PROVIDER STATUS"
  );

  console.log(
    "LOCAL ORDER ID:",
    order._id.toString()
  );

  console.log(
    "PROVIDER:",
    provider.name
  );

  console.log(
    "PROVIDER ORDER ID:",
    order.providerOrderId
  );

  console.log(
    "CURRENT LOCAL STATUS:",
    order.status
  );

  console.log(
    "===================================="
  );

  // ----------------------------------------------------
  // FETCH PROVIDER STATUS
  // ----------------------------------------------------

  let providerResult;

  try {

    providerResult =
      await fetchProviderOrderStatus({

        provider,

        providerOrderId:
          order.providerOrderId,

        orderId:
          order._id

      });

  } catch (error) {

    console.error(
      "Provider status fetch failed:",
      error.message
    );

    throw new Error(
      `Unable to fetch provider order status: ${error.message}`
    );
  }

  // ----------------------------------------------------
  // VALIDATE PROVIDER RESPONSE
  // ----------------------------------------------------

  if (
    !providerResult ||
    typeof providerResult !==
      "object"
  ) {

    throw new Error(
      "Invalid response received from provider"
    );
  }

  // ----------------------------------------------------
  // PROVIDER STATUS
  // ----------------------------------------------------

  const providerStatus =
    String(
      providerResult.status || ""
    )
      .trim()
      .toLowerCase();

  if (!providerStatus) {

    throw new Error(
      "Provider response does not contain order status"
    );
  }

  // ----------------------------------------------------
  // MAP PROVIDER STATUS
  // ----------------------------------------------------

  const mappedStatus =
    mapProviderStatus(
      providerStatus
    );

  if (!mappedStatus) {

    throw new Error(
      `Unsupported provider status: ${providerStatus}`
    );
  }

  // ----------------------------------------------------
  // OLD VALUES
  // ----------------------------------------------------

  const previousStatus =
    String(
      order.status || ""
    );

  const previousStartCount =
    getSafeNumber(
      order.startCount,
      0
    );

  const previousRemains =
    getSafeNumber(
      order.remains,
      0
    );

  // ----------------------------------------------------
  // TERMINAL STATUS PROTECTION
  // ----------------------------------------------------
  //
  // If our local order is already in a terminal state,
  // do not allow a provider response to move it back
  // to pending / processing / in_progress.
  //
  // Example:
  //
  // completed -> processing ❌
  // completed -> pending    ❌
  //
  // This protects the local order lifecycle from an
  // unexpected/outdated provider response.
  //
  // ----------------------------------------------------

  let finalStatus =
    mappedStatus;

  if (
    TERMINAL_STATUSES.has(
      previousStatus
    ) &&
    !TERMINAL_STATUSES.has(
      mappedStatus
    )
  ) {

    console.warn(
      `Ignoring provider status regression: ${previousStatus} -> ${mappedStatus}`
    );

    finalStatus =
      previousStatus;
  }

  // ----------------------------------------------------
  // START COUNT
  // ----------------------------------------------------

  const providerStartCount =
    Number(
      providerResult.startCount
    );

  if (
    Number.isFinite(
      providerStartCount
    ) &&
    providerStartCount >= 0
  ) {

    order.startCount =
      providerStartCount;

  } else {

    order.startCount =
      previousStartCount;
  }

  // ----------------------------------------------------
  // REMAINS
  // ----------------------------------------------------

  const providerRemains =
    Number(
      providerResult.remains
    );

  if (
    Number.isFinite(
      providerRemains
    ) &&
    providerRemains >= 0
  ) {

    order.remains =
      providerRemains;

  } else {

    order.remains =
      previousRemains;
  }

  // ----------------------------------------------------
  // PROVIDER RESPONSE
  // ----------------------------------------------------

  if (
    providerResult.providerResponse !==
    undefined
  ) {

    order.providerResponse =
      providerResult.providerResponse;
  }

  // ----------------------------------------------------
  // STATUS CHANGED
  // ----------------------------------------------------

  const statusChanged =
    previousStatus !==
    finalStatus;

  // ----------------------------------------------------
  // UPDATE STATUS
  // ----------------------------------------------------

  if (statusChanged) {

    order.status =
      finalStatus;
  }

  // ----------------------------------------------------
  // SAVE ORDER
  // ----------------------------------------------------

  await order.save();

  // ----------------------------------------------------
  // CREATE STATUS LOG
  // ----------------------------------------------------

  if (statusChanged) {

    try {

      await OrderStatusLog.create({

        orderId:
          order._id,

        previousStatus:
          previousStatus,

        newStatus:
          finalStatus,

        source:
          "provider",

        message:
          `Provider status synchronized: ${providerStatus}`,

        providerResponse:
          providerResult.providerResponse

      });

    } catch (logError) {

      // ------------------------------------------------
      // IMPORTANT:
      // Order has already been updated successfully.
      //
      // Do not fail the complete sync operation only
      // because status logging failed.
      // ------------------------------------------------

      console.error(
        "Failed to create OrderStatusLog:",
        logError.message
      );
    }
  }

  // ----------------------------------------------------
  // SUCCESS LOG
  // ----------------------------------------------------

  console.log(
    "===================================="
  );

  console.log(
    "ORDER PROVIDER STATUS SYNC SUCCESS"
  );

  console.log(
    "ORDER ID:",
    order._id.toString()
  );

  console.log(
    "PROVIDER STATUS:",
    providerStatus
  );

  console.log(
    "LOCAL STATUS:",
    order.status
  );

  console.log(
    "START COUNT:",
    order.startCount
  );

  console.log(
    "REMAINS:",
    order.remains
  );

  console.log(
    "STATUS CHANGED:",
    statusChanged
  );

  console.log(
    "===================================="
  );

  // ----------------------------------------------------
  // RESULT
  // ----------------------------------------------------

  return {

    orderId:
      order._id,

    providerOrderId:
      order.providerOrderId,

    previousStatus,

    providerStatus,

    status:
      order.status,

    startCount:
      order.startCount,

    remains:
      order.remains,

    statusChanged,

    providerResponse:
      providerResult.providerResponse
  };
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {

  syncOrderProviderStatus,

  mapProviderStatus

};