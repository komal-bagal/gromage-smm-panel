const Coupon = require("../models/Coupon");
const CouponUsage = require("../models/CouponUsage");


// =====================================================
// FIND COUPON
// =====================================================

async function findCoupon(code) {
  if (!code || typeof code !== "string") {
    throw new Error("Coupon code is required");
  }

  const normalizedCode = code.trim().toUpperCase();

  const coupon = await Coupon.findOne({
    code: normalizedCode,
  });

  if (!coupon) {
    throw new Error("Invalid coupon code");
  }

  return coupon;
}


// =====================================================
// VALIDATE COUPON
// =====================================================

async function validateCoupon({
  code,
  userId,
  orderAmount,
}) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (
    typeof orderAmount !== "number" ||
    !Number.isFinite(orderAmount) ||
    orderAmount < 0
  ) {
    throw new Error("Invalid order amount");
  }

  const coupon = await findCoupon(code);

  const now = new Date();

  // Check active status
  if (!coupon.isActive) {
    throw new Error("Coupon is inactive");
  }

  // Check start date
  if (coupon.startDate && now < coupon.startDate) {
    throw new Error("Coupon is not active yet");
  }

  // Check expiry date
  if (coupon.expiryDate && now > coupon.expiryDate) {
    throw new Error("Coupon has expired");
  }

  // Check total usage limit
  if (
    coupon.usageLimit !== null &&
    coupon.usageCount >= coupon.usageLimit
  ) {
    throw new Error("Coupon usage limit reached");
  }

  // Check minimum order amount
  if (orderAmount < coupon.minOrderAmount) {
    throw new Error(
      `Minimum order amount for this coupon is ${coupon.minOrderAmount}`
    );
  }

  // Check per-user usage limit
  const userUsageCount = await CouponUsage.countDocuments({
    coupon: coupon._id,
    user: userId,
  });

  if (userUsageCount >= coupon.perUserLimit) {
    throw new Error(
      "You have reached the usage limit for this coupon"
    );
  }

  // =====================================================
  // CALCULATE DISCOUNT
  // =====================================================

  let discountAmount = 0;

  if (coupon.discountType === "percentage") {
    discountAmount =
      (orderAmount * coupon.discountValue) / 100;

    // Apply maximum discount limit
    if (
      coupon.maxDiscountAmount !== null &&
      discountAmount > coupon.maxDiscountAmount
    ) {
      discountAmount = coupon.maxDiscountAmount;
    }
  } else if (coupon.discountType === "fixed") {
    discountAmount = coupon.discountValue;
  }

  // Discount cannot be greater than order amount
  if (discountAmount > orderAmount) {
    discountAmount = orderAmount;
  }

  // Round discount to 2 decimal places
  discountAmount = Number(discountAmount.toFixed(2));

  // Calculate final amount
  const finalAmount = Number(
    (orderAmount - discountAmount).toFixed(2)
  );

  return {
    valid: true,
    coupon,
    discountAmount,
    finalAmount,
    orderAmount,
  };
}


// =====================================================
// RECORD COUPON USAGE
// =====================================================

async function recordCouponUsage({
  couponId,
  userId,
  orderId,
  discountAmount,
  orderAmount,
}) {
  if (!couponId) {
    throw new Error("Coupon ID is required");
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!orderId) {
    throw new Error("Order ID is required");
  }

  const usage = await CouponUsage.create({
    coupon: couponId,
    user: userId,
    order: orderId,
    discountAmount,
    orderAmount,
  });

  const updatedCoupon = await Coupon.findByIdAndUpdate(
    couponId,
    {
      $inc: {
        usageCount: 1,
      },
    },
    {
      new: true,
    }
  );

  if (!updatedCoupon) {
    throw new Error(
      "Coupon usage recorded but coupon could not be updated"
    );
  }

  return {
    usage,
    coupon: updatedCoupon,
  };
}


// =====================================================
// REVERT COUPON USAGE
// =====================================================
//
// Called when an order that had a coupon applied ends up failing
// after usage was (or may have been) recorded — e.g. provider
// rejection, Drip Feed scheduling failure, or a partial failure
// inside recordCouponUsage itself (CouponUsage created but the
// Coupon.usageCount increment didn't complete). Safe to call even
// when nothing was recorded: it just no-ops. Never throws — callers
// treat this the same way they treat createStatusLogSafe, as a
// best-effort cleanup step that shouldn't block the response.

async function revertCouponUsage(orderId) {
  if (!orderId) {
    return { success: false, message: "Order ID is required" };
  }

  try {
    const usage = await CouponUsage.findOne({ order: orderId });

    if (!usage) {
      return { success: true, reverted: false };
    }

    await Coupon.findByIdAndUpdate(usage.coupon, {
      $inc: {
        usageCount: -1,
      },
    });

    await CouponUsage.deleteOne({ _id: usage._id });

    return { success: true, reverted: true };
  } catch (error) {
    console.error("revertCouponUsage failed:", error.message);

    return {
      success: false,
      message: error.message,
    };
  }
}


// =====================================================
// GET COUPON USAGE
// =====================================================

async function getCouponUsage({
  couponId = null,
  userId = null,
  orderId = null,
}) {
  const filter = {};

  if (couponId) {
    filter.coupon = couponId;
  }

  if (userId) {
    filter.user = userId;
  }

  if (orderId) {
    filter.order = orderId;
  }

  const usage = await CouponUsage.find(filter)
    .populate(
      "coupon",
      "code description discountType discountValue"
    )
    .populate(
      "user",
      "name email"
    )
    .populate(
      "order",
      "_id charge originalCharge discountAmount status"
    )
    .sort({
      createdAt: -1,
    });

  return usage;
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  findCoupon,
  validateCoupon,
  recordCouponUsage,
  revertCouponUsage,
  getCouponUsage,
};