const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const PaymentTransaction = require("../models/PaymentTransaction");
const User = require("../models/User");

// Paytm service
const {
  createPaytmTransaction
} = require("../services/paytmService");

// Cashfree service
const {
  createCashfreeOrder,
  generateCashfreeOrderId
} = require("../services/cashfreeService");

/**
 * ---------------------------------------------------------
 * MONEY HELPERS
 * ---------------------------------------------------------
 */

const roundMoney = (value) => {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
};

const normalizeAmount = (amount) => {
  const numericAmount = Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    return null;
  }

  return roundMoney(numericAmount);
};

/**
 * ---------------------------------------------------------
 * GET WALLET
 * ---------------------------------------------------------
 */

const getWallet = async (req, res) => {
  try {
    // authMiddleware loads the user with .lean(), so use _id.
    const userId = req.user?._id || req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        requestId: req.requestId
      });
    }

    let wallet = await Wallet.findOne({
      userId,
      status: "active"
    });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        status: "active"
      });
    }

    const roundedBalance = roundMoney(wallet.balance);

    if (wallet.balance !== roundedBalance) {
      wallet.balance = roundedBalance;
      await wallet.save();
    }

    return res.status(200).json({
      success: true,
      wallet: {
        id: wallet._id,
        userId: wallet.userId,
        balance: roundedBalance,
        status: wallet.status,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt
      }
    });
  } catch (error) {
    console.error("getWallet error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch wallet",
      requestId: req.requestId
    });
  }
};

/**
 * ---------------------------------------------------------
 * CREDIT WALLET
 * ---------------------------------------------------------
 */

const creditWallet = async ({
  userId,
  amount,
  reference,
  transactionType = "recharge"
}) => {
  const numericAmount = normalizeAmount(amount);

  if (!numericAmount) {
    throw new Error("Amount must be greater than 0");
  }

  if (!reference || !String(reference).trim()) {
    throw new Error("Transaction reference is required");
  }

  const normalizedReference = String(reference).trim();

  let wallet = await Wallet.findOne({
    userId,
    status: "active"
  });

  if (!wallet) {
    try {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        status: "active"
      });
    } catch (error) {
      if (error.code === 11000) {
        wallet = await Wallet.findOne({
          userId,
          status: "active"
        });
      } else {
        throw error;
      }
    }
  }

  if (!wallet) {
    throw new Error("Active wallet not found");
  }

  const normalizedExistingBalance = roundMoney(wallet.balance);

  if (wallet.balance !== normalizedExistingBalance) {
    wallet.balance = normalizedExistingBalance;
    await wallet.save();
  }

  const balanceBefore = normalizedExistingBalance;

  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      userId,
      status: "active"
    },
    [
      {
        $set: {
          balance: {
            $round: [
              {
                $add: ["$balance", numericAmount]
              },
              2
            ]
          }
        }
      }
    ],
    {
      new: true
    }
  );

  if (!updatedWallet) {
    throw new Error("Unable to update wallet balance");
  }

  const balanceAfter = roundMoney(updatedWallet.balance);

  try {
    const walletTransaction = await WalletTransaction.create({
      userId,
      walletId: updatedWallet._id,
      transactionType,
      reference: normalizedReference,
      amount: numericAmount,
      balanceBefore,
      balanceAfter,
      status: "completed"
    });

    await User.findByIdAndUpdate(userId, {
      balance: balanceAfter
    });

    return {
      wallet: updatedWallet,
      transaction: walletTransaction,
      balanceBefore,
      balanceAfter
    };
  } catch (ledgerError) {
    try {
      await Wallet.findOneAndUpdate(
        {
          _id: updatedWallet._id,
          balance: balanceAfter,
          status: "active"
        },
        [
          {
            $set: {
              balance: {
                $round: [
                  {
                    $subtract: ["$balance", numericAmount]
                  },
                  2
                ]
              }
            }
          }
        ],
        {
          new: true
        }
      );
    } catch (rollbackError) {
      console.error(
        "Wallet credit rollback failed:",
        rollbackError
      );
    }

    throw ledgerError;
  }
};

/**
 * ---------------------------------------------------------
 * DEBIT WALLET
 * ---------------------------------------------------------
 */

