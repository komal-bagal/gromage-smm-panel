const mongoose = require("mongoose");
const Affiliate = require("../models/Affiliate");
const AffiliatePayout = require("../models/AffiliatePayout");
const AffiliateSetting = require("../models/AffiliateSetting");
const Payment = require("../models/Payment");
const User = require("../models/User");

/**
 * GET /api/affiliate/data or GET /api/affiliate/overview
 * Overview data bundle matching getAffiliateData() in adminService.js (Admin)
 */
const getAffiliateOverview = async (req, res) => {
  try {
    const settings = await AffiliateSetting.getSettings();
    const affiliates = await Affiliate.find().sort({ createdAt: -1 });
    const payoutRequests = await AffiliatePayout.find().sort({ createdAt: -1 });

    const totalAffiliates = affiliates.length;
    const activeAffiliates = affiliates.filter((a) => a.isActive && a.status === "Active").length;
    const totalReferrals = affiliates.reduce((acc, a) => acc + (a.referralCount || 0), 0);
    const totalCommission = affiliates.reduce((acc, a) => acc + (a.totalEarnings || 0), 0);
    const paidEarnings = affiliates.reduce((acc, a) => acc + (a.paidEarnings || 0), 0);

    const pendingPayoutsNum = payoutRequests
      .filter((p) => p.status === "Pending")
      .reduce((acc, p) => acc + Number(p.amount || 0), 0);

    return res.status(200).json({
      success: true,
      totalAffiliates,
      activeAffiliates,
      totalReferrals,
      totalCommission: Number(totalCommission.toFixed(2)),
      paidCommissions: `₹${paidEarnings.toLocaleString("en-IN")}`,
      pendingPayouts: `₹${pendingPayoutsNum.toLocaleString("en-IN")}`,
      commissionRate: settings.commissionRate,
      minPayout: settings.minPayout,
      cookieDays: settings.cookieDays,
      affiliates: affiliates.map((a) => a.toContractJSON()),
      payoutRequests: payoutRequests.map((p) => p.toContractJSON()),
    });
  } catch (error) {
    console.error("Get Affiliate Overview Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve affiliate overview",
      error: error.message,
    });
  }
};

/**
 * GET /api/affiliate
 * List all affiliate partners with optional search and status filtering (Admin)
 */
const getAffiliates = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.status = new RegExp(`^${status}$`, "i");
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      const regex = new RegExp(q, "i");
      filter.$or = [
        { user: regex },
        { email: regex },
        { referralCode: regex },
        { affiliateId: regex },
      ];
    }

    const affiliates = await Affiliate.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: affiliates.length,
      affiliates: affiliates.map((a) => a.toContractJSON()),
      data: affiliates.map((a) => a.toContractJSON()),
    });
  } catch (error) {
    console.error("Get Affiliates Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch affiliate partners",
      error: error.message,
    });
  }
};

/**
 * GET /api/affiliate/me
 * Retrieve personal affiliate details for authenticated user (User / Admin)
 */
const getMyAffiliate = async (req, res) => {
  try {
    const userId = req.user?._id;
    const email = req.user?.email;

    const query = [];
    if (userId) query.push({ userId });
    if (email) query.push({ email: String(email).toLowerCase() });

    const affiliate = await Affiliate.findOne({ $or: query });
    if (!affiliate) {
      return res.status(200).json({
        success: true,
        enrolled: false,
        affiliate: null,
      });
    }

    return res.status(200).json({
      success: true,
      enrolled: true,
      affiliate: affiliate.toContractJSON(),
      data: affiliate.toContractJSON(),
    });
  } catch (error) {
    console.error("Get My Affiliate Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch personal affiliate data",
      error: error.message,
    });
  }
};

/**
 * GET /api/affiliate/code/:code
 * Public / Authenticated check for valid referral code
 */
const getAffiliateByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const cleanCode = String(code || "").trim().toUpperCase();

    if (!cleanCode) {
      return res.status(400).json({
        success: false,
        message: "Referral code is required",
      });
    }

    const affiliate = await Affiliate.findOne({ referralCode: cleanCode });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: `Referral code '${cleanCode}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      affiliate: affiliate.toContractJSON(),
      data: affiliate.toContractJSON(),
    });
  } catch (error) {
    console.error("Get Affiliate by Code Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to lookup referral code",
      error: error.message,
    });
  }
};

/**
 * GET /api/affiliate/:id
 * Retrieve single affiliate partner by ID (Admin)
 */
const getAffiliateById = async (req, res) => {
  try {
    const { id } = req.params;
    let affiliate = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      affiliate = await Affiliate.findById(id);
    }
    if (!affiliate) {
      affiliate = await Affiliate.findOne({
        $or: [{ affiliateId: id }, { referralCode: String(id).toUpperCase() }],
      });
    }

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: `Affiliate partner '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      affiliate: affiliate.toContractJSON(),
      data: affiliate.toContractJSON(),
    });
  } catch (error) {
    console.error("Get Affiliate Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch affiliate details",
      error: error.message,
    });
  }
};

