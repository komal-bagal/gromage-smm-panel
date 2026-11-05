
const mongoose = require("mongoose");

// ======================================================
// DRIP FEED RUN STATUSES
// ======================================================

const DRIP_RUN_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "canceled",
];

// ======================================================
// DRIP FEED RUN SCHEMA
// ======================================================

const dripFeedRunSchema = new mongoose.Schema(
  {
    // --------------------------------------------------
    // PARENT ORDER
    // --------------------------------------------------

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    // --------------------------------------------------
    // USER
    // --------------------------------------------------

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // --------------------------------------------------
    // RUN NUMBER
    // --------------------------------------------------

    runNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    // --------------------------------------------------
    // RUN QUANTITY
    // --------------------------------------------------

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // --------------------------------------------------
    // RUN STATUS
    // --------------------------------------------------

    status: {
      type: String,
      enum: DRIP_RUN_STATUSES,
      default: "pending",
      index: true,
    },

    // --------------------------------------------------
    // SCHEDULED TIME
    // --------------------------------------------------

    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },

    // --------------------------------------------------
    // START TIME
    // --------------------------------------------------

    startedAt: {
      type: Date,
      default: null,
    },

    // --------------------------------------------------
    // COMPLETION TIME
    // --------------------------------------------------

    completedAt: {
      type: Date,
      default: null,
    },

    // --------------------------------------------------
    // PROVIDER ORDER ID
    // --------------------------------------------------

    providerOrderId: {
      type: String,
      default: null,
      trim: true,
    },

    // --------------------------------------------------
    // PROVIDER RESPONSE
    // --------------------------------------------------

    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // --------------------------------------------------
    // ERROR
    // --------------------------------------------------

    error: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// UNIQUE RUN PER ORDER
// ======================================================
//
// One order can have only one record for each
// run number.
//
// Example:
//
// Order A + Run 1  → allowed
// Order A + Run 1  → duplicate
// Order A + Run 2  → allowed
//
// ======================================================

dripFeedRunSchema.index(
  {
    orderId: 1,
    runNumber: 1,
  },
  {
    unique: true,
  }
);

// ======================================================
// STATUS + SCHEDULE INDEX
// ======================================================
//
// Useful for finding pending runs that are scheduled
// for processing.
//

dripFeedRunSchema.index({
  status: 1,
  scheduledAt: 1,
});

// ======================================================
// MODEL
// ======================================================
//
// Reuse the existing model if Mongoose has already
// registered it. This prevents OverwriteModelError
// during development/reloading.
//

const DripFeedRun =
  mongoose.models.DripFeedRun ||
  mongoose.model("DripFeedRun", dripFeedRunSchema);

// ======================================================
// EXPORT
// ======================================================

module.exports = DripFeedRun;