const debitWallet = async ({
  userId,
  amount,
  reference,
  transactionType = "order"
}) => {
  const numericAmount = normalizeAmount(amount);

  if (!numericAmount) {
    throw new Error("Amount must be greater than 0");
  }

  if (!reference || !String(reference).trim()) {
    throw new Error("Transaction reference is required");
  }

  const normalizedReference = String(reference).trim();

  const walletBeforeUpdate = await Wallet.findOneAndUpdate(
    {
      userId,
      status: "active",
      $expr: {
        $gte: ["$balance", numericAmount]
      }
    },
    [
      {
        $set: {
          balance: {
            $round: [
              {
                $subtract: ["$balance", numericAmount]
              },
              2
            ]
          }
        }
      }
    ],
    {
      new: false
    }
  );

  if (!walletBeforeUpdate) {
    const walletExists = await Wallet.findOne({
      userId,
      status: "active"
    });

    if (!walletExists) {
      throw new Error("Active wallet not found");
    }

    throw new Error("Insufficient wallet balance");
  }

  const balanceBefore = roundMoney(walletBeforeUpdate.balance);

  const updatedWallet = await Wallet.findById(
    walletBeforeUpdate._id
  );

  if (!updatedWallet) {
    throw new Error("Unable to fetch updated wallet");
  }

  const finalBalanceAfter = roundMoney(updatedWallet.balance);

  try {
    const walletTransaction = await WalletTransaction.create({
      userId,
      walletId: updatedWallet._id,
      transactionType,
      reference: normalizedReference,
      amount: numericAmount,
      balanceBefore,
      balanceAfter: finalBalanceAfter,
      status: "completed"
    });

    await User.findByIdAndUpdate(userId, {
      balance: finalBalanceAfter
    });

    return {
      wallet: updatedWallet,
      transaction: walletTransaction,
      balanceBefore,
      balanceAfter: finalBalanceAfter
    };
  } catch (ledgerError) {
    try {
      await Wallet.findOneAndUpdate(
        {
          _id: updatedWallet._id,
          balance: finalBalanceAfter,
          status: "active"
        },
        [
          {
            $set: {
              balance: {
                $round: [
                  {
                    $add: ["$balance", numericAmount]
                  },
                  2
                ]
              }
            }
          }
        ],
        {
          new: true
        }
      );
    } catch (rollbackError) {
      console.error(
        "Wallet debit rollback failed:",
        rollbackError
      );
    }

    throw ledgerError;
  }
};

/**
 * ---------------------------------------------------------
 * GET WALLET TRANSACTIONS
 * ---------------------------------------------------------
 */

const getWalletTransactions = async (req, res) => {
  try {
    // authMiddleware loads the user with .lean(), so use _id.
    const userId = req.user?._id || req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        requestId: req.requestId
      });
    }

    const transactions = await WalletTransaction.find({
      userId
    })
      .sort({
        createdAt: -1
      })
      .lean();

    const normalizedTransactions = transactions.map(
      (transaction) => ({
        ...transaction,
        amount: roundMoney(transaction.amount),
        balanceBefore: roundMoney(transaction.balanceBefore),
        balanceAfter: roundMoney(transaction.balanceAfter)
      })
    );

    return res.status(200).json({
      success: true,
      count: normalizedTransactions.length,
      transactions: normalizedTransactions
    });
  } catch (error) {
    console.error(
      "getWalletTransactions error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch wallet transactions",
      requestId: req.requestId
    });
  }
};

/**
 * ---------------------------------------------------------
 * CREATE RECHARGE
 * ---------------------------------------------------------
 *
 * Paytm:
 * - Creates a Paytm transaction.
 * - Saves its order information.
 * - Returns the Paytm payment details.
 *
 * Cashfree:
 * - Saves the deterministic gateway order ID BEFORE calling
 *   Cashfree, so a webhook can always locate the payment.
 * - Creates a Cashfree order.
 * - Returns payment_session_id to the frontend.
 * - Uncertain outcomes (timeout / network / 5xx) keep the
 *   payment pending so a verified webhook can reconcile it.
 *
 * Manual / UPI / QR:
 * - Creates a pending transaction for admin review.
 *
 * IMPORTANT:
 * Creating a gateway order does NOT credit the wallet.
 * Credit only after verified payment success.
 */

