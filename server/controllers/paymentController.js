const mongoose = require("mongoose");
const crypto = require("crypto");

const PaymentTransaction = require("../models/PaymentTransaction");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const User = require("../models/User");

const {
  getPaytmTransactionStatus
} = require("../services/paytmService");

const {
  getCashfreeOrder,
  getCashfreePayments,
  verifyCashfreeWebhookSignature
} = require("../services/cashfreeService");

// ======================================================
// HELPERS
// ======================================================

// Log the real error on the server, send only a safe message to the client.
const sendServerError = (req, res, label, error, message = "Server error") => {
  console.error(label, {
    requestId: req.requestId || null,
    code: error && error.code,
    codeName: error && error.codeName,
    message: error && error.message,
    stack: error && error.stack
  });

  return res.status(500).json({
    success: false,
    message,
    requestId: req.requestId || null
  });
};

const abortSafely = async (session, label) => {
  if (!session) return;

  try {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
  } catch (abortError) {
    console.error(label, abortError.message);
  }
};

// True when MongoDB rejected a write because a concurrent request
// touched the same document (write conflict / duplicate key /
// transient transaction error). This is not a server failure.
const isConcurrencyConflict = (error) =>
  Boolean(error) &&
  (error.code === 112 ||
    error.code === 11000 ||
    (typeof error.hasErrorLabel === "function" &&
      error.hasErrorLabel("TransientTransactionError")));

// Use a separate secret for tests.
// Never fall back to the production secret in test mode.
const verifyPaymentWebhookSecret = (req) => {
  const isTestMode = process.env.NODE_ENV === "test";

  const configuredSecret = isTestMode
    ? process.env.TEST_PAYMENT_WEBHOOK_SECRET
    : process.env.PAYMENT_WEBHOOK_SECRET;

  const receivedSecret = req.headers["x-payment-webhook-secret"];

  if (
    typeof configuredSecret !== "string" ||
    !configuredSecret ||
    typeof receivedSecret !== "string" ||
    !receivedSecret
  ) {
    return false;
  }

  // Hash both sides so timingSafeEqual always gets equal-length buffers.
  const expected = crypto
    .createHash("sha256")
    .update(configuredSecret)
    .digest();

  const received = crypto
    .createHash("sha256")
    .update(receivedSecret)
    .digest();

  return crypto.timingSafeEqual(expected, received);
};

// True if the same gateway transaction ID already credited another payment.
const isGatewayTransactionUsed = async (
  gatewayTransactionId,
  currentPaymentId,
  session = null
) => {
  if (!gatewayTransactionId) return false;

  const query = PaymentTransaction.findOne({
    gatewayTransactionId: String(gatewayTransactionId),
    _id: { $ne: currentPaymentId },
    status: "completed"
  });

  if (session) query.session(session);

  return Boolean(await query);
};

// Atomically moves a payment out of "pending". Only one concurrent caller
// can win, because the filter requires status === "pending".
// Returns the updated document, or null if someone else got there first.
const transitionPendingPayment = (paymentId, fields, session = null) =>
  PaymentTransaction.findOneAndUpdate(
    { _id: paymentId, status: "pending" },
    { $set: fields },
    { new: true, session }
  );

// Credits wallet + writes ledger + marks payment completed + syncs user balance.
// Must be called inside an active transaction.
//
// The payment is claimed FIRST with an atomic pending -> completed update,
// so a payment can never be credited twice, even if two requests pass the
// earlier status checks at the same time. If anything after the claim fails,
// the caller aborts the transaction and the claim is rolled back.
//
// `extraFields` lets callers store gatewayTransactionId / gatewayResponse
// in the same atomic update.
const creditWalletForPayment = async (session, payment, extraFields = {}) => {
  const claimedPayment = await transitionPendingPayment(
    payment._id,
    { ...extraFields, status: "completed" },
    session
  );

  if (!claimedPayment) {
    return {
      error: {
        status: 409,
        message: "Payment is no longer pending"
      }
    };
  }

  let wallet = await Wallet.findOne({
    userId: claimedPayment.userId
  }).session(session);

  if (!wallet) {
    const createdWallet = await Wallet.create(
      [{ userId: claimedPayment.userId, balance: 0, status: "active" }],
      { session }
    );

    wallet = createdWallet[0];
  }

  if (wallet.status !== "active") {
    return {
      error: {
        status: 403,
        message: "Wallet is not active"
      }
    };
  }

  const balanceBefore = wallet.balance;

  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      _id: wallet._id,
      userId: claimedPayment.userId,
      status: "active"
    },
    {
      $inc: { balance: claimedPayment.amount }
    },
    {
      new: true,
      session
    }
  );

  if (!updatedWallet) {
    return {
      error: {
        status: 400,
        message: "Unable to credit wallet"
      }
    };
  }

  const balanceAfter = updatedWallet.balance;

  const walletTransactions = await WalletTransaction.create(
    [
      {
        userId: claimedPayment.userId,
        walletId: updatedWallet._id,
        transactionType: "recharge",
        reference: claimedPayment.reference,
        amount: claimedPayment.amount,
        balanceBefore,
        balanceAfter,
        status: "completed"
      }
    ],
    { session }
  );

  await User.findByIdAndUpdate(
    claimedPayment.userId,
    { balance: balanceAfter },
    {
      new: true,
      session
    }
  );

  return {
    payment: claimedPayment,
    updatedWallet,
    walletTransaction: walletTransactions[0]
  };
};

