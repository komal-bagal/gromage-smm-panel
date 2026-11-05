const express = require("express");

const router = express.Router();

console.log("PROVIDER ROUTES LOADED");

// ======================================================
// MIDDLEWARE
// ======================================================

const authMiddleware =
  require("../middleware/authMiddleware");

const adminMiddleware =
  require("../middleware/roleMiddleware");

// ======================================================
// PROVIDER LOG ROUTES
// ======================================================

const providerLogRoutes =
  require("./providerLogRoutes");

// ======================================================
// PROVIDER CONTROLLER
// ======================================================

const {
  createProvider,
  getAllProviders,
  getProviderById,
  updateProvider,
  deleteProvider,
  updateProviderStatus,
  updateProviderPriority,
  testProviderConnection,
  getProviderBalance,
  syncProviderServices,
  importSelectedProviderServices
} = require("../controllers/providerController");

// ======================================================
// PROVIDER API CONTROLLER
// ======================================================

const {
  syncOrderStatus,
  cancelOrder,
  refillOrder
} = require("../controllers/providerApiController");

// ======================================================
// GET ALL PROVIDERS
// ======================================================

router.get(
  "/",
  authMiddleware,
  getAllProviders
);

// ======================================================
// PROVIDER LOGS
// ======================================================
//
// GET:
//
// /api/provider/logs
//
// Purpose:
//
// Fetch provider API logs with filtering
// and pagination.
//
// ======================================================

router.use(
  "/logs",
  providerLogRoutes
);

// ======================================================
// TEST PROVIDER CONNECTION
// ======================================================

router.post(
  "/:providerId/test-connection",
  authMiddleware,
  adminMiddleware,
  testProviderConnection
);

// ======================================================
// GET PROVIDER BALANCE
// ======================================================
//
// POST:
//
// /api/provider/:providerId/balance
//
// Purpose:
//
// Fetch current balance from the provider.
//
// ======================================================

router.post(
  "/:providerId/balance",
  authMiddleware,
  adminMiddleware,
  getProviderBalance
);

// ======================================================
// SYNC PROVIDER SERVICES
// ======================================================

router.post(
  "/:providerId/sync",
  authMiddleware,
  adminMiddleware,
  syncProviderServices
);

// ======================================================
// IMPORT SELECTED PROVIDER SERVICES
// ======================================================
//
// POST:
//
// /api/provider/:providerId/import-selected
//
// Body:
//
// {
//   "serviceIds": ["1001", "1003"]
// }
//
// Purpose:
//
// Import only selected services from the provider.
//
// ======================================================

router.post(
  "/:providerId/import-selected",
  authMiddleware,
  adminMiddleware,
  importSelectedProviderServices
);

// ======================================================
// UPDATE PROVIDER PRIORITY
// ======================================================
//
// PATCH:
//
// /api/provider/:providerId/priority
//
// Body:
//
// {
//   "priority": 1
// }
//
// Lower priority number = higher priority.
//
// Example:
//
// priority 1 -> First provider
// priority 2 -> Second provider
// priority 3 -> Third provider
//
// ======================================================

router.patch(
  "/:providerId/priority",
  authMiddleware,
  adminMiddleware,
  updateProviderPriority
);

// ======================================================
// SYNC ORDER STATUS FROM PROVIDER
// ======================================================
//
// POST:
//
// /api/provider/orders/:orderId/sync-status
//
// Purpose:
//
// Fetch latest order status from provider and
// update local order status, startCount and remains.
//
// ======================================================

router.post(
  "/orders/:orderId/sync-status",
  authMiddleware,
  adminMiddleware,
  syncOrderStatus
);

// ======================================================
// CANCEL ORDER AT PROVIDER
// ======================================================
//
// POST:
//
// /api/provider/orders/:orderId/cancel
//
// Purpose:
//
// Cancel an eligible order at the provider and
// update the local order status to canceled.
//
// ======================================================

router.post(
  "/orders/:orderId/cancel",
  authMiddleware,
  adminMiddleware,
  cancelOrder
);

// ======================================================
// REFILL ORDER AT PROVIDER
// ======================================================
//
// POST:
//
// /api/provider/orders/:orderId/refill
//
// Purpose:
//
// Request refill for an eligible order where the
// service/provider supports refill.
//
// ======================================================

router.post(
  "/orders/:orderId/refill",
  authMiddleware,
  adminMiddleware,
  refillOrder
);

// ======================================================
// GET PROVIDER BY ID
// ======================================================

router.get(
  "/:providerId",
  authMiddleware,
  getProviderById
);

// ======================================================
// CREATE PROVIDER
// ======================================================

router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  createProvider
);

// ======================================================
// UPDATE PROVIDER
// ======================================================

router.put(
  "/:providerId",
  authMiddleware,
  adminMiddleware,
  updateProvider
);

// ======================================================
// UPDATE PROVIDER STATUS
// ======================================================

router.patch(
  "/:providerId/status",
  authMiddleware,
  adminMiddleware,
  updateProviderStatus
);

// ======================================================
// DELETE PROVIDER
// ======================================================

router.delete(
  "/:providerId",
  authMiddleware,
  adminMiddleware,
  deleteProvider
);

// ======================================================
// EXPORT
// ======================================================

module.exports = router;