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

    // ==================================================
    // PROVIDER SORT ORDER
    // ==================================================

    sortOrder: {
      type: Number,
      default: 0,
      min: 0
    },

    // ==================================================
    // PROVIDER PRIORITY
    // ==================================================
    //
    // Lower number = higher priority.
    //
    // Example:
    //
    // priority 1 -> first provider
    // priority 2 -> fallback provider
    // priority 3 -> next fallback provider
    //
    // ==================================================

    priority: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Priority must be an integer"
      },
      index: true
    },

    // ==================================================
    // DEFAULT PROVIDER
    // ==================================================

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