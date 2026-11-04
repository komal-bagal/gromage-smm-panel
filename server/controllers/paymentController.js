const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const User = require("../models/User");

/**
 * Determine if current MongoDB connection topology supports multi-document transactions.
 * Standalone MongoDB ("Single") does not support transactions and requires replica set.
 */
const supportsTransactions = () => {
  const type = mongoose.connection?.client?.topology?.description?.type;
  return Boolean(type && type !== "Single" && type !== "Unknown");
};

/**
 * Execute work inside a MongoDB multi-document transaction if the deployment supports it,
 * otherwise execute reliably and sequentially for standalone MongoDB deployments.
 */
const runInTransaction = async (workFn) => {
  let session = null;
  if (supportsTransactions()) {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }
  }

  if (session) {
    try {
      const result = await workFn(session);
      await session.commitTransaction();
      session.endSession();
      return result;
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } else {
    // Fallback for standalone MongoDB environments
    return await workFn(null);
  }
};

/**
 * GET /api/payment or GET /api/admin/transactions
 * Retrieve payment / transaction records with optional filtering
 */
const getPayments = async (req, res) => {
  try {
    const { status, type, search, limit = 100, page = 1 } = req.query;
    const filter = {};

    // Status filter
    if (status && status !== "all") {
      const s = String(status).toLowerCase().trim();
      if (s.includes("complete") || s === "success") {
        filter.status = "completed";
      } else if (s.includes("pending")) {
        filter.status = "pending";
      } else if (s.includes("fail") || s.includes("reject")) {
        filter.status = "failed";
      } else if (s.includes("refund")) {
        filter.status = "refunded";
      } else {
        filter.status = s;
      }
    }

    // Type filter
    if (type && type !== "all") {
      filter.type = new RegExp(`^${type}$`, "i");
    }

    // Search filter across user, userEmail, refId, description, paymentId
    if (search && String(search).trim()) {
      const q = String(search).trim();
      const regex = new RegExp(q, "i");
      filter.$or = [
        { paymentId: regex },
        { user: regex },
        { userEmail: regex },
        { refId: regex },
        { description: regex },
        { method: regex },
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Math.max(1, parseInt(limit, 10))),
      Payment.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: payments.length,
      total,
      payments,
      transactions: payments, // Alias for legacy consumers
    });
  } catch (error) {
    console.error("Get Payments Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
      error: error.message,
    });
  }
};

/**
 * GET /api/payment/:id
 * Retrieve a single payment by MongoDB _id or paymentId or refId
 */
const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    let payment = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      payment = await Payment.findById(id);
    }
    if (!payment) {
      payment = await Payment.findOne({
        $or: [{ paymentId: id }, { refId: id }],
      });
    }

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: `Payment record not found for identifier: ${id}`,
      });
    }

    return res.status(200).json({
      success: true,
      payment,
      transaction: payment,
    });
  } catch (error) {
    console.error("Get Payment Details Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payment details",
      error: error.message,
    });
  }
};

/**
 * POST /api/payment/:id/approve
 * Approves a pending payment and atomically credits the user's wallet balance
 */
