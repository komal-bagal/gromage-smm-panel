
const {
  createAffiliate,
  getAffiliateByUser,
  getAffiliateByReferralCode,
  addReferral,
  addCommission,
  markEarningsPaid,
  deactivateAffiliate,
  activateAffiliate,
} = require("../services/affiliateService");

// ======================================================
// CREATE AFFILIATE
// ======================================================

const createAffiliateController = async (req, res) => {
  try {
    const loggedInUserId = req.user?.id || req.user?._id;

    if (!loggedInUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const isAdmin = req.user.role === "admin";

    const userId = isAdmin
      ? req.body?.userId || loggedInUserId
      : loggedInUserId;

    const commissionRate =
      req.body?.commissionRate !== undefined
        ? Number(req.body.commissionRate)
        : 5;

    const affiliate = await createAffiliate({
      userId,
      commissionRate,
    });

    return res.status(201).json({
      success: true,
      message: "Affiliate profile created successfully",
      data: affiliate,
    });
  } catch (error) {
    console.error("CREATE AFFILIATE ERROR:", error);

    return res.status(400).json({
      success: false,
      message:
        error.message || "Failed to create affiliate profile",
    });
  }
};

// ======================================================
// GET MY AFFILIATE
// ======================================================

const getMyAffiliate = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const affiliate = await getAffiliateByUser(userId);

    return res.status(200).json({
      success: true,
      data: affiliate,
    });
  } catch (error) {
    console.error("GET MY AFFILIATE ERROR:", error);

    return res.status(404).json({
      success: false,
      message:
        error.message || "Affiliate profile not found",
    });
  }
};

// ======================================================
// GET AFFILIATE BY REFERRAL CODE
// ======================================================

const getAffiliateByCodeController = async (req, res) => {
  try {
    const affiliate =
      await getAffiliateByReferralCode(req.params.code);

    return res.status(200).json({
      success: true,
      data: affiliate,
    });
  } catch (error) {
    console.error(
      "GET AFFILIATE BY CODE ERROR:",
      error
    );

    return res.status(404).json({
      success: false,
      message:
        error.message || "Affiliate not found",
    });
  }
};

// ======================================================
// ADD REFERRAL
// ======================================================

const addReferralController = async (req, res) => {
  try {
    // Safe handling when req.body is undefined
    const { referralCode } = req.body || {};

    /*
     * IMPORTANT:
     * The referred user must always be the currently
     * authenticated user.
     *
     * We do NOT accept referredUserId from req.body.
     * This prevents one user from creating a referral
     * relationship for another user.
     */
    const referredUserId =
      req.user?.id || req.user?._id;

    if (!referredUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const affiliate = await addReferral({
      referralCode,
      referredUserId,
    });

    return res.status(200).json({
      success: true,
      message: "Referral added successfully",
      data: affiliate,
    });
  } catch (error) {
    console.error("ADD REFERRAL ERROR:", error);

    return res.status(400).json({
      success: false,
      message:
        error.message || "Failed to add referral",
    });
  }
};

// ======================================================
// ADD COMMISSION
// ======================================================

const addCommissionController = async (req, res) => {
  try {
    const {
      affiliateId,
      orderId,
      orderAmount,
    } = req.body || {};

    const result = await addCommission({
      affiliateId,
      orderId,
      orderAmount: Number(orderAmount),
    });

    return res.status(200).json({
      success: true,
      message: "Affiliate commission added successfully",
      data: {
        commission: result.commission,
        affiliate: result.affiliate,
      },
    });
  } catch (error) {
    console.error(
      "ADD AFFILIATE COMMISSION ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message || "Failed to add commission",
    });
  }
};

// ======================================================
// MARK EARNINGS PAID
// ======================================================

const markEarningsPaidController = async (
  req,
  res
) => {
  try {
    const {
      affiliateId,
      amount,
      payoutReference,
    } = req.body || {};

    const affiliate = await markEarningsPaid({
      affiliateId,
      amount: Number(amount),
      payoutReference,
    });

    return res.status(200).json({
      success: true,
      message: "Affiliate earnings marked as paid",
      data: affiliate,
    });
  } catch (error) {
    console.error(
      "MARK AFFILIATE EARNINGS PAID ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to mark earnings as paid",
    });
  }
};

// ======================================================
// DEACTIVATE AFFILIATE
// ======================================================

const deactivateAffiliateController = async (
  req,
  res
) => {
  try {
    const affiliate =
      await deactivateAffiliate(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Affiliate deactivated successfully",
      data: affiliate,
    });
  } catch (error) {
    console.error(
      "DEACTIVATE AFFILIATE ERROR:",
      error
    );

    return res.status(404).json({
      success: false,
      message:
        error.message ||
        "Failed to deactivate affiliate",
    });
  }
};

// ======================================================
// ACTIVATE AFFILIATE
// ======================================================

const activateAffiliateController = async (
  req,
  res
) => {
  try {
    const affiliate =
      await activateAffiliate(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Affiliate activated successfully",
      data: affiliate,
    });
  } catch (error) {
    console.error(
      "ACTIVATE AFFILIATE ERROR:",
      error
    );

    return res.status(404).json({
      success: false,
      message:
        error.message ||
        "Failed to activate affiliate",
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createAffiliateController,
  getMyAffiliate,
  getAffiliateByCodeController,
  addReferralController,
  addCommissionController,
  markEarningsPaidController,
  deactivateAffiliateController,
  activateAffiliateController,
};
