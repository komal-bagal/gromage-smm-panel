
const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const permissionMiddleware = require(
  "../middleware/permissionMiddleware"
);

const {
  getAllPayments,
  getPaymentById,
  approveRecharge,
  rejectRecharge,
  paymentWebhook,
  paytmCallback,
  cashfreeWebhook,
} = require("../controllers/paymentController");

// ======================================================
// GET ALL PAYMENTS
// GET /api/payments
// Requires authentication and payment.view permission
// ======================================================

router.get(
  "/",
  authMiddleware,
  permissionMiddleware("payment.view"),
  getAllPayments
);

// ======================================================
// GENERIC PAYMENT WEBHOOK
// POST /api/payments/webhook
// ======================================================

router.post(
  "/webhook",
  paymentWebhook
);

// ======================================================
// PAYTM CALLBACK
// POST /api/payments/paytm/callback
// ======================================================

router.post(
  "/paytm/callback",
  paytmCallback
);

// ======================================================
// CASHFREE WEBHOOK
// POST /api/payments/cashfree/webhook
// Verifies the Cashfree signature in the controller
// ======================================================

router.post(
  "/cashfree/webhook",
  cashfreeWebhook
);

// ======================================================
// GET PAYMENT BY ID
// GET /api/payments/:paymentId
// Requires authentication and payment.view permission
// ======================================================

router.get(
  "/:paymentId",
  authMiddleware,
  permissionMiddleware("payment.view"),
  getPaymentById
);

// ======================================================
// APPROVE RECHARGE
// POST /api/payments/:paymentId/approve
// Requires authentication and payment.approve permission
// ======================================================

router.post(
  "/:paymentId/approve",
  authMiddleware,
  permissionMiddleware("payment.approve"),
  approveRecharge
);

// ======================================================
// REJECT RECHARGE
// POST /api/payments/:paymentId/reject
// Requires authentication and payment.reject permission
// ======================================================

router.post(
  "/:paymentId/reject",
  authMiddleware,
  permissionMiddleware("payment.reject"),
  rejectRecharge
);

module.exports = router;
