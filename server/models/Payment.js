const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    user: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    userEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    type: {
      type: String,
      enum: ["Credit", "Debit", "Refund", "Adjustment"],
      default: "Credit",
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    fee: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    method: {
      type: String,
      default: "UPI QR Code",
      trim: true,
    },
    refId: {
      type: String,
      trim: true,
      default: "N/A",
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    screenshot: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate paymentId and netAmount before validation/save
paymentSchema.pre("validate", function () {
  if (!this.paymentId) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    this.paymentId = `TXN-${randomSuffix}`;
  }
  const amt = Number(this.amount) || 0;
  const f = Number(this.fee) || 0;
  this.netAmount = Math.max(0, amt - f);
});

module.exports = mongoose.model("Payment", paymentSchema);