/**
 * POST /api/affiliate
 * Enroll a new affiliate partner (Admin or Authenticated User)
 */
const createAffiliate = async (req, res) => {
  try {
    const {
      user,
      email,
      userId,
      referralCode,
      code,
      commissionRate,
      status,
    } = req.body;

    const settings = await AffiliateSetting.getSettings();

    // 1. Resolve user info
    let partnerUser = String(user || "").trim();
    let partnerEmail = String(email || "").trim().toLowerCase();
    let partnerUserId = userId;

    if (req.user && req.user.role !== "admin") {
      partnerUserId = req.user._id;
      partnerUser = req.user.name;
      partnerEmail = String(req.user.email).toLowerCase();
    } else {
      // Admin enrolling a partner: validate required partner email
      if (!partnerEmail) {
        return res.status(400).json({
          success: false,
          message: "Partner email address is required",
        });
      }
      if (!partnerUser) {
        partnerUser = "Partner";
      }
    }

    // 2. Validate Referral Code
    let rawCode = referralCode || code;
    if (!rawCode || !String(rawCode).trim()) {
      const baseClean = partnerUser.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 5) || "PARTNER";
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      rawCode = `${baseClean}${randomSuffix}`;
    }

    const cleanCode = String(rawCode).trim().toUpperCase();
    if (cleanCode.length < 3 || cleanCode.length > 20 || !/^[A-Z0-9_-]+$/.test(cleanCode)) {
      return res.status(400).json({
        success: false,
        message: "Referral code must be 3-20 characters long (alphanumeric, -, _)",
      });
    }

    // Uniqueness check for referral code
    const existingCode = await Affiliate.findOne({ referralCode: cleanCode });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: `Referral code '${cleanCode}' is already assigned to ${existingCode.user}`,
      });
    }

    // Check if user is already enrolled
    const existingPartner = await Affiliate.findOne({ email: partnerEmail });
    if (existingPartner) {
      return res.status(400).json({
        success: false,
        message: `An affiliate partner already exists with email '${partnerEmail}'`,
      });
    }

    // 3. Validate Commission Rate
    let rate = commissionRate !== undefined ? Number(commissionRate) : settings.commissionRate;
    if (isNaN(rate) || rate < 1 || rate > 100) {
      return res.status(400).json({
        success: false,
        message: "Commission rate must be between 1% and 100%",
      });
    }

    const initialStatus = status === "Disabled" ? "Disabled" : "Active";

    const newAffiliate = new Affiliate({
      user: partnerUser,
      email: partnerEmail,
      userId: mongoose.Types.ObjectId.isValid(partnerUserId) ? partnerUserId : undefined,
      referralCode: cleanCode,
      commissionRate: rate,
      status: initialStatus,
      isActive: initialStatus === "Active",
    });

    await newAffiliate.save();

    return res.status(201).json({
      success: true,
      message: `Partner '${partnerUser}' enrolled successfully`,
      affiliate: newAffiliate.toContractJSON(),
      data: newAffiliate.toContractJSON(),
    });
  } catch (error) {
    console.error("Create Affiliate Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to enroll affiliate partner",
      error: error.message,
    });
  }
};

/**
 * PUT /api/affiliate/:id
 * Update affiliate partner configuration (Admin)
 */
const updateAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    let affiliate = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      affiliate = await Affiliate.findById(id);
    }
    if (!affiliate) {
      affiliate = await Affiliate.findOne({ affiliateId: id });
    }

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: `Affiliate partner '${id}' not found`,
      });
    }

    const {
      user,
      email,
      referralCode,
      commissionRate,
      status,
      isActive,
    } = req.body;

    if (user && String(user).trim()) {
      affiliate.user = String(user).trim();
    }

    if (email && String(email).trim()) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (cleanEmail !== affiliate.email) {
        const dupEmail = await Affiliate.findOne({ email: cleanEmail, _id: { $ne: affiliate._id } });
        if (dupEmail) {
          return res.status(400).json({
            success: false,
            message: `Email '${cleanEmail}' is already used by another affiliate`,
          });
        }
        affiliate.email = cleanEmail;
      }
    }

    if (referralCode && String(referralCode).trim()) {
      const cleanCode = String(referralCode).trim().toUpperCase();
      if (cleanCode !== affiliate.referralCode) {
        if (cleanCode.length < 3 || cleanCode.length > 20 || !/^[A-Z0-9_-]+$/.test(cleanCode)) {
          return res.status(400).json({
            success: false,
            message: "Referral code must be 3-20 characters long (alphanumeric, -, _)",
          });
        }
        const duplicate = await Affiliate.findOne({ referralCode: cleanCode, _id: { $ne: affiliate._id } });
        if (duplicate) {
          return res.status(400).json({
            success: false,
            message: `Referral code '${cleanCode}' is already taken`,
          });
        }
        affiliate.referralCode = cleanCode;
      }
    }

    if (commissionRate !== undefined) {
      const rate = Number(commissionRate);
      if (isNaN(rate) || rate < 1 || rate > 100) {
        return res.status(400).json({
          success: false,
          message: "Commission rate must be between 1% and 100%",
        });
      }
      affiliate.commissionRate = rate;
    }

    if (isActive !== undefined) {
      affiliate.isActive = Boolean(isActive);
      affiliate.status = affiliate.isActive ? "Active" : "Disabled";
    } else if (status !== undefined) {
      affiliate.status = status === "Active" ? "Active" : "Disabled";
      affiliate.isActive = affiliate.status === "Active";
    }

    await affiliate.save();

    return res.status(200).json({
      success: true,
      message: `Partner '${affiliate.user}' updated successfully`,
      affiliate: affiliate.toContractJSON(),
      data: affiliate.toContractJSON(),
    });
  } catch (error) {
    console.error("Update Affiliate Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update affiliate partner",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/affiliate/:id/activate and PATCH /api/affiliate/:id/deactivate
 * Activate or deactivate affiliate partner (Admin)
 */
const updateAffiliateStatus = async (req, res) => {
  try {
    const { id, action } = req.params;
    let affiliate = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      affiliate = await Affiliate.findById(id);
    }
    if (!affiliate) {
      affiliate = await Affiliate.findOne({ affiliateId: id });
    }

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: `Affiliate partner '${id}' not found`,
      });
    }

    const isActivate =
      action === "activate" ||
      req.body.status === "Active" ||
      req.body.isActive === true;

    affiliate.isActive = isActivate;
    affiliate.status = isActivate ? "Active" : "Disabled";
    await affiliate.save();

    return res.status(200).json({
      success: true,
      id: affiliate.affiliateId || affiliate._id,
      status: affiliate.status,
      affiliate: affiliate.toContractJSON(),
      message: `Partner status updated to ${affiliate.status}`,
    });
  } catch (error) {
    console.error("Update Affiliate Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update affiliate partner status",
      error: error.message,
    });
  }
};

/**
 * GET /api/affiliate/settings
 * Fetch global affiliate settings (Admin)
 */
const getAffiliateSettings = async (req, res) => {
  try {
    const settings = await AffiliateSetting.getSettings();
    return res.status(200).json({
      success: true,
      settings,
      commissionRate: settings.commissionRate,
      minPayout: settings.minPayout,
      cookieDays: settings.cookieDays,
    });
  } catch (error) {
    console.error("Get Settings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve affiliate settings",
      error: error.message,
    });
  }
};

/**
 * PUT /api/affiliate/settings
 * Update global affiliate settings (Admin)
 */
const updateAffiliateSettings = async (req, res) => {
  try {
    const { commissionRate, minPayout, cookieDays } = req.body;
    const settings = await AffiliateSetting.getSettings();

    if (commissionRate !== undefined) {
      const cr = Number(commissionRate);
      if (isNaN(cr) || cr < 0 || cr > 100) {
        return res.status(400).json({
          success: false,
          message: "Commission rate must be between 0% and 100%",
        });
      }
      settings.commissionRate = cr;
    }

    if (minPayout !== undefined) {
      const mp = Number(minPayout);
      if (isNaN(mp) || mp < 1) {
        return res.status(400).json({
          success: false,
          message: "Minimum payout threshold must be at least ₹1",
        });
      }
      settings.minPayout = mp;
    }

    if (cookieDays !== undefined) {
      const cd = Number(cookieDays);
      if (isNaN(cd) || cd < 1) {
        return res.status(400).json({
          success: false,
          message: "Cookie tracking window must be at least 1 day",
        });
      }
      settings.cookieDays = cd;
    }

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Affiliate settings saved successfully",
      settings,
      commissionRate: settings.commissionRate,
      minPayout: settings.minPayout,
      cookieDays: settings.cookieDays,
    });
  } catch (error) {
    console.error("Update Settings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update affiliate settings",
      error: error.message,
    });
  }
};

