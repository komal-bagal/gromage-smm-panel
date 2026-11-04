const mongoose = require("mongoose");

const affiliateSchema = new mongoose.Schema(
  {
    affiliateId: {
      type: String,
      unique: true,
      index: true,
    },
    user: {
      type: String,
      required: [true, "Partner name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Partner email is required"],
      lowercase: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    referralCode: {
      type: String,
      required: [true, "Referral code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, "Referral code must be at least 3 characters"],
      maxlength: [20, "Referral code cannot exceed 20 characters"],
      match: [/^[A-Z0-9_-]+$/, "Code can only contain alphanumeric characters, -, _"],
      index: true,
    },
    commissionRate: {
      type: Number,
      default: 5,
      min: [1, "Commission rate must be at least 1%"],
      max: [100, "Commission rate cannot exceed 100%"],
    },
    referralCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    conversionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Active", "Disabled"],
      default: "Active",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

affiliateSchema.pre("validate", function () {
  if (!this.affiliateId) {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    this.affiliateId = `AFF-${randomSuffix}`;
  }
  if (this.referralCode) {
    this.referralCode = this.referralCode.trim().toUpperCase();
  }
  if (this.isActive !== undefined) {
    this.status = this.isActive ? "Active" : "Disabled";
  } else if (this.status) {
    this.isActive = this.status === "Active";
  }
});

affiliateSchema.methods.toContractJSON = function () {
  const obj = this.toObject();
  const joinedAt = this.createdAt
    ? new Date(this.createdAt).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];
  const pendingBalance = Math.max(0, (this.totalEarnings || 0) - (this.paidEarnings || 0));

  return {
    ...obj,
    id: this.affiliateId || String(this._id),
    _id: this._id,
    userId: String(this.userId || ""),
    user: this.user,
    email: this.email,
    referralCode: this.referralCode,
    referralCount: this.referralCount || 0,
    conversionCount: this.conversionCount || 0,
    commissionRate: this.commissionRate,
    totalEarnings: Number((this.totalEarnings || 0).toFixed(2)),
    paidEarnings: Number((this.paidEarnings || 0).toFixed(2)),
    pendingBalance: Number(pendingBalance.toFixed(2)),
    status: this.status,
    isActive: this.isActive,
    joinedAt,
  };
};

module.exports = mongoose.model("Affiliate", affiliateSchema);
