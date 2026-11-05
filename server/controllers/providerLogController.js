// ======================================================
// PROVIDER LOG CONTROLLER
// ======================================================

const mongoose = require("mongoose");

const ProviderLog = require("../models/ProviderLog");

// ======================================================
// GET PROVIDER LOGS
// ======================================================

const getProviderLogs = async (req, res) => {
  try {
    const {
      providerId,
      orderId,
      operation,
      success,
      page = 1,
      limit = 20
    } = req.query;

    // ==================================================
    // VALIDATE PROVIDER ID
    // ==================================================

    if (
      providerId &&
      !mongoose.Types.ObjectId.isValid(providerId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider ID"
      });
    }

    // ==================================================
    // VALIDATE ORDER ID
    // ==================================================

    if (
      orderId &&
      !mongoose.Types.ObjectId.isValid(orderId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID"
      });
    }

    // ==================================================
    // BUILD FILTER
    // ==================================================

    const filter = {};

    if (providerId) {
      filter.providerId = providerId;
    }

    if (orderId) {
      filter.orderId = orderId;
    }

    // ==================================================
    // OPERATION FILTER
    // ==================================================

    if (operation) {
      const normalizedOperation = String(operation)
        .trim()
        .toLowerCase();

      const allowedOperations = [
        "services",
        "create_order",
        "status",
        "refill",
        "cancel",
        "balance",
        "unknown"
      ];

      if (
        !allowedOperations.includes(
          normalizedOperation
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid provider log operation"
        });
      }

      filter.operation =
        normalizedOperation;
    }

    // ==================================================
    // SUCCESS FILTER
    // ==================================================

    if (success !== undefined) {
      if (success === "true") {
        filter.success = true;
      } else if (success === "false") {
        filter.success = false;
      } else {
        return res.status(400).json({
          success: false,
          message:
            "Success filter must be true or false"
        });
      }
    }

    // ==================================================
    // PAGINATION
    // ==================================================

    let pageNumber = Number(page);
    let limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1
    ) {
      pageNumber = 1;
    }

    if (
      !Number.isInteger(limitNumber) ||
      limitNumber < 1
    ) {
      limitNumber = 20;
    }

    // Maximum 100 logs per request
    if (limitNumber > 100) {
      limitNumber = 100;
    }

    const skip =
      (pageNumber - 1) * limitNumber;

    // ==================================================
    // FETCH LOGS
    // ==================================================

    const [logs, total] =
      await Promise.all([
        ProviderLog.find(filter)
          .populate(
            "providerId",
            "name apiUrl status priority"
          )
          .populate(
            "orderId",
            "_id status providerOrderId"
          )
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limitNumber)
          .lean(),

        ProviderLog.countDocuments(filter)
      ]);

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      message:
        "Provider logs fetched successfully",

      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages:
          Math.ceil(
            total / limitNumber
          )
      },

      logs
    });

  } catch (error) {
    console.error(
      "===================================="
    );

    console.error(
      "GET PROVIDER LOGS ERROR"
    );

    console.error(
      "MESSAGE:",
      error.message
    );

    console.error(
      "STACK:",
      error.stack
    );

    console.error(
      "===================================="
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch provider logs"
    });
  }
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  getProviderLogs
};