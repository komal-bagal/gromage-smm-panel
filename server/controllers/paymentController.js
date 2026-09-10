const mongoose = require("mongoose");

const PaymentTransaction = require("../models/PaymentTransaction");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const User = require("../models/User");

// ======================================================
// GET ALL PAYMENT TRANSACTIONS
// ======================================================

const getAllPayments = async (req, res) => {
  try {
    const payments = await PaymentTransaction
      .find()
      .populate("userId", "email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Payment transactions fetched successfully",
      count: payments.length,
      payments
    });

  } catch (error) {
    console.error("GET ALL PAYMENTS ERROR:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// ======================================================
// GET PAYMENT BY ID
// ======================================================

const getPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        message: "Invalid payment ID"
      });
    }

    const payment = await PaymentTransaction
      .findById(paymentId)
      .populate("userId", "email role");

    if (!payment) {
      return res.status(404).json({
        message: "Payment transaction not found"
      });
    }

    return res.status(200).json({
      message: "Payment transaction fetched successfully",
      payment
    });

  } catch (error) {
    console.error("GET PAYMENT BY ID ERROR:", error);

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// ======================================================
// APPROVE RECHARGE
// ======================================================

const approveRecharge = async (req, res) => {
  let session = null;

  try {
    const { paymentId } = req.params;

    // --------------------------------------------------
    // VALIDATE PAYMENT ID
    // --------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        message: "Invalid payment ID"
      });
    }

    // --------------------------------------------------
    // FIND PAYMENT
    // --------------------------------------------------

    const payment = await PaymentTransaction.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment transaction not found"
      });
    }

    // --------------------------------------------------
    // VALIDATE TRANSACTION TYPE
    // --------------------------------------------------

    if (payment.transactionType !== "recharge") {
      return res.status(400).json({
        message: "Only recharge payments can be approved"
      });
    }

    // --------------------------------------------------
    // CHECK PAYMENT STATUS
    // --------------------------------------------------

    if (payment.status === "completed") {
      return res.status(400).json({
        message: "Payment has already been approved"
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        message:
          `Payment cannot be approved because it is already ${payment.status}`
      });
    }

    // --------------------------------------------------
    // VALIDATE USER
    // --------------------------------------------------

    if (!payment.userId) {
      return res.status(400).json({
        message: "Payment is not associated with a user"
      });
    }

    // --------------------------------------------------
    // VALIDATE AMOUNT
    // --------------------------------------------------

    if (!payment.amount || payment.amount <= 0) {
      return res.status(400).json({
        message: "Payment amount must be greater than 0"
      });
    }

    // --------------------------------------------------
    // START DATABASE TRANSACTION
    // --------------------------------------------------

    session = await mongoose.startSession();
    session.startTransaction();

    // --------------------------------------------------
    // FIND WALLET
    // --------------------------------------------------

    let wallet = await Wallet.findOne({
      userId: payment.userId
    }).session(session);

    // --------------------------------------------------
    // CREATE WALLET IF NOT EXISTS
    // --------------------------------------------------

    if (!wallet) {
      const createdWallet = await Wallet.create(
        [
          {
            userId: payment.userId,
            balance: 0,
            status: "active"
          }
        ],
        {
          session
        }
      );

      wallet = createdWallet[0];
    }

    // --------------------------------------------------
    // CHECK WALLET STATUS
    // --------------------------------------------------

    if (wallet.status !== "active") {
      await session.abortTransaction();

      return res.status(403).json({
        message: "Wallet is not active"
      });
    }

    // --------------------------------------------------
    // BALANCE BEFORE
    // --------------------------------------------------

    const balanceBefore = wallet.balance;

    // --------------------------------------------------
    // CREDIT WALLET
    // --------------------------------------------------

    const updatedWallet = await Wallet.findOneAndUpdate(
      {
        _id: wallet._id,
        userId: payment.userId,
        status: "active"
      },
      {
        $inc: {
          balance: payment.amount
        }
      },
      {
        new: true,
        session
      }
    );

    if (!updatedWallet) {
      await session.abortTransaction();

      return res.status(400).json({
        message: "Unable to credit wallet"
      });
    }

    // --------------------------------------------------
    // BALANCE AFTER
    // --------------------------------------------------

    const balanceAfter = updatedWallet.balance;

    // --------------------------------------------------
    // CREATE WALLET TRANSACTION
    // --------------------------------------------------

    const walletTransactions = await WalletTransaction.create(
      [
        {
          userId: payment.userId,
          walletId: updatedWallet._id,
          transactionType: "recharge",
          reference: payment.reference,
          amount: payment.amount,
          balanceBefore,
          balanceAfter,
          status: "completed"
        }
      ],
      {
        session
      }
    );

    const walletTransaction = walletTransactions[0];

    // --------------------------------------------------
    // UPDATE PAYMENT
    // --------------------------------------------------

    payment.status = "completed";

    await payment.save({
      session
    });

    // --------------------------------------------------
    // UPDATE USER BALANCE
    // --------------------------------------------------

    await User.findByIdAndUpdate(
      payment.userId,
      {
        balance: balanceAfter
      },
      {
        new: true,
        session
      }
    );

    // --------------------------------------------------
    // COMMIT TRANSACTION
    // --------------------------------------------------

    await session.commitTransaction();

    // --------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      message: "Recharge approved successfully",

      payment: {
        id: payment._id,
        userId: payment.userId,
        paymentMethod: payment.paymentMethod,
        transactionType: payment.transactionType,
        reference: payment.reference,
        amount: payment.amount,
        status: payment.status,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      },

      wallet: {
        id: updatedWallet._id,
        userId: updatedWallet.userId,
        balance: updatedWallet.balance,
        status: updatedWallet.status
      },

      transaction: {
        id: walletTransaction._id,
        transactionType: walletTransaction.transactionType,
        reference: walletTransaction.reference,
        amount: walletTransaction.amount,
        balanceBefore: walletTransaction.balanceBefore,
        balanceAfter: walletTransaction.balanceAfter,
        status: walletTransaction.status,
        createdAt: walletTransaction.createdAt
      }
    });

  } catch (error) {

    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error(
          "APPROVE RECHARGE ABORT ERROR:",
          abortError
        );
      }
    }

    console.error(
      "APPROVE RECHARGE ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });

  } finally {

    if (session) {
      await session.endSession();
    }
  }
};