const paymentView = (p) => ({
  id: p._id,
  userId: p.userId,
  paymentMethod: p.paymentMethod,
  transactionType: p.transactionType,
  reference: p.reference,
  amount: p.amount,
  status: p.status,
  gatewayOrderId: p.gatewayOrderId,
  gatewayTransactionId: p.gatewayTransactionId,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt
});

// Short payment summary used by webhook responses.
const webhookPaymentView = (p) => ({
  id: p._id,
  reference: p.reference,
  amount: p.amount,
  status: p.status,
  gatewayTransactionId: p.gatewayTransactionId
});

// Short payment summary used by Paytm callback responses.
const paytmPaymentView = (p) => ({
  id: p._id,
  orderId: p.gatewayOrderId,
  status: p.status,
  gatewayTransactionId: p.gatewayTransactionId
});

const walletView = (w) => ({
  id: w._id,
  userId: w.userId,
  balance: w.balance,
  status: w.status
});

const ledgerView = (t) => ({
  id: t._id,
  transactionType: t.transactionType,
  reference: t.reference,
  amount: t.amount,
  balanceBefore: t.balanceBefore,
  balanceAfter: t.balanceAfter,
  status: t.status,
  createdAt: t.createdAt
});

const isValidAmount = (amount) =>
  typeof amount === "number" &&
  Number.isFinite(amount) &&
  amount > 0;

const toNullableString = (value) =>
  value !== undefined && value !== null ? String(value) : null;

// A concurrent duplicate request lost the race. If the winner already
// completed the payment, answer 200 (idempotent). Otherwise answer 409
// so the caller knows another request is handling it.
const respondToConcurrentDuplicate = async (res, filter, label) => {
  try {
    const latest = await PaymentTransaction.findOne(filter);

    if (latest && latest.status === "completed") {
      return res.status(200).json({
        message: "Payment already completed",
        payment: paymentView(latest)
      });
    }
  } catch (lookupError) {
    console.error(label, lookupError.message);
  }

  return res.status(409).json({
    success: false,
    message: "Duplicate request is being processed"
  });
};

// Builds the gatewayResponse object stored for Paytm payments.
const buildPaytmGatewayResponse = ({
  orderId,
  callbackStatus,
  callbackTxnId,
  callbackAmount,
  verifiedStatus,
  paytmStatus
}) => ({
  provider: "paytm",
  orderId,
  callbackStatus,
  callbackTxnId: toNullableString(callbackTxnId),
  callbackAmount: toNullableString(callbackAmount),
  verifiedStatus,
  verifiedTxnId: paytmStatus.txnId,
  verifiedAmount: paytmStatus.txnAmount,
  resultCode: paytmStatus.resultCode,
  resultMessage: paytmStatus.resultMessage,
  paymentMode: paytmStatus.paymentMode,
  bankTxnId: paytmStatus.bankTxnId
});

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
    return sendServerError(req, res, "GET ALL PAYMENTS ERROR:", error);
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
    return sendServerError(req, res, "GET PAYMENT BY ID ERROR:", error);
  }
};

// ======================================================
// APPROVE RECHARGE
// ======================================================

