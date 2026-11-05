
const express = require("express");

const router = express.Router();

const authMiddleware =
  require("../middleware/authMiddleware");

const {
  createMassOrder,
  getMassOrderById,
  getMyMassOrders
} = require("../controllers/massOrderController");

// ======================================================
// CREATE MASS ORDER
// ======================================================

router.post(
  "/",
  authMiddleware,
  createMassOrder
);

// ======================================================
// GET MY MASS ORDERS
// ======================================================

router.get(
  "/my",
  authMiddleware,
  getMyMassOrders
);

// ======================================================
// GET MASS ORDER BY ID
// ======================================================

router.get(
  "/:massOrderId",
  authMiddleware,
  getMassOrderById
);

module.exports = router;
