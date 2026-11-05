
const express = require("express");

const router = express.Router();

const authMiddleware =
  require("../middleware/authMiddleware");

const adminMiddleware =
  require("../middleware/roleMiddleware");

const {
  syncServices
} = require("../controllers/providerSyncController");

// ======================================================
// PROVIDER SYNC DEBUG
// ======================================================

console.log("========== PROVIDER SYNC DEBUG ==========");
console.log(
  "authMiddleware:",
  typeof authMiddleware
);

console.log(
  "adminMiddleware:",
  typeof adminMiddleware
);

console.log(
  "syncServices:",
  typeof syncServices
);

console.log("==========================================");

// ======================================================
// PROVIDER SERVICE SYNC
// ======================================================

router.post(
  "/:providerId/sync-services",
  authMiddleware,
  adminMiddleware,
  syncServices
);

// ======================================================
// EXPORT
// ======================================================

module.exports = router;