const approveRecharge = async (req, res) => {
  let session = null;

  try {
    const { paymentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        message: "Invalid payment ID"
      });
    }

    const payment = await PaymentTransaction.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment transaction not found"
      });
    }

    if (payment.transactionType !== "recharge") {
      return res.status(400).json({
        message: "Only recharge payments can be approved"
      });
    }

    if (payment.status === "completed") {
      return res.status(400).json({
        message: "Payment has already been approved"
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        message: `Payment cannot be approved because it is already ${payment.status}`
      });
    }

    if (!payment.userId) {
      return res.status(400).json({
        message: "Payment is not associated with a user"
      });
    }

    if (!isValidAmount(payment.amount)) {
      return res.status(400).json({
        message: "Payment amount must be greater than 0"
      });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    // The atomic claim inside creditWalletForPayment guarantees only one
    // request can complete this payment. A loser gets a 409 below.
    const result = await creditWalletForPayment(session, payment);

    if (result.error) {
      await session.abortTransaction();

      return res.status(result.error.status).json({
        message: result.error.message
      });
    }

    await session.commitTransaction();

    return res.status(200).json({
      message: "Recharge approved successfully",
      payment: paymentView(result.payment),
      wallet: walletView(result.updatedWallet),
      transaction: ledgerView(result.walletTransaction)
    });
  } catch (error) {
    await abortSafely(session, "APPROVE RECHARGE ABORT ERROR:");

    // Another request approved this payment at the same moment.
    if (isConcurrencyConflict(error)) {
      return res.status(409).json({
        success: false,
        message: "Payment is being processed by another request"
      });
    }

    return sendServerError(
      req,
      res,
      "APPROVE RECHARGE ERROR:",
      error
    );
  } finally {
    if (session) await session.endSession();
  }
};

// ======================================================
// REJECT RECHARGE
// ======================================================

const rejectRecharge = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        message: "Invalid payment ID"
      });
    }

    const payment = await PaymentTransaction.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        message: "Payment transaction not found"
      });
    }

    if (payment.transactionType !== "recharge") {
      return res.status(400).json({
        message: "Only recharge payments can be rejected"
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        message: `Payment cannot be rejected because it is already ${payment.status}`
      });
    }

    // Atomic: cannot overwrite a payment that was approved in the meantime.
    const rejected = await transitionPendingPayment(payment._id, {
      status: "rejected"
    });

    if (!rejected) {
      return res.status(409).json({
        success: false,
        message: "Payment is no longer pending"
      });
    }

    return res.status(200).json({
      message: "Recharge rejected successfully",
      payment: paymentView(rejected)
    });
  } catch (error) {
    return sendServerError(req, res, "REJECT RECHARGE ERROR:", error);
  }
};

// ======================================================
// GENERIC PAYMENT WEBHOOK
// ======================================================

