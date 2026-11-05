const mongoose = require("mongoose");

// ======================================================
// PAYMENT METHOD SCHEMA
// ======================================================

const paymentMethodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },

    description: {
      type: String,
      default: "",
      trim: true
    },

    type: {
      type: String,
      enum: [
        "gateway",
        "manual",
        "bank_transfer",
        "upi",
        "qr",
        "other"
      ],
      default: "gateway",
      index: true
    },

    minAmount: {
      type: Number,
      default: 0
    },

    maxAmount: {
      type: Number,
      default: null
    },

    feeType: {
      type: String,
      enum: [
        "fixed",
        "percentage",
        "none"
      ],
      default: "none"
    },

    feeValue: {
      type: Number,
      default: 0
    },

    instructions: {
      type: String,
      default: ""
    },

    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    sortOrder: {
      type: Number,
      default: 0,
      index: true
    },

    isPublic: {
      type: Boolean,
      default: true,
      index: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);


// ======================================================
// CREATE / REUSE MODEL
// ======================================================

const PaymentMethod =
  mongoose.models.PaymentMethod ||
  mongoose.model(
    "PaymentMethod",
    paymentMethodSchema
  );


// ======================================================
// DEBUG
// ======================================================

console.log(
  "========== PAYMENT METHOD MODEL LOADED =========="
);

console.log(
  "PaymentMethod:",
  PaymentMethod
);

console.log(
  "PaymentMethod type:",
  typeof PaymentMethod
);

console.log(
  "PaymentMethod.findOne:",
  typeof PaymentMethod.findOne
);

console.log(
  "PaymentMethod.find:",
  typeof PaymentMethod.find
);

console.log(
  "PaymentMethod.create:",
  typeof PaymentMethod.create
);

console.log(
  "PaymentMethod.findById:",
  typeof PaymentMethod.findById
);

console.log(
  "PaymentMethod.findByIdAndDelete:",
  typeof PaymentMethod.findByIdAndDelete
);

console.log(
  "================================================="
);


// ======================================================
// EXPORT
// ======================================================

module.exports = PaymentMethod;