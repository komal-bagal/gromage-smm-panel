const express = require("express");

const router = express.Router();

const authMiddleware =
  require("../middleware/authMiddleware");

const adminMiddleware =
  require("../middleware/roleMiddleware");

const {
  createOrder,
  getAllOrders,
  getMyOrders,
  getOrderById,
  getOrderStatusLogs,
  updateOrderStatus,
  deleteOrder,
  syncOrderProviderStatus,
  requestOrderRefill,
  cancelOrder
} = require("../controllers/orderController");

// ======================================================
// CREATE ORDER
// ======================================================

router.post(
  "/",
  authMiddleware,
  createOrder
);

// ======================================================
// GET ALL ORDERS
// ADMIN / STAFF
// ======================================================

router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  getAllOrders
);

// ======================================================
// GET MY ORDERS
// ======================================================

router.get(
  "/my",
  authMiddleware,
  getMyOrders
);

// ======================================================
// SYNC ORDER PROVIDER STATUS
// ======================================================

router.post(
  "/:orderId/sync",
  authMiddleware,
  syncOrderProviderStatus
);

// ======================================================
// REQUEST ORDER REFILL
// ======================================================

router.post(
  "/:orderId/refill",
  authMiddleware,
  requestOrderRefill
);

// ======================================================
// CANCEL ORDER
// ======================================================

router.post(
  "/:orderId/cancel",
  authMiddleware,
  cancelOrder
);

// ======================================================
// GET ORDER STATUS LOGS
// ======================================================

router.get(
  "/:orderId/logs",
  authMiddleware,
  getOrderStatusLogs
);

// ======================================================
// GET ORDER BY ID
// ======================================================

router.get(
  "/:orderId",
  authMiddleware,
  getOrderById
);

// ======================================================
// UPDATE ORDER STATUS
// ADMIN / STAFF
// ======================================================

router.patch(
  "/:orderId/status",
  authMiddleware,
  adminMiddleware,
  updateOrderStatus
);

// ======================================================
// DELETE ORDER
// ADMIN / STAFF
// ======================================================

router.delete(
  "/:orderId",
  authMiddleware,
  adminMiddleware,
  deleteOrder
);

module.exports = router;