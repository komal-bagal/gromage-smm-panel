// ======================================================
// PROVIDER LOG MODEL
// ======================================================

const mongoose = require("mongoose");

// ======================================================
// PROVIDER LOG SCHEMA
// ======================================================

const providerLogSchema = new mongoose.Schema(
  {
    // ==================================================
    // PROVIDER
    // ==================================================

    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
      index: true
    },

    // ==================================================
    // ORDER
    // ==================================================

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true
    },

    // ==================================================
    // OPERATION
    // ==================================================

    operation: {
      type: String,
      enum: [
        "services",
        "create_order",
        "status",
        "refill",
        "cancel",
        "balance",
        "unknown"
      ],
      required: true,
      index: true
    },

    // ==================================================
    // REQUEST
    // ==================================================

    method: {
      type: String,
      default: "POST"
    },

    endpoint: {
      type: String,
      required: true,
      trim: true
    },

    requestPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    // ==================================================
    // RESPONSE
    // ==================================================

    httpStatus: {
      type: Number,
      default: null,
      index: true
    },

    responsePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    // ==================================================
    // RESULT
    // ==================================================

    success: {
      type: Boolean,
      default: false,
      index: true
    },

    // ==================================================
    // ERROR
    // ==================================================

    errorMessage: {
      type: String,
      default: null
    },

    errorCode: {
      type: String,
      default: null
    },

    // ==================================================
    // PERFORMANCE
    // ==================================================

    durationMs: {
      type: Number,
      default: null,
      min: 0
    },

    // ==================================================
    // RETRY
    // ==================================================

    attempt: {
      type: Number,
      default: 1,
      min: 1
    },

    maxAttempts: {
      type: Number,
      default: 1,
      min: 1
    }
  },
  {
    timestamps: true
  }
);

// ======================================================
// INDEXES
// ======================================================

// Provider + latest logs
providerLogSchema.index({
  providerId: 1,
  createdAt: -1
});

// Provider + operation + latest logs
providerLogSchema.index({
  providerId: 1,
  operation: 1,
  createdAt: -1
});

// Order + latest logs
providerLogSchema.index({
  orderId: 1,
  createdAt: -1
});

// Failed provider calls
providerLogSchema.index({
  success: 1,
  createdAt: -1
});

// ======================================================
// MODEL
// ======================================================

const ProviderLog = mongoose.model(
  "ProviderLog",
  providerLogSchema
);

module.exports = ProviderLog;