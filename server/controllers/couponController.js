const mongoose = require("mongoose");
const Coupon = require("../models/Coupon");

/**
 * GET /api/coupon
 * List all coupons with optional status and search filtering (Admin)
 */
const getCoupons = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.status = new RegExp(`^${status}$`, "i");
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      const regex = new RegExp(q, "i");
      filter.$or = [{ code: regex }, { description: regex }];
    }

    const coupons = await Coupon.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: coupons.length,
      coupons: coupons.map((c) => c.toContractJSON()),
      data: coupons.map((c) => c.toContractJSON()),
    });
  } catch (error) {
    console.error("Get Coupons Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
      error: error.message,
    });
  }
};

/**
 * GET /api/coupon/:id
 * Retrieve a single coupon by _id or code (Admin)
 */
const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;
    let coupon = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      coupon = await Coupon.findById(id);
    }
    if (!coupon) {
      coupon = await Coupon.findOne({ code: String(id).trim().toUpperCase() });
    }

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: `Coupon '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      coupon: coupon.toContractJSON(),
      data: coupon.toContractJSON(),
    });
  } catch (error) {
    console.error("Get Coupon Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve coupon details",
      error: error.message,
    });
  }
};

/**
 * POST /api/coupon
 * Create a new coupon (Admin)
 */
const createCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      type,
      discountType,
      value,
      discountValue,
      minSpend,
      minOrderAmount,
      maxDiscount,
      maxDiscountAmount,
      usageLimit,
      perUserLimit,
      expiresAt,
      expiryDate,
      status,
      isActive,
    } = req.body;

    // 1. Code validation
    const cleanCode = String(code || "").trim().toUpperCase();
    if (!cleanCode) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    if (!/^[A-Z0-9_-]+$/.test(cleanCode) || cleanCode.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Coupon code must be at least 3 characters and contain only uppercase letters, numbers, hyphens, or underscores",
      });
    }

    const existing = await Coupon.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Coupon code '${cleanCode}' already exists`,
      });
    }

    // 2. Type & Value validation
    const rawType = discountType || (type === "flat" ? "fixed" : type) || "percentage";
    const finalType = ["percentage", "fixed", "flat"].includes(rawType.toLowerCase())
      ? rawType.toLowerCase()
      : "percentage";

    const numValue = Number(discountValue !== undefined ? discountValue : value);
    if (isNaN(numValue) || numValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Discount value must be a valid number greater than 0",
      });
    }

    if (finalType === "percentage" && numValue > 100) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount cannot exceed 100%",
      });
    }

    // 3. Minimum spend & maximum discount caps
    const numMinSpend = Math.max(0, Number(minOrderAmount !== undefined ? minOrderAmount : minSpend) || 0);
    const numMaxDiscount = Math.max(0, Number(maxDiscountAmount !== undefined ? maxDiscountAmount : maxDiscount) || 0);

    // 4. Usage limit validation
    const numUsageLimit = Number(usageLimit !== undefined ? usageLimit : 100);
    if (isNaN(numUsageLimit) || numUsageLimit < 1) {
      return res.status(400).json({
        success: false,
        message: "Usage limit must be a positive integer greater than 0",
      });
    }

    // 5. Expiry date validation
    const rawExpiry = expiryDate || expiresAt;
    if (!rawExpiry) {
      return res.status(400).json({
        success: false,
        message: "Expiry date is required",
      });
    }

    const parsedExpiry = new Date(rawExpiry);
    if (isNaN(parsedExpiry.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid expiry date format",
      });
    }

    // Set end of day for expiry date
    parsedExpiry.setHours(23, 59, 59, 999);

    const isExplicitActive = isActive !== undefined ? Boolean(isActive) : status !== "Disabled";
    const initialStatus = !isExplicitActive
      ? "Disabled"
      : parsedExpiry.getTime() < Date.now()
      ? "Expired"
      : "Active";

    const newCoupon = new Coupon({
      code: cleanCode,
      description: description || "",
      discountType: finalType === "flat" ? "fixed" : finalType,
      discountValue: numValue,
      minOrderAmount: numMinSpend,
      maxDiscountAmount: numMaxDiscount,
      usageLimit: Math.floor(numUsageLimit),
      perUserLimit: Math.max(1, Number(perUserLimit) || 1),
      expiryDate: parsedExpiry,
      isActive: isExplicitActive,
      status: initialStatus,
    });

    await newCoupon.save();

    return res.status(201).json({
      success: true,
      message: `Coupon '${cleanCode}' created successfully`,
      coupon: newCoupon.toContractJSON(),
      data: newCoupon.toContractJSON(),
    });
  } catch (error) {
    console.error("Create Coupon Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create coupon",
      error: error.message,
    });
  }
};

