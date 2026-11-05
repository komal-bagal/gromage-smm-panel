const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const permissionMiddleware = require("../middleware/permissionMiddleware");

const {
  getPaymentSettings,
  updatePaymentSettings,
  getInvoiceSettings,
  updateInvoiceSettings
} = require("../controllers/settingsController");

// ======================================================
// PAYMENT SETTINGS
// ======================================================

router.get(
  "/payment",
  authMiddleware,
  permissionMiddleware("payment.view"),
  getPaymentSettings
);

router.put(
  "/payment",
  express.json(),
  authMiddleware,
  permissionMiddleware("payment.approve"),
  updatePaymentSettings
);

// ======================================================
// INVOICE / GST SETTINGS
// ======================================================

router.get(
  "/invoice",
  authMiddleware,
  permissionMiddleware("payment.view"),
  getInvoiceSettings
);

router.put(
  "/invoice",
  express.json(),
  authMiddleware,
  permissionMiddleware("payment.approve"),
  updateInvoiceSettings
);

module.exports = router;