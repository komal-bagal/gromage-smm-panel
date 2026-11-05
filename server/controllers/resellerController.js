const mongoose = require("mongoose");

const resellerService = require("../services/resellerService");
const Reseller = require("../models/Reseller");
const Service = require("../models/Service");

// ======================================================
// HELPERS
// ======================================================

const MAX_PERCENTAGE_MARKUP = 100;

// Fields a reseller is allowed to see for each service.
// Deliberately excludes: cost, providerId, providerServiceId,
// markupType, markupValue, isImported, sortOrder, _id.
const RESELLER_SERVICE_PUBLIC_FIELDS =
  "serviceId name platform categoryId description sellingPrice min max refill cancel dripFeed -_id";

function isValidObjectId(value) {
  return (
    typeof value === "string" && mongoose.Types.ObjectId.isValid(value)
  );
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// Returns an error message string, or null when the markup is valid.
// The percentage cap matches calculateResellerPrice() in orderController,
// so a markup that is accepted here can never break order creation later.
function validateMarkup(markupType, markupValue) {
  if (!["percentage", "fixed"].includes(markupType)) {
    return "Invalid markup type";
  }

  if (!Number.isFinite(markupValue) || markupValue < 0) {
    return "Markup value must be a valid non-negative number";
  }

  if (markupType === "percentage" && markupValue > MAX_PERCENTAGE_MARKUP) {
    return `Percentage markup cannot exceed ${MAX_PERCENTAGE_MARKUP}`;
  }

  return null;
}

// ======================================================
// CREATE RESELLER
// ADMIN ONLY
// ======================================================

const createResellerController = async (req, res) => {
  try {
    const {
      userId,
      markupType = "percentage",
      markupValue = 0,
    } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // CHANGED: reject malformed ids before they reach the service layer.
    if (!isValidObjectId(String(userId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const numericMarkupValue = Number(markupValue);

    // CHANGED: validates type, non-negative value and the 100% cap.
    const markupError = validateMarkup(markupType, numericMarkupValue);

    if (markupError) {
      return res.status(400).json({
        success: false,
        message: markupError,
      });
    }

    const reseller = await resellerService.createReseller({
      userId,
      markupType,
      markupValue: numericMarkupValue,
    });

    return res.status(201).json({
      success: true,
      message: "Reseller created successfully",
      data: reseller,
    });
  } catch (error) {
    console.error("CREATE RESELLER ERROR:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create reseller",
    });
  }
};

// ======================================================
// GET MY RESELLER
// ======================================================

const getMyReseller = async (req, res) => {
  try {
    const userId = req.userId || req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const reseller = await resellerService.getResellerByUser(userId);

    if (!reseller) {
      return res.status(404).json({
        success: false,
        message: "Reseller profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: reseller,
    });
  } catch (error) {
    console.error("GET MY RESELLER ERROR:", error.message);

    return res.status(404).json({
      success: false,
      message: "Reseller profile not found",
    });
  }
};

// ======================================================
// GET RESELLER BY CODE
// ======================================================

const getResellerByCodeController = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reseller code is required",
      });
    }

    const reseller = await resellerService.getResellerByCode(code.trim());

    if (!reseller) {
      return res.status(404).json({
        success: false,
        message: "Reseller not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: reseller,
    });
  } catch (error) {
    console.error("GET RESELLER BY CODE ERROR:", error.message);

    return res.status(404).json({
      success: false,
      message: "Reseller not found",
    });
  }
};

// ======================================================
// CALCULATE RESELLER PRICE
// SELF-SERVICE
// ======================================================

const calculateResellerPriceController = async (req, res) => {
  try {
    const { basePrice } = req.body;

    const numericBasePrice = Number(basePrice);

    if (!Number.isFinite(numericBasePrice) || numericBasePrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Base price must be a valid non-negative number",
      });
    }

    const userId = req.userId || req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // IMPORTANT:
    // Do NOT trust resellerId from req.body.
    // The reseller is resolved from the authenticated user.
    const reseller = await resellerService.getResellerByUser(userId);

    if (!reseller) {
      return res.status(404).json({
        success: false,
        message: "Reseller profile not found",
      });
    }

    const result = await resellerService.calculatePriceForReseller({
      resellerId: reseller._id,
      basePrice: numericBasePrice,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("CALCULATE RESELLER PRICE ERROR:", error.message);

    return res.status(400).json({
      success: false,
      message: "Failed to calculate reseller price",
    });
  }
};

