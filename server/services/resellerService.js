const crypto = require("crypto");
const mongoose = require("mongoose");

const User = require("../models/User");
const Reseller = require("../models/Reseller");

// ======================================================
// GENERATE UNIQUE RESELLER CODE
// ======================================================

const generateResellerCode = async () => {
  let resellerCode;
  let exists = true;

  while (exists) {
    resellerCode = `RES-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

    exists = await Reseller.exists({
      resellerCode,
    });
  }

  return resellerCode;
};

// ======================================================
// GENERATE UNIQUE API KEY
// ======================================================

const generateApiKey = async () => {
  let apiKey;
  let exists = true;

  while (exists) {
    apiKey = `res_${crypto
      .randomBytes(24)
      .toString("hex")}`;

    exists = await Reseller.exists({
      apiKey,
    });
  }

  return apiKey;
};

// ======================================================
// VALIDATE OBJECT ID
// ======================================================

const validateObjectId = (id, fieldName = "ID") => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return id;
};

// ======================================================
// VALIDATE MARKUP
// ======================================================

const validateMarkup = (markupType, markupValue) => {
  if (!["percentage", "fixed"].includes(markupType)) {
    throw new Error(
      "Markup type must be percentage or fixed"
    );
  }

  const numericMarkupValue = Number(markupValue);

  if (
    !Number.isFinite(numericMarkupValue) ||
    numericMarkupValue < 0
  ) {
    throw new Error(
      "Markup value must be a valid non-negative number"
    );
  }

  // Percentage markup should normally not exceed 100%.
  if (
    markupType === "percentage" &&
    numericMarkupValue > 100
  ) {
    throw new Error(
      "Percentage markup cannot exceed 100"
    );
  }

  return Number(numericMarkupValue.toFixed(2));
};

// ======================================================
// VALIDATE POSITIVE AMOUNT
// ======================================================

const validatePositiveAmount = (amount, fieldName = "Amount") => {
  const numericAmount = Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error(
      `${fieldName} must be greater than 0`
    );
  }

  return Number(numericAmount.toFixed(2));
};

// ======================================================
// CREATE RESELLER
// ======================================================

const createReseller = async ({
  userId,
  markupType = "percentage",
  markupValue = 0,
}) => {
  validateObjectId(userId, "user ID");

  const numericMarkupValue = validateMarkup(
    markupType,
    markupValue
  );

  // ----------------------------------------------------
  // CHECK USER
  // ----------------------------------------------------

  const user = await User.findById(userId).select(
    "_id name email role status"
  );

  if (!user) {
    throw new Error("User not found");
  }

  // Suspended users should not receive a reseller account.
  if (user.status === "suspended") {
    throw new Error(
      "Cannot create reseller for a suspended user"
    );
  }

  // ----------------------------------------------------
  // CHECK EXISTING RESELLER
  // ----------------------------------------------------

  const existingReseller = await Reseller.findOne({
    user: userId,
  });

  if (existingReseller) {
    throw new Error(
      "Reseller profile already exists for this user"
    );
  }

  // ----------------------------------------------------
  // GENERATE IDENTIFIERS
  // ----------------------------------------------------

  const resellerCode = await generateResellerCode();
  const apiKey = await generateApiKey();

  // ----------------------------------------------------
  // CREATE
  // ----------------------------------------------------

  const reseller = await Reseller.create({
    user: userId,
    resellerCode,
    markupType,
    markupValue: numericMarkupValue,
    balance: 0,
    totalOrders: 0,
    totalSpent: 0,
    totalEarnings: 0,
    status: "active",
    apiEnabled: true,
    apiKey,
    apiLastUsedAt: null,
  });

  // ----------------------------------------------------
  // RETURN SAFE DATA
  // ----------------------------------------------------

  return {
    _id: reseller._id,
    user: reseller.user,
    resellerCode: reseller.resellerCode,
    markupType: reseller.markupType,
    markupValue: reseller.markupValue,
    balance: reseller.balance,
    totalOrders: reseller.totalOrders,
    totalSpent: reseller.totalSpent,
    totalEarnings: reseller.totalEarnings,
    status: reseller.status,
    apiEnabled: reseller.apiEnabled,
    apiLastUsedAt: reseller.apiLastUsedAt,
    createdAt: reseller.createdAt,
    updatedAt: reseller.updatedAt,
  };
};

// ======================================================
// GET RESELLER BY USER
// ======================================================

const getResellerByUser = async (userId) => {
  validateObjectId(userId, "user ID");

  // IMPORTANT:
  // Do NOT use .select("+apiKey") here.
  //
  // apiKey has select:false in the model and therefore
  // will remain hidden from /reseller/me.
  const reseller = await Reseller.findOne({
    user: userId,
  }).populate(
    "user",
    "name email role status"
  );

  if (!reseller) {
    throw new Error("Reseller profile not found");
  }

  return reseller;
};

// ======================================================
// GET RESELLER BY CODE
// ======================================================

const getResellerByCode = async (code) => {
  if (!code || !code.trim()) {
    throw new Error("Reseller code is required");
  }

  const reseller = await Reseller.findOne({
    resellerCode: code.trim().toUpperCase(),
    status: "active",
  }).populate(
    "user",
    "name email role status"
  );

  if (!reseller) {
    throw new Error("Reseller not found");
  }

  return reseller;
};

// ======================================================
// CALCULATE RESELLER PRICE
// ======================================================

const calculateResellerPrice = ({
  basePrice,
  markupType,
  markupValue,
}) => {
  const numericBasePrice = Number(basePrice);

  if (
    !Number.isFinite(numericBasePrice) ||
    numericBasePrice < 0
  ) {
    throw new Error(
      "Base price must be a valid non-negative number"
    );
  }

  const numericMarkupValue = validateMarkup(
    markupType,
    markupValue
  );

  let finalPrice;

  if (markupType === "percentage") {
    finalPrice =
      numericBasePrice +
      (numericBasePrice * numericMarkupValue) / 100;
  } else {
    finalPrice =
      numericBasePrice + numericMarkupValue;
  }

  return {
    basePrice: Number(numericBasePrice.toFixed(2)),
    markupType,
    markupValue: numericMarkupValue,
    markupAmount: Number(
      (finalPrice - numericBasePrice).toFixed(2)
    ),
    finalPrice: Number(finalPrice.toFixed(2)),
    currency: "INR",
  };
};

// ======================================================
// CALCULATE PRICE FOR RESELLER
// ======================================================

const calculatePriceForReseller = async ({
  resellerId,
  basePrice,
}) => {
  validateObjectId(resellerId, "reseller ID");

  const reseller = await Reseller.findById(
    resellerId
  ).select(
    "_id resellerCode markupType markupValue status"
  );

  if (!reseller) {
    throw new Error("Reseller not found");
  }

  if (reseller.status !== "active") {
    throw new Error(
      "Reseller account is not active"
    );
  }

  return calculateResellerPrice({
    basePrice,
    markupType: reseller.markupType,
    markupValue: reseller.markupValue,
  });
};

// ======================================================
// RECORD RESELLER ORDER
// ======================================================

const recordResellerOrder = async ({
  resellerId,
  orderAmount,
}) => {
  validateObjectId(resellerId, "reseller ID");

  const numericOrderAmount = validatePositiveAmount(
    orderAmount,
    "Order amount"
  );

  const reseller = await Reseller.findOneAndUpdate(
    {
      _id: resellerId,
      status: "active",
    },
    {
      $inc: {
        totalOrders: 1,
        totalSpent: numericOrderAmount,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!reseller) {
    throw new Error(
      "Active reseller not found"
    );
  }

  return reseller;
};

// ======================================================
// ADD RESELLER EARNINGS
// ADMIN / INTERNAL OPERATION
// ======================================================

const addResellerEarnings = async ({
  resellerId,
  amount,
}) => {
  validateObjectId(resellerId, "reseller ID");

  const numericAmount = validatePositiveAmount(
    amount,
    "Earnings amount"
  );

  const reseller = await Reseller.findByIdAndUpdate(
    resellerId,
    {
      $inc: {
        totalEarnings: numericAmount,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!reseller) {
    throw new Error("Reseller not found");
  }

  return reseller;
};

// ======================================================
// ADD RESELLER BALANCE
// ======================================================

const addResellerBalance = async ({
  resellerId,
  amount,
}) => {
  validateObjectId(resellerId, "reseller ID");

  const numericAmount = validatePositiveAmount(
    amount,
    "Balance amount"
  );

  const reseller = await Reseller.findOneAndUpdate(
    {
      _id: resellerId,
    },
    {
      $inc: {
        balance: numericAmount,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!reseller) {
    throw new Error("Reseller not found");
  }

  return reseller;
};

// ======================================================
// UPDATE RESELLER MARKUP
// ======================================================

const updateResellerMarkup = async ({
  resellerId,
  markupType,
  markupValue,
}) => {
  validateObjectId(resellerId, "reseller ID");

  const numericMarkupValue = validateMarkup(
    markupType,
    markupValue
  );

  const reseller = await Reseller.findOneAndUpdate(
    {
      _id: resellerId,
    },
    {
      $set: {
        markupType,
        markupValue: numericMarkupValue,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!reseller) {
    throw new Error("Reseller not found");
  }

  return reseller;
};

// ======================================================
// REGENERATE API KEY
// ADMIN ONLY
// ======================================================

const regenerateApiKey = async (resellerId) => {
  validateObjectId(resellerId, "reseller ID");

  const newApiKey = await generateApiKey();

  const reseller = await Reseller.findByIdAndUpdate(
    resellerId,
    {
      $set: {
        apiKey: newApiKey,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  ).select("+apiKey");

  if (!reseller) {
    throw new Error("Reseller not found");
  }

  // The new API key is intentionally returned here because
  // this operation is admin-only and the caller needs the
  // newly generated credential.
  return reseller;
};

// ======================================================
// ENABLE RESELLER API
// ======================================================

const enableApi = async (resellerId) => {
  validateObjectId(resellerId, "reseller ID");

  const reseller = await Reseller.findByIdAndUpdate(
    resellerId,
    {
      $set: {
        apiEnabled: true,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!reseller) {
    throw new Error("Reseller not found");
  }

  return reseller;
};

// ======================================================
// DISABLE RESELLER API
// ======================================================

const disableApi = async (resellerId) => {
  validateObjectId(resellerId, "reseller ID");

  const reseller = await Reseller.findByIdAndUpdate(
    resellerId,
    {
      $set: {
        apiEnabled: false,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!reseller) {
    throw new Error("Reseller not found");
  }

  return reseller;
};

// ======================================================
// SUSPEND RESELLER
// ======================================================

const suspendReseller = async (resellerId) => {
  validateObjectId(resellerId, "reseller ID");

  const reseller = await Reseller.findByIdAndUpdate(
    resellerId,
    {
      $set: {
        status: "suspended",
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!reseller) {
    throw new Error("Reseller not found");
  }

  return reseller;
};

// ======================================================
// ACTIVATE RESELLER
// ======================================================

const activateReseller = async (resellerId) => {
  validateObjectId(resellerId, "reseller ID");

  const reseller = await Reseller.findByIdAndUpdate(
    resellerId,
    {
      $set: {
        status: "active",
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!reseller) {
    throw new Error("Reseller not found");
  }

  return reseller;
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  generateResellerCode,
  generateApiKey,

  createReseller,

  getResellerByUser,
  getResellerByCode,

  calculateResellerPrice,
  calculatePriceForReseller,

  recordResellerOrder,
  addResellerEarnings,
  addResellerBalance,

  updateResellerMarkup,

  regenerateApiKey,

  enableApi,
  disableApi,

  suspendReseller,
  activateReseller,
};