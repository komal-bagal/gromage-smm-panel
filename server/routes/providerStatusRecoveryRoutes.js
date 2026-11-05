const express = require("express");

const router = express.Router();

const authMiddleware =
  require("../middleware/authMiddleware");

const adminMiddleware =
  require("../middleware/roleMiddleware");

const {
  retryFailedStatus
} = require("../controllers/providerStatusRecoveryController");

router.post(
  "/:orderId/retry",
  authMiddleware,
  adminMiddleware,
  retryFailedStatus
);

module.exports = router;