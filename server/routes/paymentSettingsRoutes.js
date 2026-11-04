const express = require("express");
const {
  getPaymentSettings,
  updatePaymentSettings,
} = require("../controllers/paymentSettingsController");
const {
  authenticate,
  authorizeAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticate, authorizeAdmin, getPaymentSettings);
router.put("/", authenticate, authorizeAdmin, updatePaymentSettings);

module.exports = router;
