const Coupon = require("../models/Coupon");

const {
  validateCoupon,
} = require("../services/couponService");

const createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      perUserLimit,
      startDate,
      expiryDate,
      isActive,
    } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    if (!["percentage", "fixed"].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: "Discount type must be percentage or fixed",
      });
    }

    if (
      typeof discountValue !== "number" ||
      !Number.isFinite(discountValue) ||
      discountValue <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be greater than 0",
      });
    }

    if (
      discountType === "percentage" &&
      discountValue > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount cannot exceed 100",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    const existingCoupon = await Coupon.findOne({
      code: normalizedCode,
    });

    if (existingCoupon) {
      return res.status(409).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    const coupon = await Coupon.create({
      code: normalizedCode,
      description: description || "",
      discountType,
      discountValue,

      minOrderAmount:
        typeof minOrderAmount === "number"
          ? minOrderAmount
          : 0,

      maxDiscountAmount:
        typeof maxDiscountAmount === "number"
          ? maxDiscountAmount
          : null,

      usageLimit:
        typeof usageLimit === "number"
          ? usageLimit
          : null,

      perUserLimit:
        typeof perUserLimit === "number"
          ? perUserLimit
          : 1,

      startDate:
        startDate || new Date(),

      expiryDate:
        expiryDate || null,

      isActive:
        typeof isActive === "boolean"
          ? isActive
          : true,

      createdBy:
        req.user?._id || null,
    });

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      coupon,
    });
  } catch (error) {
    console.error("Create coupon error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create coupon",
    });
  }
};

const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find()
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: coupons.length,
      coupons,
    });
  } catch (error) {
    console.error("Get coupons error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get coupons",
    });
  }
};

const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.status(200).json({
      success: true,
      coupon,
    });
  } catch (error) {
    console.error("Get coupon by ID error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to get coupon",
    });
  }
};

const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      usageLimit,
      perUserLimit,
      startDate,
      expiryDate,
      isActive,
    } = req.body;

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    if (
      discountType !== undefined &&
      !["percentage", "fixed"].includes(discountType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Discount type must be percentage or fixed",
      });
    }

    if (
      discountValue !== undefined &&
      (
        typeof discountValue !== "number" ||
        !Number.isFinite(discountValue) ||
        discountValue <= 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be greater than 0",
      });
    }

    const finalDiscountType =
      discountType !== undefined
        ? discountType
        : coupon.discountType;

    const finalDiscountValue =
      discountValue !== undefined
        ? discountValue
        : coupon.discountValue;

    if (
      finalDiscountType === "percentage" &&
      finalDiscountValue > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount cannot exceed 100",
      });
    }

    if (code !== undefined) {
      const normalizedCode = code.trim().toUpperCase();

      const existingCoupon = await Coupon.findOne({
        code: normalizedCode,
        _id: { $ne: id },
      });

      if (existingCoupon) {
        return res.status(409).json({
          success: false,
          message: "Coupon code already exists",
        });
      }

      coupon.code = normalizedCode;
    }

    if (description !== undefined) {
      coupon.description = description;
    }

    if (discountType !== undefined) {
      coupon.discountType = discountType;
    }

    if (discountValue !== undefined) {
      coupon.discountValue = discountValue;
    }

    if (minOrderAmount !== undefined) {
      coupon.minOrderAmount = minOrderAmount;
    }

    if (maxDiscountAmount !== undefined) {
      coupon.maxDiscountAmount = maxDiscountAmount;
    }

    if (usageLimit !== undefined) {
      coupon.usageLimit = usageLimit;
    }

    if (perUserLimit !== undefined) {
      coupon.perUserLimit = perUserLimit;
    }

    if (startDate !== undefined) {
      coupon.startDate = startDate;
    }

    if (expiryDate !== undefined) {
      coupon.expiryDate = expiryDate;
    }

    if (typeof isActive === "boolean") {
      coupon.isActive = isActive;
    }

    await coupon.save();

    return res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      coupon,
    });
  } catch (error) {
    console.error("Update coupon error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update coupon",
    });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    await Coupon.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Delete coupon error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete coupon",
    });
  }
};

const validateCouponController = async (req, res) => {
  try {
    const {
      code,
      orderAmount,
    } = req.body;

    const result = await validateCoupon({
      code,
      userId: req.user?._id,
      orderAmount,
    });

    return res.status(200).json({
      success: true,
      message: "Coupon is valid",
      coupon: {
        id: result.coupon._id,
        code: result.coupon.code,
        discountType: result.coupon.discountType,
        discountValue: result.coupon.discountValue,
      },
      orderAmount: result.orderAmount,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
    });
  } catch (error) {
    console.error("Validate coupon error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Invalid coupon",
    });
  }
};

module.exports = {
  createCoupon,
  getCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCouponController,
};