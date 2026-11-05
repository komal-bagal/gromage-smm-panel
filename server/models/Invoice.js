
const mongoose = require("mongoose");

// ======================================================
// INVOICE ITEM SCHEMA
// ======================================================

const invoiceItemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    paymentTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentTransaction",
      default: null,
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },

    unitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxableAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    gstRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    cgstRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    sgstRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    igstRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    cgstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    sgstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    igstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalGstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

// ======================================================
// INVOICE SCHEMA
// ======================================================

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // IMPORTANT:
    // No index: true here.
    // A unique partial index is defined below.
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    // IMPORTANT:
    // No index: true here.
    // A unique partial index is defined below.
    paymentTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentTransaction",
      default: null,
    },

    invoiceType: {
      type: String,
      enum: ["order", "recharge"],
      required: true,
      index: true,
    },

    customer: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
    },

    seller: {
      businessName: {
        type: String,
        default: "",
        trim: true,
      },

      gstin: {
        type: String,
        default: "",
        trim: true,
        uppercase: true,
      },

      address: {
        type: String,
        default: "",
        trim: true,
      },

      state: {
        type: String,
        default: "",
        trim: true,
      },

      stateCode: {
        type: String,
        default: "",
        trim: true,
      },
    },

    placeOfSupply: {
      state: {
        type: String,
        default: "",
        trim: true,
      },

      stateCode: {
        type: String,
        default: "",
        trim: true,
      },
    },

    items: {
      type: [invoiceItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: "Invoice must contain at least one item",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    totalDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxableAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    gstRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    cgstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    sgstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    igstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalGstAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
      trim: true,
      uppercase: true,
    },

    status: {
      type: String,
      enum: ["draft", "issued", "cancelled"],
      default: "issued",
      index: true,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    pdfUrl: {
      type: String,
      default: null,
      trim: true,
    },

    pdfGenerated: {
      type: Boolean,
      default: false,
    },

    pdfGeneratedAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// INDEXES
// ======================================================

// User invoice history
invoiceSchema.index({
  userId: 1,
  createdAt: -1,
});

// Invoice type filtering
invoiceSchema.index({
  invoiceType: 1,
  createdAt: -1,
});

// Status filtering
invoiceSchema.index({
  status: 1,
  createdAt: -1,
});

// ======================================================
// UNIQUE BUSINESS INDEXES
// ======================================================

// One invoice per order.
//
// Applies only when orderId contains an ObjectId.
// Recharge invoices have orderId = null.
invoiceSchema.index(
  { orderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      orderId: {
        $type: "objectId",
      },
    },
  }
);

// One invoice per payment transaction.
//
// Applies only when paymentTransactionId contains an ObjectId.
// Order invoices have paymentTransactionId = null.
invoiceSchema.index(
  { paymentTransactionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      paymentTransactionId: {
        $type: "objectId",
      },
    },
  }
);

// ======================================================
// MODEL
// ======================================================

const Invoice =
  mongoose.models.Invoice ||
  mongoose.model("Invoice", invoiceSchema);

module.exports = Invoice;
