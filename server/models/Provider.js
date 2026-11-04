const mongoose = require("mongoose");

const providerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    apiKey: {
      type: String,
      trim: true,
      default: "",
    },
    balance: {
      type: Number,
      default: 0.0,
    },
    currency: {
      type: String,
      default: "USD",
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    priority: {
      type: Number,
      enum: [1, 2, 3],
      default: 2, // 1: High, 2: Medium, 3: Low
    },
    services: {
      type: Number,
      default: 0,
    },
    autoSync: {
      type: Boolean,
      default: true,
    },
    autoRefill: {
      type: Boolean,
      default: false,
    },
    lastSync: {
      type: String,
      default: "Never",
    },
    lastOrderSync: {
      type: String,
      default: "Never",
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    autoMarginEnabled: {
      type: Boolean,
      default: true,
    },
    autoMarginType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    autoMarginPercent: {
      type: Number,
      default: 20.0,
      min: 0,
    },
    autoMarginFixed: {
      type: Number,
      default: 5.0,
      min: 0,
    },
    minMargin: {
      type: Number,
      default: 1.0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Provider", providerSchema);
