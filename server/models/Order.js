const mongoose = require("mongoose");

// ======================================================
// ORDER STATUS
// ======================================================

const ORDER_STATUSES = [
  "pending",
  "processing",
  "in_progress",
  "completed",
  "partial",
  "canceled",
  "refunded",
  "failed"
];

// ======================================================
// ORDER SCHEMA
// ======================================================

const orderSchema = new mongoose.Schema(
  {
    // ==================================================
    // USER
    // ==================================================

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    // ==================================================
    // SERVICE
    // ==================================================

    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true
    },

    // ==================================================
    // PROVIDER
    // ==================================================

    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      default: null,
      index: true
    },

    providerOrderId: {
      type: String,
      default: null,
      trim: true,
      index: true
    },

    // ==================================================
    // PROVIDER RESPONSE
    // ==================================================

    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    // ==================================================
    // PROVIDER ERROR
    // ==================================================

    providerError: {
      type: String,
      default: null,
      trim: true
    },

    // ==================================================
    // PROVIDER SUBMISSION TIME
    // ==================================================

    providerSubmittedAt: {
      type: Date,
      default: null
    },

    // ==================================================
    // IDEMPOTENCY / DUPLICATE PROTECTION
    // ==================================================

    idempotencyKey: {
      type: String,
      trim: true,
      default: undefined
    },

    // ==================================================
    // WALLET TRANSACTION
    // ==================================================

    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletTransaction",
      default: null,
      index: true
    },

    // ==================================================
    // ORDER DETAILS
    // ==================================================

    link: {
      type: String,
      required: true,
      trim: true
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

    // ==================================================
    // PRICE / CHARGE
    // ==================================================

    charge: {
      type: Number,
      required: true,
      min: 0
    },

    // ==================================================
    // ORDER STATUS
    // ==================================================

    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "pending",
      index: true
    },

    // ==================================================
    // PROVIDER START COUNT
    // ==================================================

    startCount: {
      type: Number,
      default: 0,
      min: 0
    },

    // ==================================================
    // REMAINING QUANTITY
    // ==================================================

    remains: {
      type: Number,
      default: 0,
      min: 0
    },

    // ==================================================
    // REFILL
    // ==================================================

    refill: {
      type: Boolean,
      default: false,
      index: true
    },

    refillId: {
      type: String,
      default: null,
      trim: true
    },

    // ==================================================
    // CANCEL
    // ==================================================

    cancel: {
      type: Boolean,
      default: false,
      index: true
    },

    // ==================================================
    // DRIP FEED
    // ==================================================

    dripFeed: {
      type: Boolean,
      default: false,
      index: true
    },

    // ==================================================
    // NOTE
    // ==================================================

    note: {
      type: String,
      default: "",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// ======================================================
// INDEXES
// ======================================================

// ------------------------------------------------------
// User order history
// ------------------------------------------------------

orderSchema.index({
  userId: 1,
  createdAt: -1
});

// ------------------------------------------------------
// User + status order queries
// ------------------------------------------------------

orderSchema.index({
  userId: 1,
  status: 1,
  createdAt: -1
});

// ------------------------------------------------------
// Provider + status lookup
// Useful for background status synchronization
// ------------------------------------------------------

orderSchema.index({
  providerId: 1,
  status: 1,
  createdAt: -1
});

// ------------------------------------------------------
// Status based queries
// ------------------------------------------------------

orderSchema.index({
  status: 1,
  createdAt: -1
});

// ------------------------------------------------------
// Drip feed / processing queries
// ------------------------------------------------------

orderSchema.index({
  dripFeed: 1,
  status: 1,
  createdAt: -1
});

// ======================================================
// IDEMPOTENCY INDEX
// ======================================================
//
// Same Idempotency-Key cannot create another order.
//
// No key -> allowed
// Different key -> allowed
// Same key -> blocked
//
// ======================================================

orderSchema.index(
  {
    idempotencyKey: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: {
        $type: "string"
      }
    }
  }
);

// ======================================================
// PROVIDER ORDER UNIQUE PROTECTION
// ======================================================
//
// A providerOrderId should belong to only one order
// for a particular provider.
//
// Orders without providerOrderId are allowed.
//
// ======================================================

orderSchema.index(
  {
    providerId: 1,
    providerOrderId: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      providerId: {
        $type: "objectId"
      },
      providerOrderId: {
        $type: "string"
      }
    }
  }
);

// ======================================================
// MODEL
// ======================================================

const Order = mongoose.model(
  "Order",
  orderSchema
);

module.exports = Order;