const createRecharge = async (req, res) => {
  let payment = null;

  try {
    // authMiddleware loads the user with .lean(), so the
    // "id" virtual does not exist. Use _id (or req.userId).
    const userId = req.user?._id || req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        requestId: req.requestId
      });
    }

    const {
      amount,
      reference,
      paymentNote,
      paymentScreenshot,
      phone
    } = req.body || {};

    /**
     * Normalize the payment method so case or whitespace
     * differences ("Cashfree", "cashfree ") do not cause a
     * false "Invalid payment method" error.
     */
    const rawPaymentMethod = req.body?.paymentMethod;

    const paymentMethod = String(rawPaymentMethod || "")
      .trim()
      .toLowerCase();

    const numericAmount = normalizeAmount(amount);

    if (!numericAmount) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
        requestId: req.requestId
      });
    }

    if (!reference || !String(reference).trim()) {
      return res.status(400).json({
        success: false,
        message: "Reference is required",
        requestId: req.requestId
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
        requestId: req.requestId
      });
    }

    const normalizedReference = String(reference).trim();

    const allowedPaymentMethods = [
      "razorpay",
      "paytm",
      "cashfree",
      "upi",
      "qr",
      "manual"
    ];

    // Diagnostic log: shows exactly what the server received.
    // Remove once the issue is resolved.
    console.log("Recharge payment method:", {
      raw: JSON.stringify(rawPaymentMethod),
      rawType: typeof rawPaymentMethod,
      normalized: paymentMethod
    });

    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
        requestId: req.requestId
      });
    }

    const existingPayment = await PaymentTransaction.findOne({
      reference: normalizedReference
    });

    if (existingPayment) {
      return res.status(409).json({
        success: false,
        message: "Payment reference already exists",
        requestId: req.requestId
      });
    }

    /**
     * Create the pending record before contacting the gateway.
     */
    payment = await PaymentTransaction.create({
      userId,
      amount: numericAmount,
      reference: normalizedReference,
      paymentMethod,
      transactionType: "recharge",
      status: "pending",
      paymentNote: paymentNote || "",
      paymentScreenshot: paymentScreenshot || null
    });

    /**
     * -----------------------------------------------------
     * PAYTM
     * -----------------------------------------------------
     */

    if (paymentMethod === "paytm") {
      try {
        const paytmResponse = await createPaytmTransaction({
          amount: numericAmount,
          orderId: String(payment._id),
          userId
        });

        payment.gatewayOrderId =
          paytmResponse.orderId ||
          paytmResponse.ORDERID ||
          String(payment._id);

        payment.gatewayTransactionId =
          paytmResponse.txnId ||
          paytmResponse.TXNID ||
          null;

        payment.gatewayResponse = paytmResponse;

        await payment.save();

        return res.status(201).json({
          success: true,
          message: "Paytm payment initiated successfully",
          payment: {
            id: payment._id,
            userId: payment.userId,
            amount: roundMoney(payment.amount),
            reference: payment.reference,
            paymentMethod: payment.paymentMethod,
            status: payment.status,
            gatewayOrderId: payment.gatewayOrderId,
            gatewayTransactionId: payment.gatewayTransactionId
          },
          paymentGateway: paytmResponse
        });
      } catch (paytmError) {
        console.error("Paytm payment initiation error:", {
          message: paytmError.message,
          paymentId: String(payment._id)
        });

        payment.status = "failed";
        payment.gatewayResponse = {
          success: false,
          message: "Paytm payment initiation failed"
        };

        await payment.save();

        return res.status(502).json({
          success: false,
          message: "Unable to initiate Paytm payment",
          paymentId: payment._id,
          status: payment.status,
          requestId: req.requestId
        });
      }
    }

    /**
     * -----------------------------------------------------
     * CASHFREE
     * -----------------------------------------------------
     */

    if (paymentMethod === "cashfree") {
      try {
        /**
         * Load identity details from the authenticated user's
         * database record, not from client-supplied name/email.
         */
        const user = await User.findById(userId)
          .select("name email")
          .lean();

        if (!user) {
          payment.status = "failed";
          await payment.save();

          return res.status(404).json({
            success: false,
            message: "User profile not found",
            paymentId: payment._id,
            requestId: req.requestId
          });
        }

        if (!user.email) {
          payment.status = "failed";
          await payment.save();

          return res.status(400).json({
            success: false,
            message: "A valid email is required for Cashfree payment",
            paymentId: payment._id,
            requestId: req.requestId
          });
        }

        const cashfreeReference = String(payment._id);

        /**
         * Save the deterministic order ID BEFORE contacting
         * Cashfree. If the create-order request times out after
         * reaching the gateway, a webhook can still locate this
         * payment by gatewayOrderId.
         */
        payment.gatewayOrderId =
          generateCashfreeOrderId(cashfreeReference);

        payment.status = "pending";

        payment.gatewayResponse = {
          provider: "cashfree",
          orderId: payment.gatewayOrderId,
          environment:
            (process.env.CASHFREE_ENVIRONMENT || "sandbox").toLowerCase(),
          outcomeUnknown: false
        };

        await payment.save();

        /**
         * Cashfree requires a valid customer phone number.
         * This controller accepts it from the request because
         * the current User schema does not include a phone field.
         * The Cashfree service validates the number.
         */
        const cashfreeResponse = await createCashfreeOrder({
          reference: cashfreeReference,
          amount: numericAmount,
          userId: String(userId),
          name: user.name || "Customer",
          email: user.email,
          phone
        });

        /**
         * The returned order must be the one already saved.
         */
        if (cashfreeResponse.orderId !== payment.gatewayOrderId) {
          const mismatchError = new Error(
            "Cashfree order ID does not match the saved payment"
          );
          mismatchError.code = "CASHFREE_UNCERTAIN_OUTCOME";
          mismatchError.outcomeUnknown = true;
          mismatchError.retryable = true;
          throw mismatchError;
        }

        /**
         * Store only non-secret metadata.
         * Do not store payment_session_id in gatewayResponse.
         */
        payment.gatewayResponse = {
          provider: "cashfree",
          orderId: cashfreeResponse.orderId,
          orderStatus:
            cashfreeResponse.response?.order_status || "ACTIVE",
          currency: cashfreeResponse.currency || "INR",
          environment: cashfreeResponse.environment || "sandbox",
          outcomeUnknown: false
        };

        await payment.save();

        return res.status(201).json({
          success: true,
          message: "Cashfree payment initiated successfully",
          payment: {
            id: payment._id,
            userId: payment.userId,
            amount: roundMoney(payment.amount),
            reference: payment.reference,
            paymentMethod: payment.paymentMethod,
            status: payment.status,
            gatewayOrderId: payment.gatewayOrderId,
            createdAt: payment.createdAt
          },
          paymentGateway: {
            provider: "cashfree",
            orderId: cashfreeResponse.orderId,
            payment_session_id: cashfreeResponse.paymentSessionId,
            currency: cashfreeResponse.currency || "INR",
            environment: cashfreeResponse.environment || "sandbox"
          }
        });
      } catch (cashfreeError) {
        console.error("Cashfree payment initiation error:", {
          message: cashfreeError.message,
          code: cashfreeError.code,
          paymentId: String(payment._id),
          outcomeUnknown: cashfreeError.outcomeUnknown === true
        });

        const outcomeUnknown =
          cashfreeError.outcomeUnknown === true ||
          cashfreeError.code === "CASHFREE_UNCERTAIN_OUTCOME";

        if (outcomeUnknown) {
          /**
           * Cashfree may have created the order.
           * Keep this payment pending (gatewayOrderId is already
           * saved) so a verified webhook can reconcile it.
           */
          payment.status = "pending";
          payment.gatewayResponse = {
            provider: "cashfree",
            orderId: payment.gatewayOrderId,
            success: false,
            outcomeUnknown: true,
            message: "Cashfree order outcome is being verified"
          };

          await payment.save();

          return res.status(202).json({
            success: false,
            message:
              "Payment initiation outcome is uncertain. Please check the payment status before retrying.",
            paymentId: payment._id,
            status: payment.status,
            outcomeUnknown: true,
            requestId: req.requestId
          });
        }

        /**
         * Definite failures can safely be marked failed.
         */
        payment.status = "failed";
        payment.gatewayResponse = {
          provider: "cashfree",
          orderId: payment.gatewayOrderId,
          success: false,
          outcomeUnknown: false,
          message: "Cashfree payment initiation failed"
        };

        await payment.save();

        return res.status(502).json({
          success: false,
          message: "Unable to initiate Cashfree payment",
          paymentId: payment._id,
          status: payment.status,
          requestId: req.requestId
        });
      }
    }

    /**
     * -----------------------------------------------------
     * MANUAL / UPI / QR / OTHER NON-GATEWAY METHODS
     * -----------------------------------------------------
     */

    return res.status(201).json({
      success: true,
      message: "Recharge request created successfully",
      payment: {
        id: payment._id,
        userId: payment.userId,
        amount: roundMoney(payment.amount),
        reference: payment.reference,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        paymentNote: payment.paymentNote,
        paymentScreenshot: payment.paymentScreenshot,
        createdAt: payment.createdAt
      }
    });
  } catch (error) {
    console.error("createRecharge error:", {
      message: error.message,
      code: error.code,
      paymentId: payment ? String(payment._id) : undefined
    });
    console.error("createRecharge error stack:", error.stack);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Payment reference already exists",
        requestId: req.requestId
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create recharge request",
      requestId: req.requestId
    });
  }
};

/**
 * ---------------------------------------------------------
 * EXPORTS
 * ---------------------------------------------------------
 */

module.exports = {
  getWallet,
  creditWallet,
  debitWallet,
  getWalletTransactions,
  createRecharge
};