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
  paymentWebhook
} = require("../controllers/paymentController");


// ======================================================
// GET ALL PAYMENTS
// ======================================================

router.get(
  "/",
  authMiddleware,
  permissionMiddleware("payment.view"),
  getAllPayments
);


// ======================================================
// PAYMENT WEBHOOK
// ======================================================

router.post(
  "/webhook",
  paymentWebhook
);


// ======================================================
// GET PAYMENT BY ID
// ======================================================

router.get(
  "/:paymentId",
  authMiddleware,
  permissionMiddleware("payment.view"),
  getPaymentById
);


// ======================================================
// APPROVE RECHARGE
// ======================================================

router.post(
  "/:paymentId/approve",
  authMiddleware,
  permissionMiddleware("payment.approve"),
  approveRecharge
);


// ======================================================
// REJECT RECHARGE
// ======================================================

router.post(
  "/:paymentId/reject",
  authMiddleware,
  permissionMiddleware("payment.reject"),
  rejectRecharge
);


module.exports = router;