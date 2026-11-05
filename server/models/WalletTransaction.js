
const mongoose = require("mongoose");

// ======================================================
// WALLET TRANSACTION SCHEMA
// ======================================================

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true,
    },

    transactionType: {
      type: String,
      enum: [
        "credit",
        "debit",
        "recharge",
        "refund",
        "cashback",
        "referral_commission",
      ],
      required: true,
    },

    reference: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
    },

    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed", "reversed"],
      default: "completed",
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// PREVENT DUPLICATE REFUNDS
// ======================================================
//
// Only refund transactions are subject to this unique index.
//
// For any given reference, only one transaction with
// transactionType: "refund" can exist.
//
// Credit, debit, recharge, cashback, and other transaction
// types can reuse the same reference.
//
// This protects against duplicate refund ledger entries.
// Wallet balance changes must also be performed inside
// the same MongoDB transaction as the ledger insertion.
// ======================================================

walletTransactionSchema.index(
  {
    reference: 1,
    transactionType: 1,
  },
  {
    unique: true,
    name: "unique_refund_reference",
    partialFilterExpression: {
      transactionType: "refund",
    },
  }
);

// ======================================================
// USER TRANSACTION HISTORY INDEX
// ======================================================

walletTransactionSchema.index({
  userId: 1,
  createdAt: -1,
});

// ======================================================
// WALLET TRANSACTION HISTORY INDEX
// ======================================================

walletTransactionSchema.index({
  walletId: 1,
  createdAt: -1,
});

// ======================================================
// STATUS + DATE INDEX
// ======================================================

walletTransactionSchema.index({
  status: 1,
  createdAt: -1,
});

// ======================================================
// MODEL EXPORT
// ======================================================

module.exports =
  mongoose.models.WalletTransaction ||
  mongoose.model("WalletTransaction", walletTransactionSchema);
