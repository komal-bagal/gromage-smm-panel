const mongoose = require("mongoose");

// ======================================================
// PROVIDER SCHEMA
// ======================================================

const providerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },

    apiUrl: {
      type: String,
      required: true,
      trim: true
    },

    apiKey: {
      type: String,
      required: true,
      trim: true,
      select: false
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },

    description: {
      type: String,
      default: "",
      trim: true
    },

    sortOrder: {
      type: Number,
      default: 0,
      min: 0
    },

    isDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// ======================================================
// PROVIDER MODEL
// ======================================================

const Provider = mongoose.model(
  "Provider",
  providerSchema
);

module.exports = Provider;