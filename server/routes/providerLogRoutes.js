// ======================================================
// PROVIDER LOG ROUTES
// ======================================================

const express = require("express");

const router = express.Router();

const authMiddleware =
  require("../middleware/authMiddleware");

const adminMiddleware =
  require("../middleware/roleMiddleware");

const {
  getProviderLogs
} = require("../controllers/providerLogController");

// ======================================================
// DEBUG
// ======================================================

console.log(
  "PROVIDER LOG ROUTES LOADED"
);

console.log(
  "getProviderLogs:",
  typeof getProviderLogs
);

// ======================================================
// GET PROVIDER LOGS
// ======================================================

router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  getProviderLogs
);

// ======================================================
// EXPORT
// ======================================================

module.exports = router;