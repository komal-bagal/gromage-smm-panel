const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
      index: true
    },

    transactionType: {
      type: String,
      enum: [
        "credit",
        "debit",
        "recharge",
        "refund",
        "cashback",
        "referral_commission"
      ],
      required: true
    },

    reference: {
      type: String,
      required: true,
      trim: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    balanceBefore: {
      type: Number,
      required: true,
      min: 0
    },

    balanceAfter: {
      type: Number,
      required: true,
      min: 0
    },

    status: {
      type: String,
      enum: [
        "pending",
        "completed",
        "failed",
        "reversed"
      ],
      default: "completed"
    }
  },
  {
    timestamps: true
  }
);


/*
 * Prevent duplicate financial transactions
 * with the same reference and transaction type.
 *
 * Example:
 * REFUND-ORDER-68abc123 + refund
 *
 * The same refund cannot be inserted twice.
 */
walletTransactionSchema.index(
  {
    reference: 1,
    transactionType: 1
  },
  {
    unique: true
  }
);


/*
 * Useful indexes for wallet transaction history
 * and user-based transaction queries.
 */
walletTransactionSchema.index({
  userId: 1,
  createdAt: -1
});

walletTransactionSchema.index({
  walletId: 1,
  createdAt: -1
});

walletTransactionSchema.index({
  status: 1,
  createdAt: -1
});


module.exports = mongoose.model(
  "WalletTransaction",
  walletTransactionSchema
);