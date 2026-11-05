const express = require("express");

const reportController = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/roleMiddleware");

// ======================================================
// DEBUG
// ======================================================

console.log("========== REPORT ROUTES LOADED ==========");

console.log(
  "getSalesReport:",
  typeof reportController.getSalesReport
);

console.log(
  "getOrdersReport:",
  typeof reportController.getOrdersReport
);

console.log(
  "getRevenueReport:",
  typeof reportController.getRevenueReport
);

console.log(
  "getProviderPerformanceReport:",
  typeof reportController.getProviderPerformanceReport
);

console.log(
  "getWalletReport:",
  typeof reportController.getWalletReport
);

console.log(
  "getProfitReport:",
  typeof reportController.getProfitReport
);

console.log(
  "getTaxReport:",
  typeof reportController.getTaxReport
);

console.log(
  "authMiddleware:",
  typeof authMiddleware
);

console.log(
  "adminMiddleware:",
  typeof adminMiddleware
);

console.log("===========================================");

// ======================================================
// ROUTER
// ======================================================

const router = express.Router();

// ======================================================
// SALES REPORT
// GET /api/reports/sales
// ======================================================

router.get(
  "/sales",
  authMiddleware,
  adminMiddleware,
  reportController.getSalesReport
);

// ======================================================
// ORDERS REPORT
// GET /api/reports/orders
// ======================================================

router.get(
  "/orders",
  authMiddleware,
  adminMiddleware,
  reportController.getOrdersReport
);

// ======================================================
// REVENUE REPORT
// GET /api/reports/revenue
// ======================================================

router.get(
  "/revenue",
  authMiddleware,
  adminMiddleware,
  reportController.getRevenueReport
);

// ======================================================
// PROVIDER PERFORMANCE REPORT
// GET /api/reports/provider-performance
// ======================================================

router.get(
  "/provider-performance",
  authMiddleware,
  adminMiddleware,
  reportController.getProviderPerformanceReport
);

// ======================================================
// WALLET REPORT
// GET /api/reports/wallet
// ======================================================

router.get(
  "/wallet",
  authMiddleware,
  adminMiddleware,
  reportController.getWalletReport
);

// ======================================================
// PROFIT REPORT
// GET /api/reports/profit
// ======================================================

router.get(
  "/profit",
  authMiddleware,
  adminMiddleware,
  reportController.getProfitReport
);

// ======================================================
// TAX REPORT
// GET /api/reports/tax
// ======================================================

router.get(
  "/tax",
  authMiddleware,
  adminMiddleware,
  reportController.getTaxReport
);

// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = router;