const paymentWebhook = async (req, res) => {
  let session = null;

  try {
    if (!verifyPaymentWebhookSecret(req)) {
      console.warn("PAYMENT WEBHOOK AUTHENTICATION FAILED", {
        requestId: req.requestId || null
      });

      return res.status(401).json({
        success: false,
        message: "Unauthorized payment webhook"
      });
    }

    const body = req.body || {};
    const { reference, gatewayTransactionId, status } = body;

    if (
      !reference ||
      typeof reference !== "string" ||
      !reference.trim()
    ) {
      return res.status(400).json({
        message: "Payment reference is required"
      });
    }

    const cleanReference = reference.trim();
    const allowedStatuses = ["completed", "failed", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid webhook payment status"
      });
    }

    let cleanGatewayTransactionId =
      gatewayTransactionId !== undefined &&
      gatewayTransactionId !== null &&
      String(gatewayTransactionId).trim()
        ? String(gatewayTransactionId).trim()
        : null;

    const payment = await PaymentTransaction.findOne({
      reference: cleanReference
    });

    if (!payment) {
      return res.status(404).json({
        message: "Payment transaction not found"
      });
    }

    if (payment.transactionType !== "recharge") {
      return res.status(400).json({
        message: "Webhook is only supported for recharge payments"
      });
    }

    if (!payment.userId) {
      return res.status(400).json({
        message: "Payment is not associated with a user"
      });
    }

    if (!isValidAmount(payment.amount)) {
      return res.status(400).json({
        message: "Payment amount must be greater than 0"
      });
    }

    if (status === "completed") {
      if (payment.status === "completed") {
        return res.status(200).json({
          message: "Payment already completed",
          payment: webhookPaymentView(payment)
        });
      }

      if (payment.status !== "pending") {
        return res.status(400).json({
          message: `Payment is already ${payment.status}`
        });
      }

      // Paytm payments must be verified directly with Paytm.
      if (payment.paymentMethod === "paytm") {
        if (!payment.gatewayOrderId) {
          return res.status(400).json({
            success: false,
            message: "Paytm gateway order ID is missing"
          });
        }

        let verifiedPaytm;

        try {
          verifiedPaytm = await getPaytmTransactionStatus(
            payment.gatewayOrderId
          );
        } catch (verificationError) {
          console.error("PAYTM WEBHOOK VERIFICATION ERROR:", {
            requestId: req.requestId || null,
            reference: cleanReference,
            message: verificationError.message
          });

          return res.status(502).json({
            success: false,
            message: "Unable to verify Paytm payment",
            requestId: req.requestId || null
          });
        }

        const verifiedStatus = String(
          verifiedPaytm.status || ""
        ).trim().toUpperCase();

        if (verifiedStatus !== "TXN_SUCCESS") {
          return res.status(400).json({
            success: false,
            message: "Paytm payment is not successful"
          });
        }

        const verifiedAmount = Number(verifiedPaytm.txnAmount);

        if (
          !Number.isFinite(verifiedAmount) ||
          verifiedAmount.toFixed(2) !== Number(payment.amount).toFixed(2)
        ) {
          return res.status(400).json({
            success: false,
            message: "Paytm payment amount mismatch"
          });
        }

        if (!verifiedPaytm.txnId) {
          return res.status(400).json({
            success: false,
            message: "Paytm transaction ID is missing"
          });
        }

        cleanGatewayTransactionId = String(verifiedPaytm.txnId);
      }

      // SECURITY GUARD: the generic webhook secret only authenticates the
      // caller; it is not proof that money was received. Only methods with
      // independent gateway verification (Paytm above) may be completed
      // automatically. Other methods must go through the authenticated
      // admin approval flow (approveRecharge).
      if (payment.paymentMethod !== "paytm") {
        return res.status(400).json({
          success: false,
          message:
            "Automatic payment verification is not supported for this payment method"
        });
      }

      session = await mongoose.startSession();
      session.startTransaction();

      const transactionPayment =
        await PaymentTransaction.findById(payment._id).session(session);

      if (!transactionPayment) {
        await session.abortTransaction();

        return res.status(404).json({
          message: "Payment transaction not found"
        });
      }

      if (transactionPayment.status === "completed") {
        await session.abortTransaction();

        return res.status(200).json({
          message: "Payment already completed",
          payment: webhookPaymentView(transactionPayment)
        });
      }

      if (transactionPayment.status !== "pending") {
        await session.abortTransaction();

        return res.status(400).json({
          message: `Payment is already ${transactionPayment.status}`
        });
      }

      if (
        await isGatewayTransactionUsed(
          cleanGatewayTransactionId,
          transactionPayment._id,
          session
        )
      ) {
        await session.abortTransaction();

        return res.status(409).json({
          success: false,
          message: "Gateway transaction already used"
        });
      }

      const extraFields = cleanGatewayTransactionId
        ? { gatewayTransactionId: cleanGatewayTransactionId }
        : {};

      const result = await creditWalletForPayment(
        session,
        transactionPayment,
        extraFields
      );

      if (result.error) {
        await session.abortTransaction();

        return res.status(result.error.status).json({
          message: result.error.message
        });
      }

      await session.commitTransaction();

      return res.status(200).json({
        message: "Payment webhook processed successfully",
        payment: paymentView(result.payment),
        wallet: walletView(result.updatedWallet),
        transaction: ledgerView(result.walletTransaction)
      });
    }

    // Failed/rejected webhooks may only affect pending payments.
    if (payment.status !== "pending") {
      return res.status(400).json({
        message: `Payment is already ${payment.status}`
      });
    }

    const updateFields = { status };

    if (cleanGatewayTransactionId) {
      updateFields.gatewayTransactionId = cleanGatewayTransactionId;
    }

    // Atomic: cannot overwrite a payment that completed in the meantime.
    const updatedPayment = await transitionPendingPayment(
      payment._id,
      updateFields
    );

    if (!updatedPayment) {
      return res.status(409).json({
        success: false,
        message: "Payment is no longer pending"
      });
    }

    return res.status(200).json({
      message: `Payment marked as ${status}`,
      payment: webhookPaymentView(updatedPayment)
    });
  } catch (error) {
    await abortSafely(session, "WEBHOOK TRANSACTION ABORT ERROR:");

    // A concurrent duplicate webhook lost the race (write conflict,
    // duplicate key, or transient transaction error). Not a server failure.
    if (isConcurrencyConflict(error)) {
      const ref =
        req.body && typeof req.body.reference === "string"
          ? req.body.reference.trim()
          : null;

      if (ref) {
        return respondToConcurrentDuplicate(
          res,
          { reference: ref },
          "WEBHOOK DUPLICATE LOOKUP ERROR:"
        );
      }
    }

    return sendServerError(
      req,
      res,
      "PAYMENT WEBHOOK ERROR:",
      error,
      "Payment webhook processing failed"
    );
  } finally {
    if (session) await session.endSession();
  }
};

