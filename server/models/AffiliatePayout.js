const mongoose = require("mongoose");

const affiliatePayoutSchema = new mongoose.Schema(
  {
    payoutId: {
      type: String,
      unique: true,
      index: true,
    },
    affiliateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Affiliate",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    user: {
      type: String,
      required: [true, "Recipient name is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    amount: {
      type: Number,
      required: [true, "Payout amount is required"],
      min: [1, "Amount must be at least 1"],
    },
    method: {
      type: String,
      required: [true, "Payout method is required"],
      trim: true,
      default: "UPI",
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },
    transactionRef: {
      type: String,
      trim: true,
      default: "",
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

affiliatePayoutSchema.pre("validate", function () {
  if (!this.payoutId) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    this.payoutId = `PAY-${randomSuffix}`;
  }
});

affiliatePayoutSchema.methods.toContractJSON = function () {
  const obj = this.toObject();
  const numAmt = Number(this.amount || 0);
  const formattedAmt = `₹${numAmt.toLocaleString("en-IN")}`;
  const requestedAt = this.createdAt
    ? new Date(this.createdAt).toISOString().replace("T", " ").slice(0, 16)
    : "";

  return {
    ...obj,
    id: this.payoutId || String(this._id),
    _id: this._id,
    affiliateId: String(this.affiliateId),
    userId: String(this.userId || ""),
    user: this.user,
    email: this.email,
    amount: formattedAmt,
    numericAmount: numAmt,
    method: this.method,
    status: this.status,
    requestedAt,
    processedAt: this.processedAt
      ? new Date(this.processedAt).toISOString().replace("T", " ").slice(0, 16)
      : null,
  };
};

module.exports = mongoose.model("AffiliatePayout", affiliatePayoutSchema);
