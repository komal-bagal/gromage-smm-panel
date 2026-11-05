const mongoose = require("mongoose");

const resellerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    resellerCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    markupType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },

    markupValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalOrders: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["active", "suspended", "inactive"],
      default: "active",
    },

    apiEnabled: {
      type: Boolean,
      default: true,
    },

    apiKey: {
      type: String,
      default: null,
      select: false,
    },

    apiLastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Do NOT add schema.index() for user or resellerCode.
// unique: true already creates those indexes.

// Every reseller API request looks the reseller up by apiKey, so it needs an
// index. Partial filter: ignore reseller docs that have no key (null).
resellerSchema.index(
  { apiKey: 1 },
  {
    unique: true,
    partialFilterExpression: { apiKey: { $type: "string" } },
  }
);

const Reseller =
  mongoose.models.Reseller ||
  mongoose.model("Reseller", resellerSchema);

module.exports = Reseller;