const approvePayment = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Locate the target payment record
    let target = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      target = await Payment.findById(id);
    }
    if (!target) {
      target = await Payment.findOne({
        $or: [{ paymentId: id }, { refId: id }],
      });
    }

    if (!target) {
      return res.status(404).json({
        success: false,
        message: `Payment record #${id} not found`,
      });
    }

    // 2. Financial Safety: Allow approval ONLY for pending payments
    if (target.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Payment #${target.paymentId || id} cannot be approved. Current status is already '${target.status}'.`,
      });
    }

    const creditAmount = Number(target.amount);
    if (!creditAmount || isNaN(creditAmount) || creditAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment contains an invalid or non-positive amount",
      });
    }

    // 3. Locate the associated user
    let user = null;
    if (target.userId && mongoose.Types.ObjectId.isValid(target.userId)) {
      user = await User.findById(target.userId);
    }
    if (!user && target.userEmail) {
      user = await User.findOne({ email: target.userEmail.toLowerCase().trim() });
    }
    if (!user && target.user) {
      user = await User.findOne({ name: target.user.trim() });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Associated user account not found. Cannot credit wallet balance.",
      });
    }

    // 4. Atomic Execution: Update payment status to completed & credit user balance
    const result = await runInTransaction(async (session) => {
      const opts = session ? { session } : {};

      // Ensure no concurrent double-approval occurred
      const updatedPayment = await Payment.findOneAndUpdate(
        { _id: target._id, status: "pending" },
        {
          $set: {
            status: "completed",
            description: target.description
              ? `${target.description} (Approved by admin)`
              : "Approved by admin",
          },
        },
        { new: true, ...opts }
      );

      if (!updatedPayment) {
        throw new Error("Payment was already approved or modified concurrently.");
      }

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $inc: { balance: creditAmount } },
        { new: true, ...opts }
      );

      return { updatedPayment, updatedUser };
    });

    return res.status(200).json({
      success: true,
      message: `Payment #${result.updatedPayment.paymentId} approved and ₹${creditAmount.toFixed(2)} credited to ${user.name}'s wallet`,
      payment: result.updatedPayment,
      transaction: result.updatedPayment,
      userBalance: result.updatedUser ? result.updatedUser.balance : user.balance + creditAmount,
    });
  } catch (error) {
    console.error("Approve Payment Error:", error);
    return res.status(error.message && error.message.includes("concurrently") ? 409 : 500).json({
      success: false,
      message: error.message || "Failed to approve payment",
    });
  }
};

/**
 * POST /api/payment/:id/reject
 * Rejects a pending payment / recharge request
 */
const rejectPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Rejected by administrator" } = req.body;

    let target = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      target = await Payment.findById(id);
    }
    if (!target) {
      target = await Payment.findOne({
        $or: [{ paymentId: id }, { refId: id }],
      });
    }

    if (!target) {
      return res.status(404).json({
        success: false,
        message: `Payment record #${id} not found`,
      });
    }

    // Financial Safety: Allow rejection only for pending payments
    if (target.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Payment #${target.paymentId || id} cannot be rejected. Current status is already '${target.status}'.`,
      });
    }

    const updatedPayment = await Payment.findOneAndUpdate(
      { _id: target._id, status: "pending" },
      {
        $set: {
          status: "failed",
          description: target.description
            ? `${target.description} (Rejection note: ${reason})`
            : `Rejection note: ${reason}`,
        },
      },
      { new: true }
    );

    if (!updatedPayment) {
      return res.status(409).json({
        success: false,
        message: "Payment status was modified concurrently.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Payment #${updatedPayment.paymentId} marked as failed/rejected`,
      payment: updatedPayment,
      transaction: updatedPayment,
    });
  } catch (error) {
    console.error("Reject Payment Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject payment",
      error: error.message,
    });
  }
};

/**
 * POST /api/payment/manual OR POST /api/payment
 * Record manual administrative ledger credit or debit adjustment
 */