// ======================================================
// PAYTM CALLBACK
// ======================================================

const paytmCallback = async (req, res) => {
  let session = null;

  try {
    const body = req.body || {};

    const orderId = String(
      body.ORDERID || body.orderId || ""
    ).trim();

    const callbackStatus = String(
      body.STATUS || body.status || ""
    ).trim().toUpperCase();

    const callbackTxnId = body.TXNID || body.txnId || null;
    const callbackAmount = body.TXNAMOUNT || body.txnAmount || null;

    console.log("PAYTM CALLBACK RECEIVED:", {
      requestId: req.requestId || null,
      orderId: orderId || null,
      status: callbackStatus || null
    });

    if (!orderId) {
      return res.status(400).json({
        message: "Paytm order ID is required"
      });
    }

    const payment = await PaymentTransaction.findOne({
      gatewayOrderId: orderId
    });

    if (!payment) {
      return res.status(404).json({
        message: "Paytm payment transaction not found"
      });
    }

    if (payment.paymentMethod !== "paytm") {
      return res.status(400).json({
        message: "Payment is not a Paytm transaction"
      });
    }

    if (payment.transactionType !== "recharge") {
      return res.status(400).json({
        message: "Paytm callback is only supported for recharge payments"
      });
    }

    if (payment.status === "completed") {
      return res.status(200).json({
        message: "Paytm payment already completed",
        payment: paytmPaymentView(payment)
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        message: `Payment is already ${payment.status}`
      });
    }

    // The callback body is not trusted. Always confirm with Paytm directly.
    let paytmStatus;

    try {
      paytmStatus = await getPaytmTransactionStatus(orderId);
    } catch (verificationError) {
      console.error("PAYTM CALLBACK VERIFICATION ERROR:", {
        requestId: req.requestId || null,
        orderId,
        message: verificationError.message
      });

      return res.status(502).json({
        success: false,
        message: "Unable to verify Paytm payment",
        requestId: req.requestId || null
      });
    }

    console.log("PAYTM STATUS VERIFICATION:", {
      requestId: req.requestId || null,
      orderId,
      status: paytmStatus.status,
      txnId: paytmStatus.txnId,
      txnAmount: paytmStatus.txnAmount
    });

    const verifiedStatus = String(
      paytmStatus.status || ""
    ).trim().toUpperCase();

    const gatewayResponse = buildPaytmGatewayResponse({
      orderId,
      callbackStatus,
      callbackTxnId,
      callbackAmount,
      verifiedStatus,
      paytmStatus
    });

    // ---------- Failed ----------
    if (
      verifiedStatus === "TXN_FAILURE" ||
      verifiedStatus === "FAILURE" ||
      verifiedStatus === "FAILED"
    ) {
      const failedFields = { status: "failed", gatewayResponse };

      if (paytmStatus.txnId) {
        failedFields.gatewayTransactionId = String(paytmStatus.txnId);
      }

      const failedPayment = await transitionPendingPayment(
        payment._id,
        failedFields
      );

      if (!failedPayment) {
        return respondToConcurrentDuplicate(
          res,
          { gatewayOrderId: orderId },
          "PAYTM CALLBACK FAILED LOOKUP ERROR:"
        );
      }

      return res.status(200).json({
        message: "Paytm payment failed",
        payment: paytmPaymentView(failedPayment)
      });
    }

    // ---------- Still pending ----------
    if (
      verifiedStatus === "PENDING" ||
      verifiedStatus === "TXN_PENDING"
    ) {
      await PaymentTransaction.updateOne(
        { _id: payment._id, status: "pending" },
        { $set: { gatewayResponse } }
      );

      return res.status(200).json({
        message: "Paytm payment is still pending",
        payment: {
          id: payment._id,
          orderId: payment.gatewayOrderId,
          status: payment.status
        }
      });
    }

    // ---------- Unknown / not successful ----------
    if (verifiedStatus !== "TXN_SUCCESS") {
      await PaymentTransaction.updateOne(
        { _id: payment._id, status: "pending" },
        { $set: { gatewayResponse } }
      );

      return res.status(400).json({
        message: "Paytm transaction status is not successful",
        paytmStatus: verifiedStatus || null,
        resultCode: paytmStatus.resultCode,
        resultMessage: paytmStatus.resultMessage
      });
    }

    // ---------- Success: validate before crediting ----------
    if (!paytmStatus.txnId) {
      return res.status(400).json({
        message: "Paytm transaction ID is missing"
      });
    }

    const expectedAmount = Number(payment.amount);
    const verifiedAmount = Number(paytmStatus.txnAmount);

    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return res.status(400).json({
        message: "Invalid payment amount"
      });
    }

    if (!Number.isFinite(verifiedAmount) || verifiedAmount <= 0) {
      return res.status(400).json({
        message: "Invalid Paytm transaction amount"
      });
    }

    if (expectedAmount.toFixed(2) !== verifiedAmount.toFixed(2)) {
      console.error("PAYTM AMOUNT MISMATCH:", {
        requestId: req.requestId || null,
        paymentId: payment._id,
        expectedAmount,
        verifiedAmount
      });

      await transitionPendingPayment(payment._id, {
        status: "failed",
        gatewayTransactionId: String(paytmStatus.txnId),
        gatewayResponse
      });

      return res.status(400).json({
        message: "Paytm transaction amount mismatch",
        status: "failed"
      });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const transactionPayment =
      await PaymentTransaction.findById(payment._id).session(session);

    if (!transactionPayment) {
      await session.abortTransaction();

      return res.status(404).json({
        message: "Payment transaction not found"
      });
    }

    if (transactionPayment.status === "completed") {
      await session.abortTransaction();

      return res.status(200).json({
        message: "Paytm payment already completed",
        payment: paytmPaymentView(transactionPayment)
      });
    }

    if (transactionPayment.status !== "pending") {
      await session.abortTransaction();

      return res.status(400).json({
        message: `Payment is already ${transactionPayment.status}`
      });
    }

    if (
      await isGatewayTransactionUsed(
        paytmStatus.txnId,
        transactionPayment._id,
        session
      )
    ) {
      await session.abortTransaction();

      return res.status(409).json({
        message: "Gateway transaction already used"
      });
    }

    const result = await creditWalletForPayment(
      session,
      transactionPayment,
      {
        gatewayTransactionId: String(paytmStatus.txnId),
        gatewayResponse: {
          ...gatewayResponse,
          txnId: String(paytmStatus.txnId),
          txnAmount: String(paytmStatus.txnAmount)
        }
      }
    );

    if (result.error) {
      await session.abortTransaction();

      return res.status(result.error.status).json({
        message: result.error.message
      });
    }

    await session.commitTransaction();

    return res.status(200).json({
      message: "Paytm payment verified and wallet credited successfully",
      payment: paymentView(result.payment),
      wallet: walletView(result.updatedWallet),
      transaction: ledgerView(result.walletTransaction)
    });
  } catch (error) {
    await abortSafely(session, "PAYTM CALLBACK ABORT ERROR:");

    // Paytm may deliver the same callback twice at once.
    if (isConcurrencyConflict(error)) {
      const orderRef = String(
        (req.body && (req.body.ORDERID || req.body.orderId)) || ""
      ).trim();

      if (orderRef) {
        return respondToConcurrentDuplicate(
          res,
          { gatewayOrderId: orderRef },
          "PAYTM CALLBACK DUPLICATE LOOKUP ERROR:"
        );
      }
    }

    return sendServerError(
      req,
      res,
      "PAYTM CALLBACK ERROR:",
      error,
      "Paytm callback processing failed"
    );
  } finally {
    if (session) await session.endSession();
  }
};

