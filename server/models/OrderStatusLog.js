const mongoose = require("mongoose");

// ======================================================
// ORDER STATUS VALUES
// ======================================================

const ORDER_STATUSES = [
  "pending",
  "processing",
  "in_progress",
  "completed",
  "partial",
  "canceled",
  "refunded",
  "failed"
];

// ======================================================
// ORDER STATUS LOG SCHEMA
// ======================================================

const orderStatusLogSchema = new mongoose.Schema(
  {
    // ==================================================
    // ORDER
    // ==================================================

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true
    },

    // ==================================================
    // OLD STATUS
    // ==================================================

    previousStatus: {
      type: String,
      enum: ORDER_STATUSES,
      default: null
    },

    // ==================================================
    // NEW STATUS
    // ==================================================

    newStatus: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
      index: true
    },

    // ==================================================
    // SOURCE
    // ==================================================

    source: {
      type: String,
      enum: [
        "system",
        "admin",
        "provider",
        "user"
      ],
      default: "system",
      index: true
    },

    // ==================================================
    // MESSAGE
    // ==================================================

    message: {
      type: String,
      default: "",
      trim: true
    },

    // ==================================================
    // PROVIDER RESPONSE
    // ==================================================

    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// ======================================================
// INDEXES
// ======================================================

// Get order history quickly
orderStatusLogSchema.index({
  orderId: 1,
  createdAt: -1
});

// Useful for filtering status history
orderStatusLogSchema.index({
  newStatus: 1,
  createdAt: -1
});

// Useful for filtering provider/admin/system changes
orderStatusLogSchema.index({
  source: 1,
  createdAt: -1
});

// ======================================================
// MODEL
// ======================================================

module.exports = mongoose.model(
  "OrderStatusLog",
  orderStatusLogSchema
);