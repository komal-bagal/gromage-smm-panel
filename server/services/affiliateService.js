
const crypto = require("crypto");

const Affiliate = require("../models/Affiliate");
const Referral = require("../models/Referral");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");

// ======================================================
// GENERATE UNIQUE REFERRAL CODE
// ======================================================

async function generateReferralCode() {
  let referralCode;
  let exists = true;

  while (exists) {
    referralCode = `AFF${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

    exists = await Affiliate.exists({
      referralCode,
    });
  }

  return referralCode;
}

// ======================================================
// CREATE AFFILIATE
// ======================================================

async function createAffiliate({
  userId,
  commissionRate = 5,
}) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const existingAffiliate = await Affiliate.findOne({
    user: userId,
  });

  if (existingAffiliate) {
    throw new Error("Affiliate profile already exists");
  }

  if (
    typeof commissionRate !== "number" ||
    !Number.isFinite(commissionRate) ||
    commissionRate < 0 ||
    commissionRate > 100
  ) {
    throw new Error("Invalid commission rate");
  }

  const referralCode =
    await generateReferralCode();

  const affiliate =
    await Affiliate.create({
      user: userId,
      referralCode,
      commissionRate,
    });

  return affiliate;
}

// ======================================================
// GET AFFILIATE BY USER
// ======================================================

async function getAffiliateByUser(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const affiliate =
    await Affiliate.findOne({
      user: userId,
    })
      .populate(
        "user",
        "name email role status"
      )
      .populate(
        "referredUsers",
        "name email createdAt"
      );

  if (!affiliate) {
    throw new Error(
      "Affiliate profile not found"
    );
  }

  return affiliate;
}

// ======================================================
// GET AFFILIATE BY REFERRAL CODE
// ======================================================

async function getAffiliateByReferralCode(
  referralCode
) {
  if (
    !referralCode ||
    typeof referralCode !== "string"
  ) {
    throw new Error(
      "Referral code is required"
    );
  }

  const affiliate =
    await Affiliate.findOne({
      referralCode:
        referralCode.trim().toUpperCase(),
    }).populate(
      "user",
      "name email role status"
    );

  if (!affiliate) {
    throw new Error(
      "Invalid referral code"
    );
  }

  if (!affiliate.isActive) {
    throw new Error(
      "Affiliate is inactive"
    );
  }

  return affiliate;
}

// ======================================================
// ADD REFERRAL
// ======================================================

async function addReferral({
  referralCode,
  referredUserId,
}) {
  if (!referralCode) {
    throw new Error(
      "Referral code is required"
    );
  }

  if (!referredUserId) {
    throw new Error(
      "Referred user ID is required"
    );
  }

  const affiliate =
    await getAffiliateByReferralCode(
      referralCode
    );

  const referredUser =
    await User.findById(
      referredUserId
    );

  if (!referredUser) {
    throw new Error(
      "Referred user not found"
    );
  }

  // --------------------------------------------------
  // SELF REFERRAL
  // --------------------------------------------------

  if (
    affiliate.user.toString() ===
    referredUserId.toString()
  ) {
    throw new Error(
      "User cannot refer themselves"
    );
  }

  // --------------------------------------------------
  // CHECK WHETHER USER IS ALREADY REFERRED
  // --------------------------------------------------

  const existingReferral =
    await Referral.findOne({
      referredUserId,
    });

  if (existingReferral) {
    throw new Error(
      "User has already been referred"
    );
  }

  // --------------------------------------------------
  // CREATE REFERRAL RECORD
  // --------------------------------------------------

  await Referral.create({
    referrerId: affiliate.user,
    referredUserId,
    referralCode:
      affiliate.referralCode,
    status: "active",
  });

  // --------------------------------------------------
  // UPDATE AFFILIATE
  // --------------------------------------------------

  affiliate.referredUsers.push(
    referredUserId
  );

  affiliate.totalReferrals += 1;

  await affiliate.save();

  return affiliate;
}

// ======================================================
// CALCULATE COMMISSION
// ======================================================

function calculateCommission({
  orderAmount,
  commissionRate,
}) {
  if (
    typeof orderAmount !== "number" ||
    !Number.isFinite(orderAmount) ||
    orderAmount <= 0
  ) {
    throw new Error(
      "Invalid order amount"
    );
  }

  if (
    typeof commissionRate !== "number" ||
    !Number.isFinite(commissionRate) ||
    commissionRate < 0 ||
    commissionRate > 100
  ) {
    throw new Error(
      "Invalid commission rate"
    );
  }

  const commission =
    (orderAmount * commissionRate) /
    100;

  return Number(
    commission.toFixed(2)
  );
}

// ======================================================
// ADD COMMISSION
// ======================================================

async function addCommission({
  affiliateId,
  orderAmount,
  orderId,
}) {
  if (!affiliateId) {
    throw new Error(
      "Affiliate ID is required"
    );
  }

  if (!orderId) {
    throw new Error(
      "Order ID is required"
    );
  }

  const affiliate =
    await Affiliate.findById(
      affiliateId
    );

  if (!affiliate) {
    throw new Error(
      "Affiliate not found"
    );
  }

  if (!affiliate.isActive) {
    throw new Error(
      "Affiliate is inactive"
    );
  }

  // --------------------------------------------------
  // CALCULATE COMMISSION
  // --------------------------------------------------

  const commission =
    calculateCommission({
      orderAmount: Number(orderAmount),
      commissionRate:
        affiliate.commissionRate,
    });

  const commissionOrderId =
    String(orderId);

  // --------------------------------------------------
  // ATOMIC DUPLICATE PROTECTION
  // --------------------------------------------------
  //
  // Commission will be added only when this order ID
  // has NOT already been processed.
  //
  // This is intentionally done in one MongoDB update
  // so simultaneous duplicate requests cannot both
  // successfully add commission.
  //
  // --------------------------------------------------

  const updatedAffiliate =
    await Affiliate.findOneAndUpdate(
      {
        _id: affiliateId,
        processedCommissionOrders: {
          $ne: commissionOrderId,
        },
      },
      {
        $addToSet: {
          processedCommissionOrders:
            commissionOrderId,
        },

        $inc: {
          totalEarnings: commission,
          pendingEarnings: commission,
        },
      },
      {
        new: true,
      }
    );

  // --------------------------------------------------
  // DUPLICATE COMMISSION
  // --------------------------------------------------

  if (!updatedAffiliate) {
    throw new Error(
      "Commission has already been processed for this order"
    );
  }

  // --------------------------------------------------
  // RETURN RESULT
  // --------------------------------------------------

  return {
    affiliate: updatedAffiliate,
    commission,
    reference:
      `AFFILIATE-COMMISSION-${commissionOrderId}`,
  };
}

// ======================================================
// MARK EARNINGS PAID
// ======================================================

async function markEarningsPaid({
  affiliateId,
  amount,
  payoutReference,
}) {
  if (!affiliateId) {
    throw new Error(
      "Affiliate ID is required"
    );
  }

  if (
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Invalid payment amount"
    );
  }

  if (
    !payoutReference ||
    !payoutReference.trim()
  ) {
    throw new Error(
      "Payout reference is required"
    );
  }

  const affiliate =
    await Affiliate.findById(
      affiliateId
    );

  if (!affiliate) {
    throw new Error(
      "Affiliate not found"
    );
  }

  if (
    amount >
    affiliate.pendingEarnings
  ) {
    throw new Error(
      "Payment amount cannot exceed pending earnings"
    );
  }

  // --------------------------------------------------
  // FIND AFFILIATE USER
  // --------------------------------------------------

  const user =
    await User.findById(
      affiliate.user
    );

  if (!user) {
    throw new Error(
      "Affiliate user not found"
    );
  }

  // --------------------------------------------------
  // FIND / CREATE WALLET
  // --------------------------------------------------

  let wallet =
    await Wallet.findOne({
      userId: affiliate.user,
    });

  if (!wallet) {
    wallet = await Wallet.create({
      userId: affiliate.user,
      balance: 0,
      status: "active",
    });
  }

  if (wallet.status !== "active") {
    throw new Error(
      "Affiliate wallet is not active"
    );
  }

  // --------------------------------------------------
  // DUPLICATE PAYOUT PROTECTION
  // --------------------------------------------------

  const existingTransaction =
    await WalletTransaction.findOne({
      reference:
        payoutReference.trim(),
      transactionType:
        "referral_commission",
    });

  if (existingTransaction) {
    throw new Error(
      "This payout reference has already been processed"
    );
  }

  // --------------------------------------------------
  // WALLET BALANCE
  // --------------------------------------------------

  const balanceBefore =
    wallet.balance;

  const balanceAfter =
    Number(
      (
        balanceBefore +
        amount
      ).toFixed(2)
    );

  // --------------------------------------------------
  // CREDIT WALLET
  // --------------------------------------------------

  const updatedWallet =
    await Wallet.findOneAndUpdate(
      {
        userId: affiliate.user,
        status: "active",
      },
      {
        $inc: {
          balance: amount,
        },
      },
      {
        new: true,
      }
    );

  if (!updatedWallet) {
    throw new Error(
      "Unable to credit affiliate wallet"
    );
  }

  // --------------------------------------------------
  // CREATE WALLET TRANSACTION
  // --------------------------------------------------

  let transaction;

  try {
    transaction =
      await WalletTransaction.create({
        userId: affiliate.user,

        walletId:
          updatedWallet._id,

        transactionType:
          "referral_commission",

        reference:
          payoutReference.trim(),

        amount,

        balanceBefore,

        balanceAfter,

        status: "completed",
      });
  } catch (error) {
    // ------------------------------------------------
    // ROLLBACK WALLET CREDIT IF TRANSACTION CREATION
    // FAILS
    // ------------------------------------------------

    await Wallet.findByIdAndUpdate(
      updatedWallet._id,
      {
        $inc: {
          balance: -amount,
        },
      }
    );

    throw error;
  }

  // --------------------------------------------------
  // UPDATE AFFILIATE EARNINGS
  // --------------------------------------------------

  affiliate.pendingEarnings =
    Number(
      (
        affiliate.pendingEarnings -
        amount
      ).toFixed(2)
    );

  affiliate.paidEarnings =
    Number(
      (
        affiliate.paidEarnings +
        amount
      ).toFixed(2)
    );

  await affiliate.save();

  // --------------------------------------------------
  // SYNC USER BALANCE
  // --------------------------------------------------

  await User.findByIdAndUpdate(
    affiliate.user,
    {
      balance: updatedWallet.balance,
    }
  );

  return {
    affiliate,
    wallet: updatedWallet,
    transaction,
  };
}

// ======================================================
// DEACTIVATE AFFILIATE
// ======================================================

async function deactivateAffiliate(
  affiliateId
) {
  const affiliate =
    await Affiliate.findByIdAndUpdate(
      affiliateId,
      {
        isActive: false,
      },
      {
        new: true,
      }
    );

  if (!affiliate) {
    throw new Error(
      "Affiliate not found"
    );
  }

  return affiliate;
}

// ======================================================
// ACTIVATE AFFILIATE
// ======================================================

async function activateAffiliate(
  affiliateId
) {
  const affiliate =
    await Affiliate.findByIdAndUpdate(
      affiliateId,
      {
        isActive: true,
      },
      {
        new: true,
      }
    );

  if (!affiliate) {
    throw new Error(
      "Affiliate not found"
    );
  }

  return affiliate;
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  generateReferralCode,
  createAffiliate,
  getAffiliateByUser,
  getAffiliateByReferralCode,
  addReferral,
  calculateCommission,
  addCommission,
  markEarningsPaid,
  deactivateAffiliate,
  activateAffiliate,
};
