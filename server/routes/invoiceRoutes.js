
const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const adminMiddleware = require("../middleware/roleMiddleware");

const {
  createOrderInvoice,
  createRechargeInvoice,
  getInvoiceById,
  generateInvoicePDF,
  getMyInvoices,
  getAllInvoices
} = require("../controllers/invoiceController");

// ======================================================
// USER INVOICES
// ======================================================

// Create invoice for an order
router.post(
  "/order",
  authMiddleware,
  createOrderInvoice
);

// Create invoice for a completed recharge
router.post(
  "/recharge",
  authMiddleware,
  createRechargeInvoice
);

// Get logged-in user's invoices
router.get(
  "/my",
  authMiddleware,
  getMyInvoices
);

// Generate invoice PDF
router.get(
  "/:invoiceId/pdf",
  authMiddleware,
  generateInvoicePDF
);

// Get invoice by ID
router.get(
  "/:invoiceId",
  authMiddleware,
  getInvoiceById
);

// ======================================================
// ADMIN INVOICES
// ======================================================

// Get all invoices
router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  getAllInvoices
);

console.log("INVOICE ROUTES LOADED");

module.exports = router;