/**
 * GET /api/affiliate/payouts
 * List withdrawal / payout requests (Admin or User)
 */
const getPayoutRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (req.user && req.user.role !== "admin") {
      filter.userId = req.user._id;
    }

    if (status && status !== "all") {
      filter.status = new RegExp(`^${status}$`, "i");
    }

    const requests = await AffiliatePayout.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      payoutRequests: requests.map((p) => p.toContractJSON()),
      data: requests.map((p) => p.toContractJSON()),
    });
  } catch (error) {
    console.error("Get Payout Requests Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payout requests",
      error: error.message,
    });
  }
};

/**
 * POST /api/affiliate/payout
 * Request a payout / withdrawal (User or Admin)
 */
const requestPayout = async (req, res) => {
  try {
    const { affiliateId, amount, method } = req.body;
    const settings = await AffiliateSetting.getSettings();

    // 1. Resolve Affiliate
    let affiliate = null;
    if (affiliateId) {
      if (mongoose.Types.ObjectId.isValid(affiliateId)) {
        affiliate = await Affiliate.findById(affiliateId);
      }
      if (!affiliate) {
        affiliate = await Affiliate.findOne({ affiliateId });
      }
    } else if (req.user) {
      affiliate = await Affiliate.findOne({
        $or: [{ userId: req.user._id }, { email: req.user.email }],
      });
    }

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: "Affiliate partner account not found",
      });
    }

    // Role check: non-admin can only request for their own affiliate
    if (
      req.user &&
      req.user.role !== "admin" &&
      affiliate.userId &&
      String(affiliate.userId) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only request payouts for your own affiliate account",
      });
    }

    if (!affiliate.isActive || affiliate.status === "Disabled") {
      return res.status(400).json({
        success: false,
        message: "Affiliate partner account is disabled. Cannot request payouts.",
      });
    }

    // 2. Validate Amount
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please specify a valid payout amount",
      });
    }

    if (numAmount < settings.minPayout) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ₹${settings.minPayout.toLocaleString("en-IN")}`,
      });
    }

    // 3. Balance verification (check totalEarnings - paidEarnings - pendingRequests)
    const pendingBalance = Math.max(0, (affiliate.totalEarnings || 0) - (affiliate.paidEarnings || 0));

    const existingPending = await AffiliatePayout.find({
      affiliateId: affiliate._id,
      status: "Pending",
    });
    const pendingSum = existingPending.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const availableToWithdraw = Math.max(0, pendingBalance - pendingSum);

    if (numAmount > availableToWithdraw) {
      return res.status(400).json({
        success: false,
        message: `Requested amount of ₹${numAmount.toLocaleString("en-IN")} exceeds available unpaid balance of ₹${availableToWithdraw.toLocaleString("en-IN")}`,
      });
    }

    const newPayout = new AffiliatePayout({
      affiliateId: affiliate._id,
      userId: affiliate.userId || req.user?._id,
      user: affiliate.user,
      email: affiliate.email,
      amount: numAmount,
      method: String(method || "UPI").trim(),
      status: "Pending",
    });

    await newPayout.save();

    return res.status(201).json({
      success: true,
      message: `Payout request for ₹${numAmount.toLocaleString("en-IN")} submitted successfully`,
      payout: newPayout.toContractJSON(),
      data: newPayout.toContractJSON(),
    });
  } catch (error) {
    console.error("Request Payout Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit payout request",
      error: error.message,
    });
  }
};

/**
 * POST /api/affiliate/payout/:id/approve
 * Approve payout request, update affiliate paid earnings, and record transaction (Admin)
 */
const approvePayout = async (req, res) => {
  try {
    const { id } = req.params;
    let payout = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      payout = await AffiliatePayout.findById(id);
    }
    if (!payout) {
      payout = await AffiliatePayout.findOne({ payoutId: id });
    }

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: `Payout request '${id}' not found`,
      });
    }

    if (payout.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Payout request has already been ${payout.status.toLowerCase()}`,
      });
    }

    const affiliate = await Affiliate.findById(payout.affiliateId);
    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: "Associated affiliate partner record no longer exists",
      });
    }

    // Atomic financial update
    const payoutAmount = Number(payout.amount);
    affiliate.paidEarnings = Number(((affiliate.paidEarnings || 0) + payoutAmount).toFixed(2));
    await affiliate.save();

    payout.status = "Approved";
    payout.processedAt = new Date();

    // Financial ledger integration
    let paymentRef = null;
    try {
      // If payment is via wallet credit, credit the user balance
      const isWalletCredit = payout.method && payout.method.toLowerCase().includes("wallet");
      if (isWalletCredit && affiliate.userId) {
        await User.findByIdAndUpdate(affiliate.userId, {
          $inc: { balance: payoutAmount },
        });
      }

      const paymentRecord = new Payment({
        paymentId: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
        userId: affiliate.userId,
        user: affiliate.user,
        userEmail: affiliate.email,
        type: isWalletCredit ? "Credit" : "Debit",
        amount: payoutAmount,
        status: "completed",
        method: payout.method || "Affiliate Payout",
        refId: payout.payoutId,
        description: `Affiliate Commission Payout #${payout.payoutId}`,
      });
      await paymentRecord.save();
      paymentRef = paymentRecord.paymentId;
      payout.transactionRef = paymentRef;
    } catch (finErr) {
      console.warn("Ledger record notice:", finErr.message);
    }

    await payout.save();

    return res.status(200).json({
      success: true,
      message: `Payout #${payout.payoutId} approved successfully`,
      payout: payout.toContractJSON(),
      transactionRef: paymentRef,
      affiliate: affiliate.toContractJSON(),
    });
  } catch (error) {
    console.error("Approve Payout Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve payout request",
      error: error.message,
    });
  }
};

