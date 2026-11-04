const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [3, "Coupon code must be at least 3 characters"],
      match: [/^[A-Z0-9_-]+$/, "Code can only contain uppercase letters, numbers, hyphens, and underscores"],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed", "flat"],
      default: "percentage",
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0.01, "Discount value must be greater than 0"],
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, "Minimum spend cannot be negative"],
    },
    maxDiscountAmount: {
      type: Number,
      default: 0,
      min: [0, "Maximum discount cap cannot be negative"],
    },
    usageLimit: {
      type: Number,
      default: 100,
      min: [1, "Usage limit must be at least 1"],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: 1,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["Active", "Disabled", "Expired"],
      default: "Active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual / pre-save hook to ensure status synchronization with expiry & isActive
couponSchema.pre("save", function () {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }
  if (!this.isActive) {
    this.status = "Disabled";
  } else if (this.expiryDate && new Date(this.expiryDate).getTime() < Date.now()) {
    this.status = "Expired";
  } else {
    this.status = "Active";
  }
});

// Format object output to include aliases matching frontend contract
couponSchema.methods.toContractJSON = function () {
  const obj = this.toObject();
  const expiresAt = this.expiryDate
    ? new Date(this.expiryDate).toISOString().split("T")[0]
    : "";

  return {
    ...obj,
    id: String(this._id),
    type: this.discountType === "flat" ? "fixed" : this.discountType,
    value: this.discountValue,
    minSpend: this.minOrderAmount,
    maxDiscount: this.maxDiscountAmount,
    used: this.usedCount,
    expiresAt,
  };
};

module.exports = mongoose.model("Coupon", couponSchema);