// ======================================================
// REJECT RECHARGE
// ======================================================

const rejectRecharge = async (req, res) => {
  try {
    const { paymentId } = req.params;

    // --------------------------------------------------
    // VALIDATE PAYMENT ID
    // --------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        message: "Invalid payment ID"
      });
    }

    // --------------------------------------------------
    // FIND PAYMENT
    // --------------------------------------------------

    const payment = await PaymentTransaction.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment transaction not found"
      });
    }

    // --------------------------------------------------
    // VALIDATE TRANSACTION TYPE
    // --------------------------------------------------

    if (payment.transactionType !== "recharge") {
      return res.status(400).json({
        message: "Only recharge payments can be rejected"
      });
    }

    // --------------------------------------------------
    // CHECK PAYMENT STATUS
    // --------------------------------------------------

    if (payment.status !== "pending") {
      return res.status(400).json({
        message:
          `Payment cannot be rejected because it is already ${payment.status}`
      });
    }

    // --------------------------------------------------
    // UPDATE PAYMENT
    // --------------------------------------------------

    payment.status = "rejected";

    await payment.save();

    // --------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      message: "Recharge rejected successfully",

      payment: {
        id: payment._id,
        userId: payment.userId,
        paymentMethod: payment.paymentMethod,
        transactionType: payment.transactionType,
        reference: payment.reference,
        amount: payment.amount,
        status: payment.status,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      }
    });

  } catch (error) {
    console.error(
      "REJECT RECHARGE ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// ======================================================
// PAYMENT WEBHOOK
// ======================================================

const paymentWebhook = async (req, res) => {
  let session = null;

  try {

    // ==================================================
    // IMPORTANT BODY FIX
    // ==================================================
    // req.body can be undefined when the request does not
    // contain a JSON body.
    //
    // Never directly destructure req.body.
    // ==================================================

    const body = req.body || {};

    console.log(
      "PAYMENT WEBHOOK BODY:",
      body
    );

    const reference = body.reference;
    const gatewayTransactionId =
      body.gatewayTransactionId;
    const status = body.status;

    // --------------------------------------------------
    // VALIDATE REFERENCE
    // --------------------------------------------------

    if (
      !reference ||
      typeof reference !== "string" ||
      !reference.trim()
    ) {
      return res.status(400).json({
        message: "Payment reference is required"
      });
    }

    // --------------------------------------------------
    // VALIDATE STATUS
    // --------------------------------------------------

    const allowedStatuses = [
      "completed",
      "failed",
      "rejected"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid webhook payment status"
      });
    }

    // --------------------------------------------------
    // FIND PAYMENT
    // --------------------------------------------------

    const payment = await PaymentTransaction.findOne({
      reference: reference.trim()
    });

    if (!payment) {
      return res.status(404).json({
        message: "Payment transaction not found"
      });
    }

    // --------------------------------------------------
    // CHECK TRANSACTION TYPE
    // --------------------------------------------------

    if (payment.transactionType !== "recharge") {
      return res.status(400).json({
        message:
          "Webhook is only supported for recharge payments"
      });
    }

    // --------------------------------------------------
    // VALIDATE USER
    // --------------------------------------------------

    if (!payment.userId) {
      return res.status(400).json({
        message: "Payment is not associated with a user"
      });
    }

    // --------------------------------------------------
    // VALIDATE AMOUNT
    // --------------------------------------------------

    if (!payment.amount || payment.amount <= 0) {
      return res.status(400).json({
        message:
          "Payment amount must be greater than 0"
      });
    }

    // --------------------------------------------------
    // IDEMPOTENCY PROTECTION
    // --------------------------------------------------

    if (payment.status === "completed") {
      return res.status(200).json({
        message: "Payment already completed",

        payment: {
          id: payment._id,
          reference: payment.reference,
          amount: payment.amount,
          status: payment.status,
          gatewayTransactionId:
            payment.gatewayTransactionId
        }
      });
    }

    // --------------------------------------------------
    // ALREADY FAILED / REJECTED
    // --------------------------------------------------

    if (
      payment.status === "failed" ||
      payment.status === "rejected"
    ) {
      return res.status(400).json({
        message:
          `Payment is already ${payment.status}`
      });
    }

    // --------------------------------------------------
    // UPDATE GATEWAY TRANSACTION ID
    // --------------------------------------------------

    if (gatewayTransactionId) {
      payment.gatewayTransactionId =
        String(gatewayTransactionId).trim();
    }

    // ==================================================
    // FAILED PAYMENT
    // ==================================================

    if (status === "failed") {

      payment.status = "failed";

      await payment.save();

      return res.status(200).json({
        message: "Payment marked as failed",

        payment: {
          id: payment._id,
          reference: payment.reference,
          amount: payment.amount,
          status: payment.status,
          gatewayTransactionId:
            payment.gatewayTransactionId
        }
      });
    }

    // ==================================================
    // REJECTED PAYMENT
    // ==================================================

    if (status === "rejected") {

      payment.status = "rejected";

      await payment.save();

      return res.status(200).json({
        message: "Payment marked as rejected",

        payment: {
          id: payment._id,
          reference: payment.reference,
          amount: payment.amount,
          status: payment.status,
          gatewayTransactionId:
            payment.gatewayTransactionId
        }
      });
    }

    // ==================================================
    // COMPLETED PAYMENT
    // ==================================================

    session = await mongoose.startSession();

    session.startTransaction();

    // --------------------------------------------------
    // RE-FETCH PAYMENT INSIDE TRANSACTION
    // --------------------------------------------------

    const transactionPayment =
      await PaymentTransaction.findById(
        payment._id
      ).session(session);

    if (!transactionPayment) {
      await session.abortTransaction();

      return res.status(404).json({
        message: "Payment transaction not found"
      });
    }

    // --------------------------------------------------
    // DUPLICATE PROTECTION INSIDE TRANSACTION
    // --------------------------------------------------

    if (transactionPayment.status === "completed") {
      await session.abortTransaction();

      return res.status(200).json({
        message: "Payment already completed",

        payment: transactionPayment
      });
    }

    // --------------------------------------------------
    // FIND WALLET
    // --------------------------------------------------

    let wallet = await Wallet.findOne({
      userId: transactionPayment.userId
    }).session(session);

    // --------------------------------------------------
    // CREATE WALLET IF NOT EXISTS
    // --------------------------------------------------

    if (!wallet) {

      const createdWallet =
        await Wallet.create(
          [
            {
              userId:
                transactionPayment.userId,
              balance: 0,
              status: "active"
            }
          ],
          {
            session
          }
        );

      wallet = createdWallet[0];
    }

    // --------------------------------------------------
    // CHECK WALLET STATUS
    // --------------------------------------------------

    if (wallet.status !== "active") {

      await session.abortTransaction();

      return res.status(403).json({
        message: "Wallet is not active"
      });
    }

    // --------------------------------------------------
    // BALANCE BEFORE
    // --------------------------------------------------

    const balanceBefore =
      wallet.balance;

    // --------------------------------------------------
    // CREDIT WALLET
    // --------------------------------------------------

    const updatedWallet =
      await Wallet.findOneAndUpdate(
        {
          _id: wallet._id,
          userId:
            transactionPayment.userId,
          status: "active"
        },
        {
          $inc: {
            balance:
              transactionPayment.amount
          }
        },
        {
          new: true,
          session
        }
      );

    if (!updatedWallet) {

      await session.abortTransaction();

      return res.status(400).json({
        message: "Unable to credit wallet"
      });
    }

    // --------------------------------------------------
    // BALANCE AFTER
    // --------------------------------------------------

    const balanceAfter =
      updatedWallet.balance;

    // --------------------------------------------------
    // CREATE WALLET TRANSACTION
    // --------------------------------------------------

    const walletTransactions =
      await WalletTransaction.create(
        [
          {
            userId:
              transactionPayment.userId,

            walletId:
              updatedWallet._id,

            transactionType:
              "recharge",

            reference:
              transactionPayment.reference,

            amount:
              transactionPayment.amount,

            balanceBefore,

            balanceAfter,

            status:
              "completed"
          }
        ],
        {
          session
        }
      );

    const walletTransaction =
      walletTransactions[0];

    // --------------------------------------------------
    // UPDATE PAYMENT
    // --------------------------------------------------

    transactionPayment.status =
      "completed";

    await transactionPayment.save({
      session
    });

    // --------------------------------------------------
    // UPDATE USER BALANCE
    // --------------------------------------------------

    await User.findByIdAndUpdate(
      transactionPayment.userId,
      {
        balance: balanceAfter
      },
      {
        new: true,
        session
      }
    );

    // --------------------------------------------------
    // COMMIT TRANSACTION
    // --------------------------------------------------

    await session.commitTransaction();

    // ==================================================
    // SUCCESS RESPONSE
    // ==================================================

    return res.status(200).json({

      message:
        "Payment webhook processed successfully",

      payment: {
        id:
          transactionPayment._id,

        userId:
          transactionPayment.userId,

        paymentMethod:
          transactionPayment.paymentMethod,

        transactionType:
          transactionPayment.transactionType,

        reference:
          transactionPayment.reference,

        amount:
          transactionPayment.amount,

        status:
          transactionPayment.status,

        gatewayTransactionId:
          transactionPayment.gatewayTransactionId,

        createdAt:
          transactionPayment.createdAt,

        updatedAt:
          transactionPayment.updatedAt
      },

      wallet: {
        id:
          updatedWallet._id,

        userId:
          updatedWallet.userId,

        balance:
          updatedWallet.balance,

        status:
          updatedWallet.status
      },

      transaction: {
        id:
          walletTransaction._id,

        transactionType:
          walletTransaction.transactionType,

        reference:
          walletTransaction.reference,

        amount:
          walletTransaction.amount,

        balanceBefore:
          walletTransaction.balanceBefore,

        balanceAfter:
          walletTransaction.balanceAfter,

        status:
          walletTransaction.status,

        createdAt:
          walletTransaction.createdAt
      }
    });

  } catch (error) {

    // --------------------------------------------------
    // ABORT DATABASE TRANSACTION
    // --------------------------------------------------

    if (session) {

      try {
        await session.abortTransaction();

      } catch (abortError) {

        console.error(
          "WEBHOOK TRANSACTION ABORT ERROR:",
          abortError
        );
      }
    }

    // --------------------------------------------------
    // LOG ERROR
    // --------------------------------------------------

    console.error(
      "PAYMENT WEBHOOK ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error",
      error: error.message
    });

  } finally {

    // --------------------------------------------------
    // END SESSION
    // --------------------------------------------------

    if (session) {
      await session.endSession();
    }
  }
};

// ======================================================
// EXPORT PAYMENT CONTROLLER
// ======================================================

module.exports = {
  getAllPayments,
  getPaymentById,
  approveRecharge,
  rejectRecharge,
  paymentWebhook
};