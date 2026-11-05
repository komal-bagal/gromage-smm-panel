
const mongoose = require("mongoose");

const paymentTransactionSchema = new mongoose.Schema(
  {
    // ==================================================
    // USER
    // ==================================================

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ==================================================
    // PAYMENT METHOD
    // ==================================================

    paymentMethod: {
      type: String,
      enum: ["razorpay", "paytm", "cashfree", "upi", "qr", "manual"],
      required: true,
      index: true,
    },

    // ==================================================
    // TRANSACTION TYPE
    // ==================================================

    transactionType: {
      type: String,
      enum: ["recharge"],
      default: "recharge",
    },

    // ==================================================
    // APPLICATION REFERENCE
    // ==================================================

    reference: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },

    // ==================================================
    // AMOUNT
    // ==================================================

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ==================================================
    // PAYMENT STATUS
    // ==================================================

    status: {
      type: String,
      enum: ["pending", "completed", "failed", "rejected"],
      default: "pending",
      index: true,
    },

    // ==================================================
    // MANUAL PAYMENT DETAILS
    // ==================================================

    paymentScreenshot: {
      type: String,
      default: null,
      trim: true,
    },

    paymentNote: {
      type: String,
      default: "",
      trim: true,
    },

    // ==================================================
    // GATEWAY TRANSACTION ID
    // ==================================================

    gatewayTransactionId: {
      type: String,
      default: null,
      trim: true,
    },

    // ==================================================
    // GATEWAY ORDER ID
    // ==================================================

    gatewayOrderId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    // ==================================================
    // GATEWAY RESPONSE
    // Store sanitized gateway response only.
    // Never store merchant keys or sensitive secrets.
    // ==================================================

    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ==================================================
// PREVENT DUPLICATE GATEWAY TRANSACTION IDs
// Applies only to string values.
// Multiple null or missing values are allowed.
// ==================================================

paymentTransactionSchema.index(
  { gatewayTransactionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      gatewayTransactionId: { $type: "string" },
    },
  }
);

module.exports = mongoose.model(
  "PaymentTransaction",
  paymentTransactionSchema
);
