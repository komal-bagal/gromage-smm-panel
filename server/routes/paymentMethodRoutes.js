const express = require("express");

const {
  createPaymentMethod,
  getAllPaymentMethods,
  getPublicPaymentMethods,
  getPaymentMethodById,
  updatePaymentMethod,
  deletePaymentMethod
} = require("../controllers/paymentMethodController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// Public payment methods
router.get("/public", getPublicPaymentMethods);

// Admin-only payment method management
router.post("/", authMiddleware, roleMiddleware, createPaymentMethod);

router.get(
  "/",
  authMiddleware,
  roleMiddleware,
  getAllPaymentMethods
);

router.get(
  "/:id",
  authMiddleware,
  roleMiddleware,
  getPaymentMethodById
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware,
  updatePaymentMethod
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware,
  deletePaymentMethod
);

module.exports = router;