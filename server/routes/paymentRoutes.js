const express = require("express");
const {
  getPayments,
  getPaymentById,
  approvePayment,
  rejectPayment,
  recordManualTransaction,
  creditWallet,
  debitWallet,
  rechargeWallet,
} = require("../controllers/paymentController");
const { authenticate, authorizeAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Specific routes before parameterized :id
router.post("/manual", authenticate, authorizeAdmin, recordManualTransaction);
router.post("/credit", authenticate, authorizeAdmin, creditWallet);
router.post("/debit", authenticate, authorizeAdmin, debitWallet);
router.post("/recharge", authenticate, rechargeWallet);

// Listing & creation
router.get("/", authenticate, authorizeAdmin, getPayments);
router.post("/", authenticate, authorizeAdmin, recordManualTransaction);

// Parameterized routes
router.get("/:id", authenticate, authorizeAdmin, getPaymentById);
router.post("/:id/approve", authenticate, authorizeAdmin, approvePayment);
router.post("/:id/reject", authenticate, authorizeAdmin, rejectPayment);

module.exports = router;