// ======================================================
// CASHFREE WEBHOOK
// ======================================================

const cashfreeWebhook = async (req, res) => {
  let session = null;

  try {
    // ======================================================
    // 1. VERIFY CASHFREE WEBHOOK SIGNATURE
    // ======================================================

    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];

    if (!Buffer.isBuffer(req.rawBody)) {
      console.error(
        "CASHFREE WEBHOOK ERROR: Original raw request body is missing"
      );

      return res.status(400).json({
        success: false,
        message: "Webhook raw body is unavailable"
      });
    }

    const rawBody = req.rawBody.toString("utf8");

    const signatureValid = verifyCashfreeWebhookSignature({
      signature,
      timestamp,
      rawBody
    });

    if (!signatureValid) {
      console.warn("CASHFREE WEBHOOK SIGNATURE VERIFICATION FAILED", {
        requestId: req.requestId || null
      });

      return res.status(401).json({
        success: false,
        message: "Invalid Cashfree webhook signature"
      });
    }

    // ======================================================
    // 2. VALIDATE WEBHOOK EVENT
    // ======================================================

    const body = req.body || {};
    const eventType = body.type;

    // Other valid Cashfree events are acknowledged but must not
    // automatically credit the wallet.
    if (eventType !== "PAYMENT_SUCCESS_WEBHOOK") {
      return res.status(200).json({
        success: true,
        message: "Cashfree webhook acknowledged",
        eventType: eventType || null
      });
    }

    const order = body.data && body.data.order;
    const paymentData = body.data && body.data.payment;

    const orderId = String(
      (order && order.order_id) || ""
    ).trim();

    const cashfreePaymentId = String(
      (paymentData && paymentData.cf_payment_id) || ""
    ).trim();

    const paymentStatus = String(
      (paymentData && paymentData.payment_status) || ""
    ).trim().toUpperCase();

    if (!orderId || !cashfreePaymentId) {
      return res.status(400).json({
        success: false,
        message: "Cashfree order ID or payment ID is missing"
      });
    }

    // A success event must contain a successful payment.
    if (paymentStatus !== "SUCCESS") {
      return res.status(200).json({
        success: true,
        message: "Cashfree payment is not successful; no wallet credit performed"
      });
    }

    // ======================================================
    // 3. FIND OUR PENDING RECHARGE
    // ======================================================

    const payment = await PaymentTransaction.findOne({
      gatewayOrderId: orderId,
      paymentMethod: "cashfree",
      transactionType: "recharge"
    });

    if (!payment) {
      console.warn("CASHFREE PAYMENT RECORD NOT FOUND", {
        requestId: req.requestId || null,
        orderId
      });

      return res.status(404).json({
        success: false,
        message: "Cashfree payment transaction not found"
      });
    }

    if (!payment.userId) {
      return res.status(400).json({
        success: false,
        message: "Payment is not associated with a user"
      });
    }

    if (!isValidAmount(payment.amount)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount"
      });
    }

    // Idempotency: a repeated webhook must not credit the wallet twice.
    if (payment.status === "completed") {
      return res.status(200).json({
        success: true,
        message: "Cashfree payment already completed",
        payment: paymentView(payment)
      });
    }

    if (payment.status !== "pending") {
      return res.status(200).json({
        success: true,
        message: `Payment is already ${payment.status}; no wallet credit performed`
      });
    }

    // ======================================================
    // 4. VERIFY ORDER AND PAYMENT DIRECTLY WITH CASHFREE
    // ======================================================

    let verifiedOrder;
    let verifiedPayments;

    try {
      [verifiedOrder, verifiedPayments] = await Promise.all([
        getCashfreeOrder(orderId),
        getCashfreePayments(orderId)
      ]);
    } catch (verificationError) {
      console.error("CASHFREE API VERIFICATION ERROR:", {
        requestId: req.requestId || null,
        orderId,
        message: verificationError.message
      });

      // A non-2xx response allows the gateway to retry delivery.
      return res.status(502).json({
        success: false,
        message: "Unable to verify Cashfree payment",
        requestId: req.requestId || null
      });
    }

    if (
      !verifiedOrder ||
      String(verifiedOrder.order_id || "") !== orderId
    ) {
      return res.status(400).json({
        success: false,
        message: "Cashfree order verification failed"
      });
    }

    const verifiedOrderStatus = String(
      verifiedOrder.order_status || ""
    ).trim().toUpperCase();

    if (verifiedOrderStatus !== "PAID") {
      return res.status(400).json({
        success: false,
        message: "Cashfree order is not paid"
      });
    }

    const expectedAmount = Number(payment.amount);
    const verifiedOrderAmount = Number(verifiedOrder.order_amount);
    const webhookPaymentAmount = Number(
      paymentData.payment_amount
    );

    if (
      !Number.isFinite(verifiedOrderAmount) ||
      verifiedOrderAmount.toFixed(2) !== expectedAmount.toFixed(2)
    ) {
      return res.status(400).json({
        success: false,
        message: "Cashfree order amount mismatch"
      });
    }

    if (
      !Number.isFinite(webhookPaymentAmount) ||
      webhookPaymentAmount.toFixed(2) !== expectedAmount.toFixed(2)
    ) {
      return res.status(400).json({
        success: false,
        message: "Cashfree payment amount mismatch"
      });
    }

    const orderCurrency = String(
      verifiedOrder.order_currency || ""
    ).trim().toUpperCase();

    if (orderCurrency !== "INR") {
      return res.status(400).json({
        success: false,
        message: "Unsupported Cashfree payment currency"
      });
    }

    if (!Array.isArray(verifiedPayments)) {
      return res.status(502).json({
        success: false,
        message: "Invalid Cashfree payment verification response"
      });
    }

    const verifiedPayment = verifiedPayments.find((item) => {
      return (
        String(item.cf_payment_id || "") === cashfreePaymentId &&
        String(item.payment_status || "").trim().toUpperCase() ===
          "SUCCESS"
      );
    });

    if (!verifiedPayment) {
      return res.status(400).json({
        success: false,
        message: "Successful Cashfree payment could not be verified"
      });
    }

    const verifiedPaymentAmount = Number(
      verifiedPayment.payment_amount
    );

    if (
      !Number.isFinite(verifiedPaymentAmount) ||
      verifiedPaymentAmount.toFixed(2) !== expectedAmount.toFixed(2)
    ) {
      return res.status(400).json({
        success: false,
        message: "Verified Cashfree payment amount mismatch"
      });
    }

    // ======================================================
    // 5. ATOMICALLY CREDIT WALLET
    // ======================================================

    session = await mongoose.startSession();
    session.startTransaction();

    const transactionPayment = await PaymentTransaction
      .findById(payment._id)
      .session(session);

    if (!transactionPayment) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Payment transaction not found"
      });
    }

    if (transactionPayment.status === "completed") {
      await session.abortTransaction();

      return res.status(200).json({
        success: true,
        message: "Cashfree payment already completed",
        payment: paymentView(transactionPayment)
      });
    }

    if (transactionPayment.status !== "pending") {
      await session.abortTransaction();

      return res.status(409).json({
        success: false,
        message: `Payment is already ${transactionPayment.status}`
      });
    }

    // Prevent a successful gateway transaction from being reused
    // to credit a different payment.
    if (
      await isGatewayTransactionUsed(
        cashfreePaymentId,
        transactionPayment._id,
        session
      )
    ) {
      await session.abortTransaction();

      return res.status(409).json({
        success: false,
        message: "Cashfree transaction ID has already been used"
      });
    }

    const result = await creditWalletForPayment(
      session,
      transactionPayment,
      {
        gatewayTransactionId: cashfreePaymentId,
        gatewayResponse: {
          provider: "cashfree",
          orderId,
          cashfreePaymentId,
          orderStatus: verifiedOrderStatus,
          paymentStatus: "SUCCESS",
          amount: expectedAmount,
          currency: orderCurrency,
          environment: process.env.CASHFREE_ENVIRONMENT || "sandbox"
        }
      }
    );

    if (result.error) {
      await session.abortTransaction();

      return res.status(result.error.status).json({
        success: false,
        message: result.error.message
      });
    }

    await session.commitTransaction();

    console.log("CASHFREE PAYMENT VERIFIED AND WALLET CREDITED", {
      requestId: req.requestId || null,
      paymentId: String(result.payment._id),
      orderId,
      cashfreePaymentId,
      amount: expectedAmount
    });

    return res.status(200).json({
      success: true,
      message: "Cashfree payment verified and wallet credited successfully",
      payment: paymentView(result.payment),
      wallet: walletView(result.updatedWallet),
      transaction: ledgerView(result.walletTransaction)
    });
  } catch (error) {
    await abortSafely(session, "CASHFREE WEBHOOK ABORT ERROR:");

    if (isConcurrencyConflict(error)) {
      const orderId = String(
        (
          req.body &&
          req.body.data &&
          req.body.data.order &&
          req.body.data.order.order_id
        ) || ""
      ).trim();

      if (orderId) {
        return respondToConcurrentDuplicate(
          res,
          {
            gatewayOrderId: orderId,
            paymentMethod: "cashfree",
            transactionType: "recharge"
          },
          "CASHFREE WEBHOOK DUPLICATE LOOKUP ERROR:"
        );
      }

      return res.status(409).json({
        success: false,
        message: "Cashfree payment is being processed by another request"
      });
    }

    return sendServerError(
      req,
      res,
      "CASHFREE WEBHOOK ERROR:",
      error,
      "Cashfree webhook processing failed"
    );
  } finally {
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
  paymentWebhook,
  paytmCallback,
  cashfreeWebhook
};