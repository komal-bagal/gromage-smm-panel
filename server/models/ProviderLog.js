const mongoose = require("mongoose");

const providerLogSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
      index: true
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true
    },

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
      default: "unknown",
      required: true
    },

    method: {
      type: String,
      default: "POST",
      trim: true
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

    httpStatus: {
      type: Number,
      default: null,
      min: 100,
      max: 599
    },

    responsePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    success: {
      type: Boolean,
      default: false,
      required: true
    },

    errorMessage: {
      type: String,
      default: null,
      maxlength: 2000
    },

    errorCode: {
      type: String,
      default: null,
      maxlength: 200
    },

    durationMs: {
      type: Number,
      default: null,
      min: 0
    },

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

// Indexes for provider history, operation history,
// order history, and success/failure monitoring.
providerLogSchema.index({
  providerId: 1,
  createdAt: -1
});

providerLogSchema.index({
  providerId: 1,
  operation: 1,
  createdAt: -1
});

providerLogSchema.index({
  orderId: 1,
  createdAt: -1
});

providerLogSchema.index({
  success: 1,
  createdAt: -1
});

// Reuse the model if it has already been registered.
module.exports =
  mongoose.models.ProviderLog ||
  mongoose.model("ProviderLog", providerLogSchema);