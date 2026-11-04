const express = require("express");
const {
  getOrders,
  getOrderById,
  createOrder,
  createMassOrders,
  updateOrderStatus,
  cancelAndRefundOrder,
  refillOrder,
  syncOrder,
  getOrderLogs,
  deleteOrder,
} = require("../controllers/orderController");
const {
  authenticate,
  authorizeAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

// Order listing & search
router.get("/", authenticate, getOrders);

// Bulk mass order creation
router.post("/mass", authenticate, createMassOrders);

// Order details & logs
router.get("/:id/logs", authenticate, getOrderLogs);
router.get("/:id", authenticate, getOrderById);

// Order creation (handles single or mass array if forwarded)
router.post("/", authenticate, (req, res, next) => {
  if (req.body && Array.isArray(req.body.orders)) {
    return createMassOrders(req, res, next);
  }
  return createOrder(req, res, next);
});

// Order mutations
router.patch("/:id/status", authenticate, authorizeAdmin, updateOrderStatus);
router.post("/:id/cancel", authenticate, authorizeAdmin, cancelAndRefundOrder);
router.post("/:id/refill", authenticate, authorizeAdmin, refillOrder);
router.post("/:id/sync", authenticate, authorizeAdmin, syncOrder);
router.delete("/:id", authenticate, authorizeAdmin, deleteOrder);

module.exports = router;
