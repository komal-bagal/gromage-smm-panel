
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
    // RESELLER
    // ==================================================

    resellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reseller",
      default: null,
      index: true
    },

    // Prevent duplicate reseller refunds
    resellerRefundedAt: {
      type: Date,
      default: null
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
    // WALLET
    // ==================================================

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      default: null,
      index: true
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
    // COUPON / DISCOUNT
    // ==================================================

    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
      index: true
    },

    couponCode: {
      type: String,
      default: null,
      trim: true,
      uppercase: true
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    originalCharge: {
      type: Number,
      default: 0,
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

    // Number of times the drip-feed order should run
    runs: {
      type: Number,
      default: null,
      min: 1
    },

    // Delay between drip-feed runs
    // Stored in seconds
    interval: {
      type: Number,
      default: null,
      min: 1
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

// User order history
orderSchema.index({
  userId: 1,
  createdAt: -1
});

// User + status order queries
orderSchema.index({
  userId: 1,
  status: 1,
  createdAt: -1
});

// Provider + status lookup
orderSchema.index({
  providerId: 1,
  status: 1,
  createdAt: -1
});

// Status based queries
orderSchema.index({
  status: 1,
  createdAt: -1
});

// Drip feed / processing queries
orderSchema.index({
  dripFeed: 1,
  status: 1,
  createdAt: -1
});

// Coupon lookup
orderSchema.index({
  couponId: 1,
  createdAt: -1
});

// Reseller order history
orderSchema.index({
  resellerId: 1,
  createdAt: -1
});

// ======================================================
// IDEMPOTENCY INDEX
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

const Order = mongoose.model("Order", orderSchema);

// ======================================================
// DEBUG - VERIFY RESELLER FIELD
// ======================================================

console.log("ORDER MODEL LOADED");
console.log(
  "ORDER resellerId PATH:",
  Order.schema.path("resellerId") ? "FOUND" : "NOT FOUND"
);

console.log(
  "ORDER resellerRefundedAt PATH:",
  Order.schema.path("resellerRefundedAt") ? "FOUND" : "NOT FOUND"
);

module.exports = Order;
