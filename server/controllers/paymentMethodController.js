const PaymentMethod = require("../models/PaymentMethod");

// ======================================================
// CREATE PAYMENT METHOD
// ======================================================

const createPaymentMethod = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      type,
      minAmount,
      maxAmount,
      feeType,
      feeValue,
      instructions,
      config,
      sortOrder,
      isPublic,
      isActive
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Name and code are required"
      });
    }

    const normalizedCode = code.toLowerCase().trim();

    const existing = await PaymentMethod.findOne({
      code: normalizedCode
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Payment method code already exists"
      });
    }

    const paymentMethod = await PaymentMethod.create({
      name,
      code: normalizedCode,
      description,
      type,
      minAmount,
      maxAmount,
      feeType,
      feeValue,
      instructions,
      config,
      sortOrder,
      isPublic,
      isActive,
      updatedBy: req.user?._id || null
    });

    return res.status(201).json({
      success: true,
      message: "Payment method created successfully",
      data: paymentMethod
    });

  } catch (error) {
    console.error(
      "CREATE PAYMENT METHOD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create payment method",
      error: error.message
    });
  }
};


// ======================================================
// GET ALL PAYMENT METHODS
// ======================================================

const getAllPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find()
      .sort({
        sortOrder: 1,
        createdAt: -1
      });

    return res.status(200).json({
      success: true,
      count: paymentMethods.length,
      data: paymentMethods
    });

  } catch (error) {
    console.error(
      "GET ALL PAYMENT METHODS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment methods",
      error: error.message
    });
  }
};


// ======================================================
// GET PUBLIC PAYMENT METHODS
// ======================================================

const getPublicPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find({
      isPublic: true,
      isActive: true
    }).sort({
      sortOrder: 1,
      createdAt: -1
    });

    return res.status(200).json({
      success: true,
      count: paymentMethods.length,
      data: paymentMethods
    });

  } catch (error) {
    console.error(
      "GET PUBLIC PAYMENT METHODS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch public payment methods",
      error: error.message
    });
  }
};


// ======================================================
// GET PAYMENT METHOD BY ID
// ======================================================

const getPaymentMethodById = async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findById(
      req.params.id
    );

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: paymentMethod
    });

  } catch (error) {
    console.error(
      "GET PAYMENT METHOD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment method",
      error: error.message
    });
  }
};


// ======================================================
// UPDATE PAYMENT METHOD
// ======================================================

const updatePaymentMethod = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      type,
      minAmount,
      maxAmount,
      feeType,
      feeValue,
      instructions,
      config,
      sortOrder,
      isPublic,
      isActive
    } = req.body;

    const paymentMethod =
      await PaymentMethod.findById(req.params.id);

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found"
      });
    }

    // Update code
    if (code !== undefined) {
      const normalizedCode =
        code.toLowerCase().trim();

      const existing =
        await PaymentMethod.findOne({
          code: normalizedCode,
          _id: {
            $ne: req.params.id
          }
        });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Payment method code already exists"
        });
      }

      paymentMethod.code = normalizedCode;
    }

    // Update fields
    if (name !== undefined)
      paymentMethod.name = name;

    if (description !== undefined)
      paymentMethod.description = description;

    if (type !== undefined)
      paymentMethod.type = type;

    if (minAmount !== undefined)
      paymentMethod.minAmount = minAmount;

    if (maxAmount !== undefined)
      paymentMethod.maxAmount = maxAmount;

    if (feeType !== undefined)
      paymentMethod.feeType = feeType;

    if (feeValue !== undefined)
      paymentMethod.feeValue = feeValue;

    if (instructions !== undefined)
      paymentMethod.instructions = instructions;

    if (config !== undefined)
      paymentMethod.config = config;

    if (sortOrder !== undefined)
      paymentMethod.sortOrder = sortOrder;

    if (isPublic !== undefined)
      paymentMethod.isPublic = isPublic;

    if (isActive !== undefined)
      paymentMethod.isActive = isActive;

    paymentMethod.updatedBy =
      req.user?._id ||
      paymentMethod.updatedBy;

    await paymentMethod.save();

    return res.status(200).json({
      success: true,
      message: "Payment method updated successfully",
      data: paymentMethod
    });

  } catch (error) {
    console.error(
      "UPDATE PAYMENT METHOD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update payment method",
      error: error.message
    });
  }
};


// ======================================================
// DELETE PAYMENT METHOD
// ======================================================

const deletePaymentMethod = async (req, res) => {
  try {
    const paymentMethod =
      await PaymentMethod.findById(req.params.id);

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found"
      });
    }

    await PaymentMethod.findByIdAndDelete(
      req.params.id
    );

    return res.status(200).json({
      success: true,
      message: "Payment method deleted successfully"
    });

  } catch (error) {
    console.error(
      "DELETE PAYMENT METHOD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete payment method",
      error: error.message
    });
  }
};


// ======================================================
// EXPORT CONTROLLERS
// ======================================================

module.exports = {
  createPaymentMethod,
  getAllPaymentMethods,
  getPublicPaymentMethods,
  getPaymentMethodById,
  updatePaymentMethod,
  deletePaymentMethod
};


// ======================================================
// DEBUG
// ======================================================

console.log(
  "========== PAYMENT METHOD CONTROLLER LOADED =========="
);

console.log(
  "createPaymentMethod:",
  typeof createPaymentMethod
);

console.log(
  "getAllPaymentMethods:",
  typeof getAllPaymentMethods
);

console.log(
  "getPublicPaymentMethods:",
  typeof getPublicPaymentMethods
);

console.log(
  "getPaymentMethodById:",
  typeof getPaymentMethodById
);

console.log(
  "updatePaymentMethod:",
  typeof updatePaymentMethod
);

console.log(
  "deletePaymentMethod:",
  typeof deletePaymentMethod
);

console.log(
  "======================================================="
);