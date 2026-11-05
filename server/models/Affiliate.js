
const mongoose = require("mongoose");

const affiliateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    referralCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    referredUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Stores order IDs for which commission has already been processed.
    // This prevents duplicate commission for the same order.
    processedCommissionOrders: [
      {
        type: String,
        trim: true,
      },
    ],

    commissionRate: {
      type: Number,
      default: 5,
      min: 0,
      max: 100,
    },

    totalReferrals: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },

    pendingEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },

    paidEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Affiliate =
  mongoose.models.Affiliate ||
  mongoose.model("Affiliate", affiliateSchema);

module.exports = Affiliate;