const recordManualTransaction = async (req, res) => {
  try {
    const {
      userId,
      user: userNameInput,
      userEmail,
      type = "Credit",
      amount,
      fee = 0,
      method,
      refId,
      reference,
      description,
      reason,
    } = req.body;

    // 1. Validate Amount
    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a valid number greater than 0",
      });
    }

    // 2. Validate Type
    const validTypes = ["Credit", "Debit", "Refund", "Adjustment"];
    const matchedType = validTypes.find(
      (t) => t.toLowerCase() === String(type).toLowerCase().trim()
    );
    if (!matchedType) {
      return res.status(400).json({
        success: false,
        message: `Invalid transaction type '${type}'. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    // 3. User Existence Lookup
    let targetUser = null;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      targetUser = await User.findById(userId);
    }
    if (!targetUser && userEmail) {
      targetUser = await User.findOne({ email: String(userEmail).toLowerCase().trim() });
    }
    if (!targetUser && userNameInput) {
      targetUser = await User.findOne({ name: String(userNameInput).trim() });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "Target customer account not found. Please provide a valid user.",
      });
    }

    // 4. Financial Safety: Balance Check for Debits
    const methodStr = String(method || "").toLowerCase();
    const isDebit =
      matchedType === "Debit" ||
      (matchedType === "Adjustment" && methodStr.includes("debit"));

    const currentBalance = Number(targetUser.balance || 0);

    if (isDebit && currentBalance < numAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance for debit adjustment. Current balance is ₹${currentBalance.toFixed(
          2
        )}, cannot debit ₹${numAmount.toFixed(2)}.`,
      });
    }

    const delta = isDebit ? -numAmount : numAmount;
    const finalMethod =
      method ||
      (isDebit ? "Manual Admin Debit" : "Manual Admin Credit");
    const finalRef =
      refId || reference || `ADM-ADJ-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalDesc =
      description || reason || reference || `Manual ${matchedType.toLowerCase()} ledger adjustment`;

    // 5. Atomic Execution: Update user balance & persist Payment record
    const result = await runInTransaction(async (session) => {
      const opts = session ? { session } : {};

      const updatedUser = await User.findByIdAndUpdate(
        targetUser._id,
        { $inc: { balance: delta } },
        { new: true, ...opts }
      );

      const numFee = Math.max(0, Number(fee) || 0);
      const newPayment = new Payment({
        userId: targetUser._id,
        user: targetUser.name,
        userEmail: targetUser.email,
        type: matchedType,
        amount: numAmount,
        fee: numFee,
        netAmount: Math.max(0, numAmount - numFee),
        status: "completed",
        method: finalMethod,
        refId: finalRef,
        description: finalDesc,
      });

      await newPayment.save(opts);
      return { newPayment, updatedUser };
    });

    const finalBalance = result.updatedUser ? result.updatedUser.balance : currentBalance + delta;

    return res.status(201).json({
      success: true,
      message: `Transaction recorded successfully. ₹${numAmount.toFixed(2)} ${
        isDebit ? "debited from" : "credited to"
      } ${targetUser.name}'s wallet`,
      payment: result.newPayment,
      transaction: result.newPayment,
      balance: finalBalance,
      userBalance: finalBalance,
    });
  } catch (error) {
    console.error("Record Transaction Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to record transaction",
    });
  }
};

/**
 * POST /api/wallet/credit
 * User wallet balance credit helper
 */
const creditWallet = async (req, res) => {
  req.body.type = "Credit";
  if (!req.body.userId && req.user) {
    req.body.userId = req.user._id;
  }
  return recordManualTransaction(req, res);
};

/**
 * POST /api/wallet/debit
 * User wallet balance debit helper with overdraft prevention
 */
const debitWallet = async (req, res) => {
  req.body.type = "Debit";
  if (!req.body.userId && req.user) {
    req.body.userId = req.user._id;
  }
  return recordManualTransaction(req, res);
};

/**
 * POST /api/wallet/recharge
 * Create a pending recharge payment request
 */
const rechargeWallet = async (req, res) => {
  try {
    const { amount, reference, paymentMethod, paymentScreenshot, paymentNote } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Recharge amount must be a valid number greater than 0",
      });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to recharge wallet",
      });
    }

    const newPayment = new Payment({
      userId: user._id,
      user: user.name || "Customer",
      userEmail: user.email || "",
      type: "Credit",
      amount: numAmount,
      fee: 0,
      netAmount: numAmount,
      status: "pending",
      method: paymentMethod || "UPI QR Code",
      refId: reference || `REC-${Math.floor(100000 + Math.random() * 900000)}`,
      description: paymentNote || "Customer wallet recharge request",
      screenshot: paymentScreenshot || null,
    });

    await newPayment.save();

    return res.status(201).json({
      success: true,
      message: "Wallet recharge request submitted successfully. Pending admin verification.",
      payment: newPayment,
      transaction: newPayment,
    });
  } catch (error) {
    console.error("Recharge Wallet Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit recharge request",
      error: error.message,
    });
  }
};

module.exports = {
  getPayments,
  getPaymentById,
  approvePayment,
  rejectPayment,
  recordManualTransaction,
  creditWallet,
  debitWallet,
  rechargeWallet,
};