/**
 * POST /api/affiliate/payout/:id/reject
 * Reject payout request (Admin)
 */
const rejectPayout = async (req, res) => {
  try {
    const { id } = req.params;
    let payout = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      payout = await AffiliatePayout.findById(id);
    }
    if (!payout) {
      payout = await AffiliatePayout.findOne({ payoutId: id });
    }

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: `Payout request '${id}' not found`,
      });
    }

    if (payout.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Payout request has already been ${payout.status.toLowerCase()}`,
      });
    }

    payout.status = "Rejected";
    payout.rejectionReason = req.body.reason || req.body.rejectionReason || "Rejected by admin";
    payout.processedAt = new Date();
    await payout.save();

    return res.status(200).json({
      success: true,
      message: `Payout #${payout.payoutId} rejected`,
      payout: payout.toContractJSON(),
    });
  } catch (error) {
    console.error("Reject Payout Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject payout request",
      error: error.message,
    });
  }
};

/**
 * POST /api/affiliate/referral
 * Record a referral click / visitor
 */
const recordReferral = async (req, res) => {
  try {
    const { code, referralCode } = req.body;
    const cleanCode = String(code || referralCode || "").trim().toUpperCase();

    if (!cleanCode) {
      return res.status(400).json({
        success: false,
        message: "Referral code is required",
      });
    }

    const affiliate = await Affiliate.findOne({ referralCode: cleanCode, isActive: true });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: `Active referral code '${cleanCode}' not found`,
      });
    }

    affiliate.referralCount = (affiliate.referralCount || 0) + 1;
    await affiliate.save();

    return res.status(200).json({
      success: true,
      message: "Referral recorded successfully",
      referralCount: affiliate.referralCount,
    });
  } catch (error) {
    console.error("Record Referral Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record referral",
      error: error.message,
    });
  }
};

/**
 * POST /api/affiliate/commission
 * Record commission from conversion/order
 */
const recordCommission = async (req, res) => {
  try {
    const { code, referralCode, orderAmount, commissionAmount } = req.body;
    const cleanCode = String(code || referralCode || "").trim().toUpperCase();

    if (!cleanCode) {
      return res.status(400).json({
        success: false,
        message: "Referral code is required",
      });
    }

    const affiliate = await Affiliate.findOne({ referralCode: cleanCode, isActive: true });
    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: `Active referral code '${cleanCode}' not found`,
      });
    }

    let earned = 0;
    if (commissionAmount !== undefined && !isNaN(Number(commissionAmount))) {
      earned = Number(commissionAmount);
    } else if (orderAmount !== undefined && !isNaN(Number(orderAmount))) {
      earned = (Number(orderAmount) * (affiliate.commissionRate || 5)) / 100;
    }

    earned = Math.max(0, Number(earned.toFixed(2)));

    affiliate.conversionCount = (affiliate.conversionCount || 0) + 1;
    affiliate.totalEarnings = Number(((affiliate.totalEarnings || 0) + earned).toFixed(2));
    await affiliate.save();

    return res.status(200).json({
      success: true,
      message: `Commission of ₹${earned.toFixed(2)} recorded successfully`,
      totalEarnings: affiliate.totalEarnings,
      conversionCount: affiliate.conversionCount,
      affiliate: affiliate.toContractJSON(),
    });
  } catch (error) {
    console.error("Record Commission Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record commission",
      error: error.message,
    });
  }
};

module.exports = {
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
};
