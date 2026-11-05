const mongoose = require("mongoose");

const couponUsageSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    orderAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    usedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

couponUsageSchema.index({ coupon: 1, user: 1 });
couponUsageSchema.index({ coupon: 1, order: 1 }, { unique: true });
couponUsageSchema.index({ user: 1 });

module.exports = mongoose.model("CouponUsage", couponUsageSchema);
