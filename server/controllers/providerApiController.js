// ======================================================
// PROVIDER API CONTROLLER
// ======================================================

const mongoose = require("mongoose");

const Order = require("../models/Order");
const Provider = require("../models/Provider");
const Service = require("../models/Service");
const OrderStatusLog = require("../models/OrderStatusLog");

const {
  fetchProviderOrderStatus,
  cancelProviderOrder,
  refillProviderOrder
} = require("../services/providerApiService");

// ======================================================
// NORMALIZE PROVIDER STATUS
// ======================================================

const normalizeProviderStatus = (status) => {
  const value =
    String(status || "")
      .trim()
      .toLowerCase();

  const statusMap = {
    pending: "pending",
    processing: "processing",
    in_progress: "in_progress",
    "in progress": "in_progress",
    completed: "completed",
    partial: "partial",
    canceled: "canceled",
    cancelled: "canceled",
    refunded: "refunded",
    failed: "failed"
  };

  return (
    statusMap[value] ||
    "processing"
  );
};

// ======================================================
// SYNC ORDER STATUS FROM PROVIDER
// ======================================================

const syncOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    // --------------------------------------------------
    // VALIDATE ORDER ID
    // --------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(orderId)
    ) {
      return res.status(400).json({
        message: "Invalid order ID"
      });
    }

    // --------------------------------------------------
    // FIND ORDER
    // --------------------------------------------------

    const order =
      await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    // --------------------------------------------------
    // CHECK PROVIDER
    // --------------------------------------------------

    if (!order.providerId) {
      return res.status(400).json({
        message: "Order has no provider"
      });
    }

    // --------------------------------------------------
    // CHECK PROVIDER ORDER ID
    // --------------------------------------------------

    if (!order.providerOrderId) {
      return res.status(400).json({
        message: "Provider order ID is missing"
      });
    }

    // --------------------------------------------------
    // FIND PROVIDER
    // --------------------------------------------------

    const provider =
      await Provider.findById(
        order.providerId
      ).select("+apiKey");

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found"
      });
    }

    // --------------------------------------------------
    // CHECK PROVIDER STATUS
    // --------------------------------------------------

    if (provider.status !== "active") {
      return res.status(400).json({
        message: "Provider is inactive"
      });
    }

    // --------------------------------------------------
    // FETCH PROVIDER STATUS
    // --------------------------------------------------

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
    } catch (providerError) {
      console.error(
        "ORDER STATUS SYNC PROVIDER ERROR:",
        providerError
      );

      return res.status(502).json({
        message:
          "Unable to fetch order status from provider",

        error:
          providerError.message,

        providerResponse:
          providerError.providerResponse ||
          null
      });
    }

    // --------------------------------------------------
    // NORMALIZE STATUS
    // --------------------------------------------------

    const previousStatus =
      order.status;

    const newStatus =
      normalizeProviderStatus(
        providerResult.status
      );

    // --------------------------------------------------
    // UPDATE ORDER STATUS
    // --------------------------------------------------

    order.status =
      newStatus;

    // --------------------------------------------------
    // UPDATE START COUNT
    // --------------------------------------------------

    if (
      Number.isFinite(
        providerResult.startCount
      ) &&
      providerResult.startCount >= 0
    ) {
      order.startCount =
        providerResult.startCount;
    }

    // --------------------------------------------------
    // UPDATE REMAINS
    // --------------------------------------------------

    if (
      Number.isFinite(
        providerResult.remains
      ) &&
      providerResult.remains >= 0
    ) {
      order.remains =
        providerResult.remains;
    }

    // --------------------------------------------------
    // SAVE PROVIDER RESPONSE
    // --------------------------------------------------

    order.providerResponse =
      providerResult.providerResponse;

    order.providerError =
      null;

    await order.save();

    // --------------------------------------------------
    // CREATE STATUS LOG
    // --------------------------------------------------

    if (
      previousStatus !==
      newStatus
    ) {
      await OrderStatusLog.create({
        orderId:
          order._id,

        previousStatus,

        newStatus,

        source:
          "provider",

        message:
          `Provider order status synchronized from ${previousStatus} to ${newStatus}`,

        providerResponse:
          providerResult.providerResponse
      });
    }

    // --------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      message:
        "Order status synchronized successfully",

      order: {
        _id:
          order._id,

        providerOrderId:
          order.providerOrderId,

        previousStatus,

        status:
          order.status,

        startCount:
          order.startCount,

        remains:
          order.remains
      },

      providerResponse:
        providerResult.providerResponse
    });

  } catch (error) {
    console.error(
      "SYNC ORDER STATUS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server error",

      error:
        error.message
    });
  }
};

