const mongoose = require("mongoose");

// ======================================================
// BRANDING SCHEMA
// ======================================================

const brandingSchema = new mongoose.Schema(
  {
    siteName: {
      type: String,
      required: true,
      trim: true
    },

    logoUrl: {
      type: String,
      default: "",
      trim: true
    },

    faviconUrl: {
      type: String,
      default: "",
      trim: true
    },

    primaryColor: {
      type: String,
      default: "#000000",
      trim: true
    },

    secondaryColor: {
      type: String,
      default: "#ffffff",
      trim: true
    },

    supportEmail: {
      type: String,
      default: "",
      trim: true
    },

    supportPhone: {
      type: String,
      default: "",
      trim: true
    },

    address: {
      type: String,
      default: "",
      trim: true
    },

    footerText: {
      type: String,
      default: "",
      trim: true
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
// MONGOOSE MODEL
// ======================================================

const Branding =
  mongoose.models.Branding ||
  mongoose.model("Branding", brandingSchema);

// ======================================================
// DEBUG
// ======================================================

console.log("========== BRANDING MODEL LOADED ==========");
console.log("Branding:", Branding);
console.log("Branding type:", typeof Branding);
console.log(
  "Branding.findOne:",
  typeof Branding.findOne
);
console.log(
  "Branding.find:",
  typeof Branding.find
);
console.log(
  "Branding.create:",
  typeof Branding.create
);
console.log(
  "Branding.findById:",
  typeof Branding.findById
);
console.log(
  "Branding.findByIdAndUpdate:",
  typeof Branding.findByIdAndUpdate
);
console.log(
  "Branding.findByIdAndDelete:",
  typeof Branding.findByIdAndDelete
);
console.log("==========================================");

module.exports = Branding;