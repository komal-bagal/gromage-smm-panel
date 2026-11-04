const express = require("express");
const {
  getCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCouponForOrder,
} = require("../controllers/couponController");
const { authenticate, authorizeAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Specific routes before :id
router.post("/validate", authenticate, validateCouponForOrder);

// Admin-only CRUD operations
router.get("/", authenticate, authorizeAdmin, getCoupons);
router.post("/", authenticate, authorizeAdmin, createCoupon);
router.get("/:id", authenticate, authorizeAdmin, getCouponById);
router.put("/:id", authenticate, authorizeAdmin, updateCoupon);
router.delete("/:id", authenticate, authorizeAdmin, deleteCoupon);

module.exports = router;
