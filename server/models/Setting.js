const mongoose = require("mongoose");

// ======================================================
// SETTING SCHEMA
// ======================================================

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    // ==================================================
    // PAYMENT SETTINGS
    // ==================================================

    payment: {
      upiEnabled: {
        type: Boolean,
        default: true
      },

      qrEnabled: {
        type: Boolean,
        default: true
      },

      manualPaymentEnabled: {
        type: Boolean,
        default: true
      },

      upiId: {
        type: String,
        default: "",
        trim: true
      },

      qrImage: {
        type: String,
        default: "",
        trim: true
      },

      instructions: {
        type: String,
        default: "",
        trim: true
      }
    },

    // ==================================================
    // INVOICE / GST SETTINGS
    // ==================================================

    invoice: {
      enabled: {
        type: Boolean,
        default: true
      },

      businessName: {
        type: String,
        default: "",
        trim: true
      },

      gstin: {
        type: String,
        default: "",
        trim: true,
        uppercase: true
      },

      address: {
        type: String,
        default: "",
        trim: true
      },

      state: {
        type: String,
        default: "",
        trim: true
      },

      stateCode: {
        type: String,
        default: "",
        trim: true
      },

      gstRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },

      invoicePrefix: {
        type: String,
        default: "INV",
        trim: true,
        uppercase: true
      },

      invoiceNumberStart: {
        type: Number,
        default: 1,
        min: 1
      },

      pdfEnabled: {
        type: Boolean,
        default: false
      }
    }
  },
  {
    timestamps: true
  }
);

// ======================================================
// EXPORT MODEL
// ======================================================

module.exports = mongoose.model(
  "Setting",
  settingSchema
);