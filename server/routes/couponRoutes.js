const express = require("express");

const {
  createCoupon,
  getCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCouponController,
} = require("../controllers/couponController");

const {
  getCouponUsage,
} = require("../services/couponService");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();


// =====================================================
// VALIDATE COUPON
// USER ACCESS
// =====================================================

router.post(
  "/validate",
  authMiddleware,
  validateCouponController
);


// =====================================================
// GET COUPON USAGE
// ADMIN ONLY
// IMPORTANT: THIS MUST COME BEFORE /:id
// =====================================================

router.get(
  "/usage",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const usage = await getCouponUsage({
        couponId: req.query.couponId,
        userId: req.query.userId,
        orderId: req.query.orderId,
      });

      return res.status(200).json({
        success: true,
        count: usage.length,
        data: usage,
      });
    } catch (error) {
      console.error("GET COUPON USAGE ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to get coupon usage",
      });
    }
  }
);


// =====================================================
// CREATE COUPON
// ADMIN ONLY
// =====================================================

router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  createCoupon
);


// =====================================================
// GET ALL COUPONS
// ADMIN ONLY
// =====================================================

router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  getCoupons
);


// =====================================================
// GET COUPON BY ID
// ADMIN ONLY
// =====================================================

router.get(
  "/:id",
  authMiddleware,
  adminMiddleware,
  getCouponById
);


// =====================================================
// UPDATE COUPON
// ADMIN ONLY
// =====================================================

router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  updateCoupon
);


// =====================================================
// DELETE COUPON
// ADMIN ONLY
// =====================================================

router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  deleteCoupon
);


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;