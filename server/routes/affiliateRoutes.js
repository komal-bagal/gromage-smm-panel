const express = require("express");

const {
  createAffiliateController,
  getMyAffiliate,
  getAffiliateByCodeController,
  addReferralController,
  addCommissionController,
  markEarningsPaidController,
  deactivateAffiliateController,
  activateAffiliateController,
} = require("../controllers/affiliateController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// ======================================================
// USER / AFFILIATE ROUTES
// ======================================================

// Create own affiliate profile
router.post(
  "/",
  authMiddleware,
  createAffiliateController
);

// Get logged-in user's affiliate profile
router.get(
  "/me",
  authMiddleware,
  getMyAffiliate
);

// Get affiliate using referral code
router.get(
  "/code/:code",
  authMiddleware,
  getAffiliateByCodeController
);

// Add referral
router.post(
  "/referral",
  authMiddleware,
  addReferralController
);

// ======================================================
// ADMIN-ONLY ROUTES
// ======================================================

// Manually add affiliate commission
router.post(
  "/commission",
  authMiddleware,
  adminMiddleware,
  addCommissionController
);

// Mark affiliate earnings as paid
router.post(
  "/earnings/paid",
  authMiddleware,
  adminMiddleware,
  markEarningsPaidController
);

// Deactivate affiliate
router.patch(
  "/:id/deactivate",
  authMiddleware,
  adminMiddleware,
  deactivateAffiliateController
);

// Activate affiliate
router.patch(
  "/:id/activate",
  authMiddleware,
  adminMiddleware,
  activateAffiliateController
);

module.exports = router;