/**
 * PUT /api/coupon/:id
 * Update coupon properties (Admin)
 */
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    let coupon = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      coupon = await Coupon.findById(id);
    }
    if (!coupon) {
      coupon = await Coupon.findOne({ code: String(id).trim().toUpperCase() });
    }

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: `Coupon '${id}' not found`,
      });
    }

    const {
      code,
      description,
      type,
      discountType,
      value,
      discountValue,
      minSpend,
      minOrderAmount,
      maxDiscount,
      maxDiscountAmount,
      usageLimit,
      perUserLimit,
      expiresAt,
      expiryDate,
      status,
      isActive,
    } = req.body;

    // Check code change
    if (code) {
      const cleanCode = String(code).trim().toUpperCase();
      if (cleanCode !== coupon.code) {
        if (!/^[A-Z0-9_-]+$/.test(cleanCode) || cleanCode.length < 3) {
          return res.status(400).json({
            success: false,
            message: "Coupon code must be at least 3 characters (alphanumeric, -, _)",
          });
        }
        const duplicate = await Coupon.findOne({ code: cleanCode, _id: { $ne: coupon._id } });
        if (duplicate) {
          return res.status(400).json({
            success: false,
            message: `Coupon code '${cleanCode}' is already taken`,
          });
        }
        coupon.code = cleanCode;
      }
    }

    if (description !== undefined) coupon.description = description;

    if (discountType !== undefined || type !== undefined) {
      const rawType = discountType || (type === "flat" ? "fixed" : type);
      coupon.discountType = rawType === "flat" ? "fixed" : rawType;
    }

    if (discountValue !== undefined || value !== undefined) {
      const numVal = Number(discountValue !== undefined ? discountValue : value);
      if (isNaN(numVal) || numVal <= 0) {
        return res.status(400).json({
          success: false,
          message: "Discount value must be greater than 0",
        });
      }
      if (coupon.discountType === "percentage" && numVal > 100) {
        return res.status(400).json({
          success: false,
          message: "Percentage discount cannot exceed 100%",
        });
      }
      coupon.discountValue = numVal;
    }

    if (minOrderAmount !== undefined || minSpend !== undefined) {
      coupon.minOrderAmount = Math.max(0, Number(minOrderAmount !== undefined ? minOrderAmount : minSpend) || 0);
    }

    if (maxDiscountAmount !== undefined || maxDiscount !== undefined) {
      coupon.maxDiscountAmount = Math.max(0, Number(maxDiscountAmount !== undefined ? maxDiscountAmount : maxDiscount) || 0);
    }

    if (usageLimit !== undefined) {
      const limitNum = Number(usageLimit);
      if (isNaN(limitNum) || limitNum < 1) {
        return res.status(400).json({
          success: false,
          message: "Usage limit must be a positive integer",
        });
      }
      if (limitNum < coupon.usedCount) {
        return res.status(400).json({
          success: false,
          message: `Usage limit cannot be less than current redemptions (${coupon.usedCount})`,
        });
      }
      coupon.usageLimit = Math.floor(limitNum);
    }

    if (perUserLimit !== undefined) {
      coupon.perUserLimit = Math.max(1, Number(perUserLimit) || 1);
    }

    if (expiryDate || expiresAt) {
      const parsed = new Date(expiryDate || expiresAt);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(23, 59, 59, 999);
        coupon.expiryDate = parsed;
      }
    }

    if (isActive !== undefined) {
      coupon.isActive = Boolean(isActive);
      coupon.status = coupon.isActive ? "Active" : "Disabled";
    } else if (status !== undefined) {
      coupon.status = status;
      coupon.isActive = status === "Active";
    }

    await coupon.save();

    return res.status(200).json({
      success: true,
      message: `Coupon '${coupon.code}' updated successfully`,
      coupon: coupon.toContractJSON(),
      data: coupon.toContractJSON(),
    });
  } catch (error) {
    console.error("Update Coupon Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update coupon",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/coupon/:id
 * Delete coupon permanently (Admin)
 */
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    let coupon = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      coupon = await Coupon.findByIdAndDelete(id);
    }
    if (!coupon) {
      coupon = await Coupon.findOneAndDelete({ code: String(id).trim().toUpperCase() });
    }

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: `Coupon '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Coupon '${coupon.code}' deleted permanently`,
      id: coupon._id,
    });
  } catch (error) {
    console.error("Delete Coupon Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete coupon",
      error: error.message,
    });
  }
};

/**
 * POST /api/coupon/validate
 * Validates a coupon code against order amount and returns calculated discount (User / Admin)
 */
const validateCouponForOrder = async (req, res) => {
  try {
    const { code, orderAmount } = req.body;
    const cleanCode = String(code || "").trim().toUpperCase();

    if (!cleanCode) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: "Coupon code is required",
      });
    }

    const coupon = await Coupon.findOne({ code: cleanCode });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: `Invalid coupon code '${cleanCode}'`,
      });
    }

    // 1. Status Check
    if (!coupon.isActive || coupon.status === "Disabled") {
      return res.status(400).json({
        success: false,
        valid: false,
        message: `Coupon '${cleanCode}' is currently disabled`,
      });
    }

    // 2. Expiry Check
    const now = Date.now();
    if (coupon.expiryDate && new Date(coupon.expiryDate).getTime() < now) {
      coupon.status = "Expired";
      await coupon.save();
      return res.status(400).json({
        success: false,
        valid: false,
        message: `Coupon '${cleanCode}' has expired`,
      });
    }

    // 3. Usage Limit Check
    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: `Coupon '${cleanCode}' usage limit has been reached`,
      });
    }

    // 4. Minimum Spend Check
    const amountNum = Number(orderAmount) || 0;
    if (coupon.minOrderAmount > 0 && amountNum < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: `Minimum order spend of ₹${coupon.minOrderAmount.toFixed(2)} required for coupon '${cleanCode}'`,
      });
    }

    // 5. Calculate Discount
    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = (amountNum * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount > 0) {
        discount = Math.min(discount, coupon.maxDiscountAmount);
      }
    } else {
      // Fixed / flat discount
      discount = Math.min(amountNum, coupon.discountValue);
    }

    discount = Math.max(0, Number(discount.toFixed(2)));
    const finalAmount = Math.max(0, Number((amountNum - discount).toFixed(2)));

    return res.status(200).json({
      success: true,
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount: discount,
      finalAmount,
      message: `Coupon applied: ₹${discount.toFixed(2)} discount`,
    });
  } catch (error) {
    console.error("Validate Coupon Error:", error);
    return res.status(500).json({
      success: false,
      valid: false,
      message: "Failed to validate coupon",
      error: error.message,
    });
  }
};

module.exports = {
  getCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCouponForOrder,
};