// ======================================================
// RECORD RESELLER ORDER
// SELF-SERVICE
// ======================================================
//
// WARNING: createResellerOrder() already updates totalOrders and
// totalSpent after every successful provider order. This endpoint lets
// a reseller push arbitrary amounts into the same statistics, so it
// should be restricted to admin/staff in the route (or removed).
// The code below is unchanged.
// ======================================================

const recordResellerOrderController = async (req, res) => {
  try {
    const { orderAmount } = req.body;

    const numericOrderAmount = Number(orderAmount);

    if (!Number.isFinite(numericOrderAmount) || numericOrderAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Order amount must be greater than 0",
      });
    }

    const userId = req.userId || req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // IMPORTANT:
    // Do NOT trust resellerId from req.body.
    const reseller = await resellerService.getResellerByUser(userId);

    if (!reseller) {
      return res.status(404).json({
        success: false,
        message: "Reseller profile not found",
      });
    }

    const updatedReseller = await resellerService.recordResellerOrder({
      resellerId: reseller._id,
      orderAmount: numericOrderAmount,
    });

    return res.status(200).json({
      success: true,
      message: "Reseller order recorded successfully",
      data: updatedReseller,
    });
  } catch (error) {
    console.error("RECORD RESELLER ORDER ERROR:", error.message);

    return res.status(400).json({
      success: false,
      message: "Failed to record reseller order",
    });
  }
};

// ======================================================
// ADD RESELLER EARNINGS
// ADMIN ONLY
// ======================================================

const addResellerEarningsController = async (req, res) => {
  try {
    const { resellerId, amount } = req.body;

    if (!resellerId) {
      return res.status(400).json({
        success: false,
        message: "Reseller ID is required",
      });
    }

    // CHANGED: validate the id format.
    if (!isValidObjectId(String(resellerId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid reseller ID",
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    const reseller = await resellerService.addResellerEarnings({
      resellerId,
      amount: numericAmount,
    });

    return res.status(200).json({
      success: true,
      message: "Reseller earnings added successfully",
      data: reseller,
    });
  } catch (error) {
    console.error("ADD RESELLER EARNINGS ERROR:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to add reseller earnings",
    });
  }
};

// ======================================================
// ADD RESELLER BALANCE
// ADMIN ONLY
// ======================================================

const addResellerBalanceController = async (req, res) => {
  try {
    const { resellerId, amount } = req.body;

    if (!resellerId) {
      return res.status(400).json({
        success: false,
        message: "Reseller ID is required",
      });
    }

    // CHANGED: validate the id format.
    if (!isValidObjectId(String(resellerId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid reseller ID",
      });
    }

    const numericAmount = roundMoney(Number(amount));

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    // CHANGED: atomic $inc instead of read -> modify -> save().
    // The old version could lose an update if an order debit ran between
    // the read and the save (the save would overwrite the new balance).
    const reseller = await Reseller.findByIdAndUpdate(
      String(resellerId),
      { $inc: { balance: numericAmount } },
      { new: true },
    ).select("resellerCode balance");

    if (!reseller) {
      return res.status(404).json({
        success: false,
        message: "Reseller not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reseller balance added successfully",
      data: {
        resellerId: reseller._id,
        resellerCode: reseller.resellerCode,
        addedAmount: numericAmount,
        balance: roundMoney(reseller.balance),
        currency: "INR",
      },
    });
  } catch (error) {
    console.error("ADD RESELLER BALANCE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to add reseller balance",
    });
  }
};

// ======================================================
// UPDATE RESELLER MARKUP
// SELF-SERVICE
// ======================================================

const updateResellerMarkupController = async (req, res) => {
  try {
    const { markupType, markupValue } = req.body;

    const numericMarkupValue = Number(markupValue);

    // CHANGED: also enforces the 100% cap for percentage markup.
    const markupError = validateMarkup(markupType, numericMarkupValue);

    if (markupError) {
      return res.status(400).json({
        success: false,
        message: markupError,
      });
    }

    const userId = req.userId || req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // IMPORTANT:
    // Do NOT trust resellerId from req.body.
    const reseller = await resellerService.getResellerByUser(userId);

    if (!reseller) {
      return res.status(404).json({
        success: false,
        message: "Reseller profile not found",
      });
    }

    const updatedReseller = await resellerService.updateResellerMarkup({
      resellerId: reseller._id,
      markupType,
      markupValue: numericMarkupValue,
    });

    return res.status(200).json({
      success: true,
      message: "Reseller markup updated successfully",
      data: updatedReseller,
    });
  } catch (error) {
    console.error("UPDATE RESELLER MARKUP ERROR:", error.message);

    return res.status(400).json({
      success: false,
      message: "Failed to update reseller markup",
    });
  }
};

// ======================================================
// REGENERATE API KEY
// ADMIN ONLY
// ======================================================

const regenerateApiKeyController = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Reseller ID is required",
      });
    }

    // CHANGED: validate the id format.
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reseller ID",
      });
    }

    const reseller = await resellerService.regenerateApiKey(id);

    return res.status(200).json({
      success: true,
      message: "Reseller API key regenerated successfully",
      data: reseller,
    });
  } catch (error) {
    console.error("REGENERATE RESELLER API KEY ERROR:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to regenerate API key",
    });
  }
};

