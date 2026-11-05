const express = require("express");

const {
  createResellerController,
  getMyReseller,
  getResellerByCodeController,
  calculateResellerPriceController,
  recordResellerOrderController,
  addResellerEarningsController,
  addResellerBalanceController,
  updateResellerMarkupController,
  regenerateApiKeyController,
  enableApiController,
  disableApiController,
  getResellerApiBalanceController,
  getResellerApiServicesController,
  suspendResellerController,
  activateResellerController,
} = require("../controllers/resellerController");

const {
  createResellerOrder,
} = require("../controllers/orderController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/roleMiddleware");
const resellerApiMiddleware = require("../middleware/resellerApiMiddleware");

const router = express.Router();

// ======================================================
// RESELLER MANAGEMENT
// ======================================================

// Creating reseller profiles should be admin-controlled.
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  createResellerController
);

// User's own reseller profile.
router.get(
  "/me",
  authMiddleware,
  getMyReseller
);

// Authenticated users can resolve an active reseller by code.
// Controller/service must return only safe public reseller data.
router.get(
  "/code/:code",
  authMiddleware,
  getResellerByCodeController
);

// Self-service price calculation.
// Controller must verify reseller ownership.
router.post(
  "/calculate-price",
  authMiddleware,
  calculateResellerPriceController
);

// Reseller order/statistics operation.
// Controller must verify ownership.
router.post(
  "/order",
  authMiddleware,
  recordResellerOrderController
);

// Earnings are financial/admin-controlled.
router.post(
  "/earnings",
  authMiddleware,
  adminMiddleware,
  addResellerEarningsController
);

// ======================================================
// ADD RESELLER BALANCE
// ======================================================

router.post(
  "/add-balance",
  authMiddleware,
  adminMiddleware,
  addResellerBalanceController
);

// ======================================================
// RESELLER MARKUP
// ======================================================

// Self-service.
// Controller must restrict this to req.userId's reseller.
router.put(
  "/markup",
  authMiddleware,
  updateResellerMarkupController
);

// ======================================================
// RESELLER API
// ======================================================

router.get(
  "/api/balance",
  resellerApiMiddleware,
  getResellerApiBalanceController
);

router.get(
  "/api/services",
  resellerApiMiddleware,
  getResellerApiServicesController
);

// ======================================================
// RESELLER API ORDER
// ======================================================

router.post(
  "/api/order",
  resellerApiMiddleware,
  createResellerOrder
);

// ======================================================
// API KEY MANAGEMENT
// ======================================================

// Admin-only because this changes another user's credential.
router.post(
  "/:id/regenerate-api-key",
  authMiddleware,
  adminMiddleware,
  regenerateApiKeyController
);

router.patch(
  "/:id/enable-api",
  authMiddleware,
  adminMiddleware,
  enableApiController
);

router.patch(
  "/:id/disable-api",
  authMiddleware,
  adminMiddleware,
  disableApiController
);

// ======================================================
// RESELLER STATUS
// ======================================================

router.patch(
  "/:id/suspend",
  authMiddleware,
  adminMiddleware,
  suspendResellerController
);

router.patch(
  "/:id/activate",
  authMiddleware,
  adminMiddleware,
  activateResellerController
);

module.exports = router;