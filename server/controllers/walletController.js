const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const PaymentTransaction = require("../models/PaymentTransaction");
const User = require("../models/User");


// ======================================================
// GET WALLET
// ======================================================

const getWallet = async (req, res) => {
  try {
    const userId = req.userId;

    let wallet = await Wallet.findOne({ userId });

    // Create wallet if it does not exist
    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        status: "active"
      });
    }

    return res.status(200).json({
      message: "Wallet fetched successfully",

      wallet: {
        id: wallet._id,
        userId: wallet.userId,
        balance: wallet.balance,
        status: wallet.status,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
      }
    });

  } catch (error) {
    console.error("GET WALLET ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// CREDIT WALLET
// ======================================================

const creditWallet = async (req, res) => {
  try {
    const {
      amount,
      reference,
      transactionType
    } = req.body || {};

    const userId = req.userId;

    // --------------------------------------------------
    // VALIDATE AMOUNT
    // --------------------------------------------------

    if (
      amount === undefined ||
      amount === null ||
      Number(amount) <= 0
    ) {
      return res.status(400).json({
        message: "Amount must be greater than 0"
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
      return res.status(400).json({
        message: "Amount must be a valid number"
      });
    }

    // --------------------------------------------------
    // VALIDATE REFERENCE
    // --------------------------------------------------

    if (!reference || !reference.trim()) {
      return res.status(400).json({
        message: "Reference is required"
      });
    }

    // --------------------------------------------------
    // VALIDATE TRANSACTION TYPE
    // --------------------------------------------------

    const allowedTypes = [
      "credit",
      "recharge",
      "refund",
      "cashback",
      "referral_commission"
    ];

    const type = transactionType || "credit";

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        message: "Invalid transaction type"
      });
    }

    // --------------------------------------------------
    // FIND WALLET
    // --------------------------------------------------

    let wallet = await Wallet.findOne({
      userId
    });

    // --------------------------------------------------
    // CREATE WALLET IF NOT EXISTS
    // --------------------------------------------------

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        status: "active"
      });
    }

    // --------------------------------------------------
    // CHECK WALLET STATUS
    // --------------------------------------------------

    if (wallet.status !== "active") {
      return res.status(403).json({
        message: "Wallet is not active"
      });
    }

    // --------------------------------------------------
    // BALANCE BEFORE
    // --------------------------------------------------

    const balanceBefore = wallet.balance;

    // --------------------------------------------------
    // ATOMIC CREDIT
    // --------------------------------------------------

    const updatedWallet = await Wallet.findOneAndUpdate(
      {
        userId,
        status: "active"
      },
      {
        $inc: {
          balance: numericAmount
        }
      },
      {
        returnDocument: "after"
      }
    );

    if (!updatedWallet) {
      return res.status(400).json({
        message: "Unable to credit wallet"
      });
    }

    const balanceAfter = updatedWallet.balance;

    // --------------------------------------------------
    // CREATE WALLET LEDGER
    // --------------------------------------------------

    const transaction = await WalletTransaction.create({
      userId,
      walletId: updatedWallet._id,
      transactionType: type,
      reference: reference.trim(),
      amount: numericAmount,
      balanceBefore,
      balanceAfter,
      status: "completed"
    });

    // --------------------------------------------------
    // SYNC USER BALANCE
    // --------------------------------------------------

    await User.findByIdAndUpdate(
      userId,
      {
        balance: balanceAfter
      }
    );

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      message: "Wallet credited successfully",

      wallet: {
        id: updatedWallet._id,
        userId: updatedWallet.userId,
        balance: updatedWallet.balance,
        status: updatedWallet.status
      },

      transaction: {
        id: transaction._id,
        transactionType: transaction.transactionType,
        reference: transaction.reference,
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        status: transaction.status,
        createdAt: transaction.createdAt
      }
    });

  } catch (error) {
    console.error("CREDIT WALLET ERROR:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


// ======================================================
// DEBIT WALLET
// ======================================================

const debitWallet = async (req, res) => {
  try {
    const {
      amount,
      reference
    } = req.body || {};

    const userId = req.userId;

    // --------------------------------------------------
    // VALIDATE AMOUNT
    // --------------------------------------------------

    if (
      amount === undefined ||
      amount === null ||
      Number(amount) <= 0
    ) {
      return res.status(400).json({
        message: "Amount must be greater than 0"
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
      return res.status(400).json({
        message: "Amount must be a valid number"
      });
    }

    // --------------------------------------------------
    // VALIDATE REFERENCE
    // --------------------------------------------------

    if (!reference || !reference.trim()) {
      return res.status(400).json({
        message: "Reference is required"
      });
    }

    // --------------------------------------------------
    // FIND WALLET
    // --------------------------------------------------

    const currentWallet = await Wallet.findOne({
      userId
    });

    if (!currentWallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    // --------------------------------------------------
    // CHECK WALLET STATUS
    // --------------------------------------------------

    if (currentWallet.status !== "active") {
      return res.status(403).json({
        message: "Wallet is not active"
      });
    }

    // --------------------------------------------------
    // ATOMIC DEBIT
    // --------------------------------------------------

    const wallet = await Wallet.findOneAndUpdate(
      {
        userId,
        status: "active",
        balance: {
          $gte: numericAmount
        }
      },
      {
        $inc: {
          balance: -numericAmount
        }
      },
      {
        returnDocument: "before"
      }
    );

    // --------------------------------------------------
    // INSUFFICIENT BALANCE
    // --------------------------------------------------

    if (!wallet) {
      return res.status(400).json({
        message: "Insufficient wallet balance"
      });
    }

    // --------------------------------------------------
    // BALANCE CALCULATION
    // --------------------------------------------------

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - numericAmount;

    // --------------------------------------------------
    // CREATE WALLET LEDGER
    // --------------------------------------------------

    const transaction = await WalletTransaction.create({
      userId,
      walletId: wallet._id,
      transactionType: "debit",
      reference: reference.trim(),
      amount: numericAmount,
      balanceBefore,
      balanceAfter,
      status: "completed"
    });

    // --------------------------------------------------
    // SYNC USER BALANCE
    // --------------------------------------------------

    await User.findByIdAndUpdate(
      userId,
      {
        balance: balanceAfter
      }
    );

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      message: "Wallet debited successfully",

      wallet: {
        id: wallet._id,
        userId: wallet.userId,
        balance: balanceAfter,
        status: wallet.status
      },

      transaction: {
        id: transaction._id,
        transactionType: transaction.transactionType,
        reference: transaction.reference,
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        status: transaction.status,
        createdAt: transaction.createdAt
      }
    });

  } catch (error) {
    console.error("DEBIT WALLET ERROR:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


// ======================================================
// GET WALLET TRANSACTIONS
// ======================================================

const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.userId;

    console.log("GET WALLET TRANSACTIONS");
    console.log("User ID:", userId);

    const transactions = await WalletTransaction
      .find({
        userId
      })
      .sort({
        createdAt: -1
      });

    return res.status(200).json({
      message: "Wallet transactions fetched successfully",
      count: transactions.length,
      transactions
    });

  } catch (error) {
    console.error(
      "GET WALLET TRANSACTIONS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


// ======================================================
// CREATE WALLET RECHARGE
// ======================================================

const createRecharge = async (req, res) => {
  try {
    const {
      amount,
      reference,
      paymentMethod
    } = req.body || {};

    const userId = req.userId;

    // --------------------------------------------------
    // VALIDATE AMOUNT
    // --------------------------------------------------

    if (
      amount === undefined ||
      amount === null ||
      Number(amount) <= 0
    ) {
      return res.status(400).json({
        message: "Amount must be greater than 0"
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
      return res.status(400).json({
        message: "Amount must be a valid number"
      });
    }

    // --------------------------------------------------
    // VALIDATE REFERENCE
    // --------------------------------------------------

    if (!reference || !reference.trim()) {
      return res.status(400).json({
        message: "Reference is required"
      });
    }

    // --------------------------------------------------
    // VALIDATE PAYMENT METHOD
    // --------------------------------------------------

    const allowedPaymentMethods = [
      "razorpay",
      "upi",
      "qr",
      "manual"
    ];

    const method = paymentMethod || "manual";

    if (!allowedPaymentMethods.includes(method)) {
      return res.status(400).json({
        message: "Invalid payment method"
      });
    }

    // --------------------------------------------------
    // CHECK DUPLICATE REFERENCE
    // --------------------------------------------------

    const existingPayment = await PaymentTransaction.findOne({
      reference: reference.trim()
    });

    if (existingPayment) {
      return res.status(409).json({
        message: "Payment reference already exists"
      });
    }

    // --------------------------------------------------
    // CREATE PAYMENT TRANSACTION
    // --------------------------------------------------

    const paymentTransaction = await PaymentTransaction.create({
      userId,
      paymentMethod: method,
      transactionType: "recharge",
      reference: reference.trim(),
      amount: numericAmount,
      status: "pending"
    });

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(201).json({
      message: "Recharge request created successfully",

      payment: {
        id: paymentTransaction._id,
        userId: paymentTransaction.userId,
        paymentMethod: paymentTransaction.paymentMethod,
        transactionType: paymentTransaction.transactionType,
        reference: paymentTransaction.reference,
        amount: paymentTransaction.amount,
        status: paymentTransaction.status,
        createdAt: paymentTransaction.createdAt
      }
    });

  } catch (error) {
    console.error(
      "CREATE RECHARGE ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};


// ======================================================
// EXPORT
// ======================================================

module.exports = {
  getWallet,
  creditWallet,
  debitWallet,
  getWalletTransactions,
  createRecharge
};