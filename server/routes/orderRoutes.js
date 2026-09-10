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
  syncOrderProviderStatus
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
// ADMIN ONLY
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
// ADMIN ONLY
// ======================================================

router.patch(
  "/:orderId/status",
  authMiddleware,
  adminMiddleware,
  updateOrderStatus
);

// ======================================================
// DELETE ORDER
// ADMIN ONLY
// ======================================================

router.delete(
  "/:orderId",
  authMiddleware,
  adminMiddleware,
  deleteOrder
);

module.exports = router;