// ======================================================
// CANCEL ORDER
// ======================================================

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    // --------------------------------------------------
    // VALIDATE ORDER ID
    // --------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(orderId)
    ) {
      return res.status(400).json({
        message: "Invalid order ID"
      });
    }

    // --------------------------------------------------
    // FIND ORDER
    // --------------------------------------------------

    const order =
      await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    // --------------------------------------------------
    // CHECK PROVIDER
    // --------------------------------------------------

    if (!order.providerId) {
      return res.status(400).json({
        message: "Order has no provider"
      });
    }

    // --------------------------------------------------
    // CHECK PROVIDER ORDER ID
    // --------------------------------------------------

    if (!order.providerOrderId) {
      return res.status(400).json({
        message:
          "Provider order ID is missing"
      });
    }

    // --------------------------------------------------
    // FIND SERVICE
    // --------------------------------------------------

    const service =
      await Service.findById(
        order.serviceId
      );

    if (!service) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    // --------------------------------------------------
    // CHECK CANCEL SUPPORT
    // --------------------------------------------------

    if (!service.cancel) {
      return res.status(400).json({
        message:
          "Cancel is not supported for this service",

        serviceId:
          service.serviceId,

        cancelSupported:
          false
      });
    }

    // --------------------------------------------------
    // CHECK LOCAL ORDER STATUS
    // --------------------------------------------------

    if (
      order.status ===
      "completed"
    ) {
      return res.status(400).json({
        message:
          "Completed order cannot be canceled"
      });
    }

    if (
      order.status ===
      "canceled"
    ) {
      return res.status(400).json({
        message:
          "Order is already canceled"
      });
    }

    // --------------------------------------------------
    // FIND PROVIDER
    // --------------------------------------------------

    const provider =
      await Provider.findById(
        order.providerId
      ).select("+apiKey");

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found"
      });
    }

    // --------------------------------------------------
    // CHECK PROVIDER STATUS
    // --------------------------------------------------

    if (
      provider.status !==
      "active"
    ) {
      return res.status(400).json({
        message:
          "Provider is inactive"
      });
    }

    // --------------------------------------------------
    // CANCEL AT PROVIDER
    // --------------------------------------------------

    let providerResult;

    try {
      providerResult =
        await cancelProviderOrder({
          provider,

          providerOrderId:
            order.providerOrderId,

          orderId:
            order._id
        });
    } catch (providerError) {
      console.error(
        "ORDER CANCEL PROVIDER ERROR:",
        providerError
      );

      return res.status(502).json({
        message:
          "Unable to cancel order at provider",

        error:
          providerError.message,

        providerResponse:
          providerError.providerResponse ||
          null
      });
    }

    // --------------------------------------------------
    // PREVIOUS STATUS
    // --------------------------------------------------

    const previousStatus =
      order.status;

    // --------------------------------------------------
    // UPDATE LOCAL ORDER
    // --------------------------------------------------

    order.status =
      "canceled";

    order.providerResponse =
      providerResult.providerResponse;

    order.providerError =
      null;

    await order.save();

    // --------------------------------------------------
    // CREATE STATUS LOG
    // --------------------------------------------------

    await OrderStatusLog.create({
      orderId:
        order._id,

      previousStatus,

      newStatus:
        "canceled",

      source:
        "provider",

      message:
        "Order canceled successfully at provider",

      providerResponse:
        providerResult.providerResponse
    });

    // --------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      message:
        "Order canceled successfully",

      order: {
        _id:
          order._id,

        providerOrderId:
          order.providerOrderId,

        previousStatus,

        status:
          order.status
      },

      providerResponse:
        providerResult.providerResponse
    });

  } catch (error) {
    console.error(
      "CANCEL ORDER ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server error",

      error:
        error.message
    });
  }
};

// ======================================================
// REFILL ORDER
// ======================================================

const refillOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(
      "===================================="
    );

    console.log(
      "REFILL ORDER REQUEST"
    );

    console.log(
      "ORDER ID:",
      orderId
    );

    // --------------------------------------------------
    // VALIDATE ORDER ID
    // --------------------------------------------------

    if (
      !mongoose.Types.ObjectId.isValid(orderId)
    ) {
      return res.status(400).json({
        message:
          "Invalid order ID"
      });
    }

    // --------------------------------------------------
    // FIND ORDER
    // --------------------------------------------------

    const order =
      await Order.findById(
        orderId
      );

    if (!order) {
      return res.status(404).json({
        message:
          "Order not found"
      });
    }

    console.log(
      "ORDER STATUS:",
      order.status
    );

    console.log(
      "PROVIDER ID:",
      order.providerId
    );

    console.log(
      "PROVIDER ORDER ID:",
      order.providerOrderId
    );

    // --------------------------------------------------
    // CHECK PROVIDER
    // --------------------------------------------------

    if (!order.providerId) {
      return res.status(400).json({
        message:
          "Order has no provider"
      });
    }

    // --------------------------------------------------
    // CHECK PROVIDER ORDER ID
    // --------------------------------------------------

    if (!order.providerOrderId) {
      return res.status(400).json({
        message:
          "Provider order ID is missing"
      });
    }

    // --------------------------------------------------
    // FIND SERVICE
    // --------------------------------------------------

    const service =
      await Service.findById(
        order.serviceId
      );

    if (!service) {
      return res.status(404).json({
        message:
          "Service not found"
      });
    }

    console.log(
      "SERVICE ID:",
      service.serviceId
    );

    console.log(
      "SERVICE NAME:",
      service.name
    );

    console.log(
      "SERVICE REFILL:",
      service.refill
    );

    // --------------------------------------------------
    // CHECK REFILL SUPPORT
    // --------------------------------------------------

    if (
      service.refill !== true
    ) {
      return res.status(400).json({
        message:
          "Refill is not supported for this service",

        serviceId:
          service.serviceId,

        serviceName:
          service.name,

        refillSupported:
          Boolean(service.refill)
      });
    }

    // --------------------------------------------------
    // CHECK LOCAL ORDER STATUS
    // --------------------------------------------------

    if (
      order.status ===
      "canceled"
    ) {
      return res.status(400).json({
        message:
          "Canceled order cannot be refilled"
      });
    }

    if (
      order.status ===
      "failed"
    ) {
      return res.status(400).json({
        message:
          "Failed order cannot be refilled"
      });
    }

    // --------------------------------------------------
    // REFILL ONLY COMPLETED / PARTIAL
    // --------------------------------------------------

    if (
      order.status !==
      "completed" &&
      order.status !==
      "partial"
    ) {
      return res.status(400).json({
        message:
          "Order can be refilled only when it is completed or partial",

        currentStatus:
          order.status,

        allowedStatuses: [
          "completed",
          "partial"
        ]
      });
    }

    // --------------------------------------------------
    // CHECK EXISTING REFILL
    // --------------------------------------------------

    if (
      order.refillId
    ) {
      return res.status(400).json({
        message:
          "Order has already been refilled",

        refillId:
          order.refillId
      });
    }

    // --------------------------------------------------
    // FIND PROVIDER
    // --------------------------------------------------

    const provider =
      await Provider.findById(
        order.providerId
      ).select("+apiKey");

    if (!provider) {
      return res.status(404).json({
        message:
          "Provider not found"
      });
    }

    console.log(
      "PROVIDER:",
      provider.name
    );

    // --------------------------------------------------
    // CHECK PROVIDER STATUS
    // --------------------------------------------------

    if (
      provider.status !==
      "active"
    ) {
      return res.status(400).json({
        message:
          "Provider is inactive"
      });
    }

    // --------------------------------------------------
    // REFILL AT PROVIDER
    // --------------------------------------------------

    console.log(
      "CALLING PROVIDER REFILL API..."
    );

    let providerResult;

    try {
      providerResult =
        await refillProviderOrder({
          provider,

          providerOrderId:
            order.providerOrderId,

          orderId:
            order._id
        });

    } catch (providerError) {
      console.error(
        "ORDER REFILL PROVIDER ERROR:",
        providerError
      );

      return res.status(502).json({
        message:
          "Unable to refill order at provider",

        error:
          providerError.message,

        providerResponse:
          providerError.providerResponse ||
          null
      });
    }

    console.log(
      "PROVIDER REFILL RESULT:",
      providerResult
    );

    // --------------------------------------------------
    // VALIDATE PROVIDER REFILL ID
    // --------------------------------------------------

    if (
      !providerResult ||
      !providerResult.refillId
    ) {
      return res.status(502).json({
        message:
          "Provider did not return a refill ID",

        providerResponse:
          providerResult?.providerResponse ||
          null
      });
    }

    // --------------------------------------------------
    // UPDATE LOCAL ORDER
    // --------------------------------------------------

    order.refillId =
      providerResult.refillId;

    order.providerResponse =
      providerResult.providerResponse;

    order.providerError =
      null;

    await order.save();

    // --------------------------------------------------
    // CREATE STATUS LOG
    // --------------------------------------------------

    await OrderStatusLog.create({
      orderId:
        order._id,

      previousStatus:
        order.status,

      newStatus:
        order.status,

      source:
        "provider",

      message:
        `Order refill requested successfully. Refill ID: ${providerResult.refillId}`,

      providerResponse:
        providerResult.providerResponse
    });

    console.log(
      "REFILL ORDER SUCCESS:",
      providerResult.refillId
    );

    console.log(
      "===================================="
    );

    // --------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      message:
        "Order refill requested successfully",

      order: {
        _id:
          order._id,

        providerOrderId:
          order.providerOrderId,

        refillId:
          order.refillId,

        status:
          order.status
      },

      providerResponse:
        providerResult.providerResponse
    });

  } catch (error) {
    console.error(
      "REFILL ORDER ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server error",

      error:
        error.message
    });
  }
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  syncOrderStatus,
  cancelOrder,
  refillOrder
};