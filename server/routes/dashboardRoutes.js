const express = require("express");
const { getDashboardMetrics } = require("../controllers/dashboardController");
const { authenticate, authorizeAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Protected Admin Dashboard Metrics Endpoint
router.get("/", authenticate, authorizeAdmin, getDashboardMetrics);
router.get("/metrics", authenticate, authorizeAdmin, getDashboardMetrics);

module.exports = router;
