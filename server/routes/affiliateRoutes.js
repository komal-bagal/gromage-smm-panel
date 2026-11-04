const express = require("express");
const {
  getAffiliateOverview,
  getAffiliates,
  getMyAffiliate,
  getAffiliateByCode,
  getAffiliateById,
  createAffiliate,
  updateAffiliate,
  updateAffiliateStatus,
  getAffiliateSettings,
  updateAffiliateSettings,
  getPayoutRequests,
  requestPayout,
  approvePayout,
  rejectPayout,
  recordReferral,
  recordCommission,
} = require("../controllers/affiliateController");
const { authenticate, authorizeAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Specific routes (MUST come before /:id)
router.get("/data", authenticate, authorizeAdmin, getAffiliateOverview);
router.get("/overview", authenticate, authorizeAdmin, getAffiliateOverview);

router.get("/settings", authenticate, authorizeAdmin, getAffiliateSettings);
router.put("/settings", authenticate, authorizeAdmin, updateAffiliateSettings);

router.get("/me", authenticate, getMyAffiliate);
router.get("/code/:code", getAffiliateByCode);

router.post("/referral", recordReferral);
router.post("/commission", authenticate, recordCommission);

// Payouts
router.get("/payouts", authenticate, getPayoutRequests);
router.post("/payout", authenticate, requestPayout);
router.post("/payout/:id/approve", authenticate, authorizeAdmin, approvePayout);
router.patch("/payout/:id/approve", authenticate, authorizeAdmin, approvePayout);
router.post("/payout/:id/reject", authenticate, authorizeAdmin, rejectPayout);
router.patch("/payout/:id/reject", authenticate, authorizeAdmin, rejectPayout);

// Status toggles
router.patch("/:id/activate", authenticate, authorizeAdmin, (req, res, next) => {
  req.params.action = "activate";
  next();
}, updateAffiliateStatus);
router.patch("/:id/deactivate", authenticate, authorizeAdmin, (req, res, next) => {
  req.params.action = "deactivate";
  next();
}, updateAffiliateStatus);

// Base Collection Routes
router.get("/", authenticate, authorizeAdmin, getAffiliates);
router.post("/", authenticate, createAffiliate);
router.get("/:id", authenticate, authorizeAdmin, getAffiliateById);
router.put("/:id", authenticate, authorizeAdmin, updateAffiliate);

module.exports = router;
