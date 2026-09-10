const mongoose = require("mongoose");

// ======================================================
// SERVICE SCHEMA
// ======================================================

const serviceSchema = new mongoose.Schema(
  {
    // --------------------------------------------------
    // INTERNAL SERVICE ID
    // --------------------------------------------------

    serviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    // --------------------------------------------------
    // CATEGORY
    // --------------------------------------------------

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    // --------------------------------------------------
    // PLATFORM
    // --------------------------------------------------

    platform: {
      type: String,
      required: true,
      trim: true
    },

    // --------------------------------------------------
    // SERVICE NAME
    // --------------------------------------------------

    name: {
      type: String,
      required: true,
      trim: true
    },

    // --------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------

    description: {
      type: String,
      default: ""
    },

    // --------------------------------------------------
    // PROVIDER
    // --------------------------------------------------

    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      default: null
    },

    // --------------------------------------------------
    // PROVIDER'S EXTERNAL SERVICE ID
    // --------------------------------------------------

    providerServiceId: {
      type: String,
      default: null,
      trim: true
    },

    // --------------------------------------------------
    // PROVIDER COST
    // --------------------------------------------------

    cost: {
      type: Number,
      required: true,
      min: 0
    },

    // --------------------------------------------------
    // CUSTOMER SELLING PRICE
    // --------------------------------------------------

    sellingPrice: {
      type: Number,
      required: true,
      min: 0
    },

    // --------------------------------------------------
    // MINIMUM ORDER
    // --------------------------------------------------

    min: {
      type: Number,
      required: true,
      min: 1
    },

    // --------------------------------------------------
    // MAXIMUM ORDER
    // --------------------------------------------------

    max: {
      type: Number,
      required: true,
      min: 1
    },

    // --------------------------------------------------
    // SERVICE STATUS
    // --------------------------------------------------

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    },

    // --------------------------------------------------
    // SORT ORDER
    // --------------------------------------------------

    sortOrder: {
      type: Number,
      default: 0,
      min: 0
    },

    // --------------------------------------------------
    // REFILL SUPPORT
    // --------------------------------------------------

    refill: {
      type: Boolean,
      default: false
    },

    // --------------------------------------------------
    // CANCEL SUPPORT
    // --------------------------------------------------

    cancel: {
      type: Boolean,
      default: false
    },

    // --------------------------------------------------
    // DRIP FEED SUPPORT
    // --------------------------------------------------

    dripFeed: {
      type: Boolean,
      default: false
    },

    // --------------------------------------------------
    // MARKUP TYPE
    // --------------------------------------------------

    markupType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed"
    },

    // --------------------------------------------------
    // MARKUP VALUE
    // --------------------------------------------------

    markupValue: {
      type: Number,
      default: 0,
      min: 0
    },

    // --------------------------------------------------
    // IMPORTED FROM PROVIDER
    // --------------------------------------------------

    isImported: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// ======================================================
// PROVIDER SERVICE UNIQUE INDEX
// ======================================================
//
// Prevents the same external service from being
// duplicated for the same provider.
//
// Example:
//
// Provider A + service 123  → allowed
// Provider B + service 123  → allowed
// Provider A + service 123  → duplicate
//
// sparse: true allows manually-created services that
// don't have providerId/providerServiceId.
//

serviceSchema.index(
  {
    providerId: 1,
    providerServiceId: 1
  },
  {
    unique: true,
    sparse: true
  }
);

// ======================================================
// MODEL
// ======================================================

module.exports = mongoose.model(
  "Service",
  serviceSchema
);