// ======================================================
// ENABLE API
// ADMIN ONLY
// ======================================================

const enableApiController = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Reseller ID is required",
      });
    }

    // CHANGED: validate the id format.
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reseller ID",
      });
    }

    const reseller = await resellerService.enableApi(id);

    return res.status(200).json({
      success: true,
      message: "Reseller API enabled successfully",
      data: reseller,
    });
  } catch (error) {
    console.error("ENABLE RESELLER API ERROR:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to enable reseller API",
    });
  }
};

// ======================================================
// DISABLE API
// ADMIN ONLY
// ======================================================

const disableApiController = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Reseller ID is required",
      });
    }

    // CHANGED: validate the id format.
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reseller ID",
      });
    }

    const reseller = await resellerService.disableApi(id);

    return res.status(200).json({
      success: true,
      message: "Reseller API disabled successfully",
      data: reseller,
    });
  } catch (error) {
    console.error("DISABLE RESELLER API ERROR:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to disable reseller API",
    });
  }
};

// ======================================================
// SUSPEND RESELLER
// ADMIN ONLY
// ======================================================

const suspendResellerController = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Reseller ID is required",
      });
    }

    // CHANGED: validate the id format.
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reseller ID",
      });
    }

    const reseller = await resellerService.suspendReseller(id);

    return res.status(200).json({
      success: true,
      message: "Reseller suspended successfully",
      data: reseller,
    });
  } catch (error) {
    console.error("SUSPEND RESELLER ERROR:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to suspend reseller",
    });
  }
};

// ======================================================
// ACTIVATE RESELLER
// ADMIN ONLY
// ======================================================

const activateResellerController = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Reseller ID is required",
      });
    }

    // CHANGED: validate the id format.
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid reseller ID",
      });
    }

    const reseller = await resellerService.activateReseller(id);

    return res.status(200).json({
      success: true,
      message: "Reseller activated successfully",
      data: reseller,
    });
  } catch (error) {
    console.error("ACTIVATE RESELLER ERROR:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to activate reseller",
    });
  }
};

// ======================================================
// GET RESELLER API BALANCE
// ======================================================

const getResellerApiBalanceController = async (req, res) => {
  try {
    const reseller = req.reseller;

    if (!reseller) {
      return res.status(401).json({
        success: false,
        message: "Reseller authentication required",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        resellerId: reseller._id,
        resellerCode: reseller.resellerCode,
        balance: roundMoney(reseller.balance),
        currency: "INR",
      },
    });
  } catch (error) {
    console.error("GET RESELLER API BALANCE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to get reseller balance",
    });
  }
};

// ======================================================
// GET RESELLER API SERVICES
// ======================================================

const getResellerApiServicesController = async (req, res) => {
  try {
    // CHANGED: only public fields are returned. The full Service document
    // contains cost, providerId, providerServiceId and service-level markup,
    // none of which a reseller should see.
    const services = await Service.find({
      status: "active",
    })
      .select(RESELLER_SERVICE_PUBLIC_FIELDS)
      .sort({
        sortOrder: 1,
        createdAt: 1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    console.error("GET RESELLER API SERVICES ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to get reseller services",
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createResellerController,
  getMyReseller,
  getResellerByCodeController,
  calculateResellerPriceController,
  recordResellerOrderController,
  addResellerEarningsController,
  addResellerBalanceController,
  updateResellerMarkupController,
  regenerateApiKeyController,
  enableApiController,
  disableApiController,
  getResellerApiBalanceController,
  getResellerApiServicesController,
  suspendResellerController,
  activateResellerController,
};