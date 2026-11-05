
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },

    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0,
    },

    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },

    usageCount: {
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
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// INDEXES
// ======================================================

// code already has unique: true above.
// Do NOT add another code index here.

couponSchema.index({ isActive: 1 });
couponSchema.index({ expiryDate: 1 });

// ======================================================
// MODEL
// ======================================================

const Coupon =
  mongoose.models.Coupon ||
  mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
