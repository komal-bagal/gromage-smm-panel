const mongoose = require("mongoose");

const paymentTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    paymentMethod: {
      type: String,
      enum: ["razorpay", "upi", "qr", "manual"],
      required: true
    },

    transactionType: {
      type: String,
      enum: ["recharge"],
      default: "recharge"
    },

    reference: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    status: {
      type: String,
      enum: [
        "pending",
        "completed",
        "failed",
        "rejected"
      ],
      default: "pending"
    },

    gatewayTransactionId: {
      type: String,
      default: null,
      trim: true
    },

    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "PaymentTransaction",
  paymentTransactionSchema
);