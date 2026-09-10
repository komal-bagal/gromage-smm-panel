const mongoose = require("mongoose");

const Order = require("../models/Order");
const Service = require("../models/Service");
const Provider = require("../models/Provider");
const OrderStatusLog = require("../models/OrderStatusLog");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const User = require("../models/User");

const {
  logProviderSuccess,
  logProviderFailure
} = require("../services/providerLogService");

const {
  syncOrderProviderStatus: syncProviderStatus
} = require("../services/providerStatusService");

const {
  cancelProviderOrder,
  refillProviderOrder
} = require("../services/providerApiService");


// ============================================================
// CONSTANTS
// ============================================================

const PROVIDER_TIMEOUT_MS = 30000;

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

const CANCELLABLE_STATUSES = new Set([
  "pending",
  "processing",
  "in_progress"
]);

const TERMINAL_STATUSES = new Set([
  "completed",
  "partial",
  "canceled",
  "refunded",
  "failed"
]);


// ============================================================
// STATUS TRANSITIONS
// ============================================================

const ALLOWED_STATUS_TRANSITIONS = {
  pending: new Set([
    "processing",
    "in_progress",
    "canceled",
    "failed"
  ]),

  processing: new Set([
    "in_progress",
    "completed",
    "partial",
    "canceled",
    "failed"
  ]),

  in_progress: new Set([
    "completed",
    "partial",
    "canceled",
    "failed"
  ]),

  completed: new Set([
    "refunded"
  ]),

  partial: new Set([
    "completed",
    "refunded"
  ]),

  canceled: new Set([
    "refunded"
  ]),

  failed: new Set([
    "refunded"
  ]),

  refunded: new Set([])
};


// ============================================================
// HELPERS
// ============================================================

function generateOrderReference() {
  return `ORD-${Date.now()}-${Math.floor(
    100000 + Math.random() * 900000
  )}`;
}


function generateRefundReference(orderId) {
  return `REFUND-${orderId}`;
}


function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}


function parseQuantity(value) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity)) {
    return null;
  }

  return Math.floor(quantity);
}


function parseProviderResponse(text) {
  if (!text) {
    return {};
  }

  if (typeof text === "object") {
    return text;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text
    };
  }
}


function isDuplicateKeyError(error) {
  return error && error.code === 11000;
}


function getProviderApiUrl(provider) {
  return (
    provider.apiUrl ||
    provider.baseUrl ||
    provider.url ||
    null
  );
}


function isProviderSuccessResponse(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  if (data.error) {
    return false;
  }

  if (
    data.success === false ||
    data.status === false
  ) {
    return false;
  }

  return Boolean(
    data.order ||
    data.orderId ||
    data.id ||
    data.success === true
  );
}


function extractProviderOrderId(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  return (
    data.order ||
    data.orderId ||
    data.id ||
    data.data?.order ||
    data.data?.orderId ||
    data.data?.id ||
    null
  );
}


function isTransientHttpStatus(status) {
  return (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}


function getProviderErrorMessage(data, fallback = "Provider request failed") {
  if (!data) {
    return fallback;
  }

  if (typeof data === "string") {
    return data;
  }

  return (
    data.error ||
    data.message ||
    data.msg ||
    data.data?.error ||
    data.data?.message ||
    fallback
  );
}


function isAdminOrStaff(user) {
  return (
    user &&
    ["admin", "staff"].includes(user.role)
  );
}


async function createStatusLogSafe({
  orderId,
  previousStatus = null,
  newStatus,
  source = "system",
  message = "",
  providerResponse = null
}) {
  try {
    await OrderStatusLog.create({
      orderId,
      previousStatus,
      newStatus,
      source,
      message,
      providerResponse
    });
  } catch (error) {
    console.error(
      "OrderStatusLog creation failed:",
      error.message
    );
  }
}


async function populateOrder(order) {
  return Order.findById(order._id)
    .populate("userId", "name email")
    .populate("serviceId", "name category")
    .populate("providerId", "name");
}


async function syncUserBalanceFromWallet(userId, walletId) {
  try {
    const wallet = await Wallet.findById(walletId).select("balance");

    if (!wallet) {
      return null;
    }

    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          balance: wallet.balance
        }
      }
    );

    return wallet.balance;
  } catch (error) {
    console.error(
      "User balance sync failed:",
      error.message
    );

    return null;
  }
}


// ============================================================
// FETCH WITH TIMEOUT
// ============================================================

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = PROVIDER_TIMEOUT_MS
) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}


// ============================================================
// PROVIDER ORDER SUBMISSION
// ============================================================

async function submitOrderToProvider({
  order,
  provider,
  service,
  quantity
}) {
  const apiUrl = getProviderApiUrl(provider);

  if (!apiUrl) {
    return {
      success: false,
      uncertain: false,
      message: "Provider API URL is missing"
    };
  }

  if (!provider.apiKey) {
    return {
      success: false,
      uncertain: false,
      message: "Provider API key is missing"
    };
  }

  if (!service.providerServiceId) {
    return {
      success: false,
      uncertain: false,
      message: "Provider service ID is missing"
    };
  }

  const url = `${apiUrl.replace(/\/$/, "")}/order`;

  const payload = {
    key: provider.apiKey,
    action: "add",
    service: service.providerServiceId,
    link: order.link,
    quantity
  };

  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      },
      PROVIDER_TIMEOUT_MS
    );

    const duration = Date.now() - startedAt;

    const responseText = await response.text();

    const data = parseProviderResponse(responseText);

    if (!response.ok) {
      await logProviderFailure({
        providerId: provider._id,
        endpoint: "/order",
        method: "POST",
        httpStatus: response.status,
        duration,
        request: payload,
        response: data,
        attempt: 1,
        maxAttempts: 1
      });

      return {
        success: false,
        uncertain: isTransientHttpStatus(response.status),
        message: getProviderErrorMessage(
          data,
          `Provider returned HTTP ${response.status}`
        ),
        providerResponse: data
      };
    }

    if (!isProviderSuccessResponse(data)) {
      await logProviderFailure({
        providerId: provider._id,
        endpoint: "/order",
        method: "POST",
        httpStatus: response.status,
        duration,
        request: payload,
        response: data,
        attempt: 1,
        maxAttempts: 1
      });

      return {
        success: false,
        uncertain: false,
        message: getProviderErrorMessage(
          data,
          "Provider rejected the order"
        ),
        providerResponse: data
      };
    }

    const providerOrderId = extractProviderOrderId(data);

    if (!providerOrderId) {
      await logProviderFailure({
        providerId: provider._id,
        endpoint: "/order",
        method: "POST",
        httpStatus: response.status,
        duration,
        request: payload,
        response: data,
        attempt: 1,
        maxAttempts: 1
      });

      return {
        success: false,
        uncertain: true,
        message:
          "Provider accepted the request but no provider order ID was returned",
        providerResponse: data
      };
    }

    await logProviderSuccess({
      providerId: provider._id,
      endpoint: "/order",
      method: "POST",
      httpStatus: response.status,
      duration,
      request: payload,
      response: data,
      attempt: 1,
      maxAttempts: 1
    });

    return {
      success: true,
      uncertain: false,
      providerOrderId: String(providerOrderId),
      providerResponse: data
    };

  } catch (error) {
    const duration = Date.now() - startedAt;

    const uncertain =
      error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      error.code === "ECONNRESET" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND";

    await logProviderFailure({
      providerId: provider._id,
      endpoint: "/order",
      method: "POST",
      httpStatus: 0,
      duration,
      request: payload,
      response: {
        error: error.message
      },
      attempt: 1,
      maxAttempts: 1
    });

    return {
      success: false,
      uncertain,
      message: error.message || "Provider request failed",
      providerResponse: {
        error: error.message
      }
    };
  }
}


// ============================================================
// REFUND ORDER AMOUNT
// ============================================================

async function refundOrderAmount({
  order,
  reason = "Order refund"
}) {
  const refundReference = generateRefundReference(
    order._id.toString()
  );

  // ----------------------------------------------------------
  // Check whether refund already exists
  // ----------------------------------------------------------

  const existingRefund =
    await WalletTransaction.findOne({
      reference: refundReference,
      transactionType: "refund"
    });

  if (existingRefund) {
    return {
      success: true,
      alreadyRefunded: true,
      transaction: existingRefund
    };
  }

  // ----------------------------------------------------------
  // Validate amount
  // ----------------------------------------------------------

  const amount = roundMoney(order.charge);

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      success: false,
      message: "Invalid refund amount"
    };
  }

  // ----------------------------------------------------------
  // Get wallet
  // ----------------------------------------------------------

  const wallet = await Wallet.findOne({
    userId: order.userId,
    _id: order.walletId || undefined
  });

  let targetWallet = wallet;

  if (!targetWallet) {
    targetWallet = await Wallet.findOne({
      userId: order.userId
    });
  }

  if (!targetWallet) {
    return {
      success: false,
      message: "Wallet not found for refund"
    };
  }

  // ----------------------------------------------------------
  // Atomic wallet credit
  // ----------------------------------------------------------

  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      _id: targetWallet._id
    },
    {
      $inc: {
        balance: amount
      }
    },
    {
      new: true
    }
  );

  if (!updatedWallet) {
    return {
      success: false,
      message: "Unable to credit wallet"
    };
  }

  const balanceAfter = roundMoney(
    updatedWallet.balance
  );

  const balanceBefore = roundMoney(
    balanceAfter - amount
  );

  // ----------------------------------------------------------
  // Create refund ledger transaction
  // ----------------------------------------------------------

  try {
    const refundTransaction =
      await WalletTransaction.create({
        userId: order.userId,
        walletId: targetWallet._id,
        transactionType: "refund",
        reference: refundReference,
        amount,
        balanceBefore,
        balanceAfter,
        status: "completed"
      });

    await syncUserBalanceFromWallet(
      order.userId,
      targetWallet._id
    );

    return {
      success: true,
      alreadyRefunded: false,
      transaction: refundTransaction
    };

  } catch (error) {

    // --------------------------------------------------------
    // Duplicate refund means another request already refunded
    // --------------------------------------------------------

    if (isDuplicateKeyError(error)) {

      const existing =
        await WalletTransaction.findOne({
          reference: refundReference,
          transactionType: "refund"
        });

      // Roll back our wallet credit because the other
      // request already created the refund transaction.
      await Wallet.findByIdAndUpdate(
        targetWallet._id,
        {
          $inc: {
            balance: -amount
          }
        }
      );

      await syncUserBalanceFromWallet(
        order.userId,
        targetWallet._id
      );

      return {
        success: true,
        alreadyRefunded: true,
        transaction: existing
      };
    }

    // --------------------------------------------------------
    // Roll back wallet credit if ledger creation failed
    // --------------------------------------------------------

    try {
      await Wallet.findByIdAndUpdate(
        targetWallet._id,
        {
          $inc: {
            balance: -amount
          }
        }
      );

      await syncUserBalanceFromWallet(
        order.userId,
        targetWallet._id
      );

    } catch (rollbackError) {
      console.error(
        "Refund wallet rollback failed:",
        rollbackError.message
      );
    }

    console.error(
      "Refund transaction failed:",
      error.message
    );

    return {
      success: false,
      message:
        "Refund could not be completed safely"
    };
  }
}


// ============================================================
// CREATE ORDER
// ============================================================

async function createOrder(req, res) {
  try {

    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // --------------------------------------------------------
    // User validation
    // --------------------------------------------------------

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.status && user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "User account is inactive"
      });
    }

    // --------------------------------------------------------
    // Input validation
    // --------------------------------------------------------

    const {
      serviceId,
      link,
      quantity: quantityInput,
      idempotencyKey,
      dripFeed = false,
      note = ""
    } = req.body;

    if (!serviceId) {
      return res.status(400).json({
        success: false,
        message: "serviceId is required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid serviceId"
      });
    }

    if (!link || typeof link !== "string") {
      return res.status(400).json({
        success: false,
        message: "Valid link is required"
      });
    }

    const quantity = parseQuantity(quantityInput);

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than zero"
      });
    }

    if (
      idempotencyKey !== undefined &&
      idempotencyKey !== null &&
      String(idempotencyKey).trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid idempotencyKey"
      });
    }

    const cleanIdempotencyKey =
      idempotencyKey
        ? String(idempotencyKey).trim()
        : undefined;

    // --------------------------------------------------------
    // Idempotency check
    // --------------------------------------------------------

    if (cleanIdempotencyKey) {
      const existingOrder = await Order.findOne({
        userId,
        idempotencyKey: cleanIdempotencyKey
      });

      if (existingOrder) {
        return res.status(200).json({
          success: true,
          message: "Existing order returned",
          idempotent: true,
          order: await populateOrder(existingOrder)
        });
      }
    }

    // --------------------------------------------------------
    // Service validation
    // --------------------------------------------------------

    const service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    if (service.status && service.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Service is inactive"
      });
    }

    if (
      service.min !== undefined &&
      quantity < Number(service.min)
    ) {
      return res.status(400).json({
        success: false,
        message: `Minimum quantity is ${service.min}`
      });
    }

    if (
      service.max !== undefined &&
      quantity > Number(service.max)
    ) {
      return res.status(400).json({
        success: false,
        message: `Maximum quantity is ${service.max}`
      });
    }

    // --------------------------------------------------------
    // Calculate charge SERVER-SIDE
    // --------------------------------------------------------

    const servicePrice = Number(
      service.sellingPrice ??
      service.price ??
      0
    );

    const rateQuantity = Number(
      service.rateQuantity ||
      1000
    );

    if (
      !Number.isFinite(servicePrice) ||
      servicePrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid service price"
      });
    }

    if (
      !Number.isFinite(rateQuantity) ||
      rateQuantity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid service rate quantity"
      });
    }

    const charge = roundMoney(
      (servicePrice / rateQuantity) *
      quantity
    );

    // --------------------------------------------------------
    // Provider validation
    // --------------------------------------------------------

    const providerId =
      service.providerId ||
      service.provider;

    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "No provider configured for this service"
      });
    }

    const provider =
      await Provider.findOne({
        _id: providerId,
        status: "active"
      });

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: "Active provider not found"
      });
    }

    if (!service.providerServiceId) {
      return res.status(400).json({
        success: false,
        message: "Provider service mapping is missing"
      });
    }

    // --------------------------------------------------------
    // Wallet
    // --------------------------------------------------------

    let wallet = await Wallet.findOne({
      userId
    });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0
      });
    }

    // --------------------------------------------------------
    // Atomic wallet deduction
    // --------------------------------------------------------

    const updatedWallet =
      await Wallet.findOneAndUpdate(
        {
          _id: wallet._id,
          balance: {
            $gte: charge
          }
        },
        {
          $inc: {
            balance: -charge
          }
        },
        {
          new: true
        }
      );

    if (!updatedWallet) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance"
      });
    }

    const balanceAfter = roundMoney(
      updatedWallet.balance
    );

    const balanceBefore = roundMoney(
      balanceAfter + charge
    );

    // --------------------------------------------------------
    // Wallet debit transaction
    // --------------------------------------------------------

    const orderReference =
      generateOrderReference();

    let walletTransaction;

    try {

      walletTransaction =
        await WalletTransaction.create({
          userId,
          walletId: wallet._id,
          transactionType: "debit",
          reference: orderReference,
          amount: charge,
          balanceBefore,
          balanceAfter,
          status: "completed"
        });

    } catch (error) {

      // Roll back wallet deduction
      await Wallet.findByIdAndUpdate(
        wallet._id,
        {
          $inc: {
            balance: charge
          }
        }
      );

      await syncUserBalanceFromWallet(
        userId,
        wallet._id
      );

      if (isDuplicateKeyError(error)) {
        return res.status(409).json({
          success: false,
          message:
            "Order transaction already exists. Please retry."
        });
      }

      throw error;
    }

    await syncUserBalanceFromWallet(
      userId,
      wallet._id
    );

    // --------------------------------------------------------
    // Create Order
    // --------------------------------------------------------

    let order;

    try {

      order = await Order.create({
        userId,
        serviceId,
        providerId: provider._id,
        providerOrderId: null,
        providerResponse: null,
        providerError: null,
        providerSubmittedAt: null,

        idempotencyKey:
          cleanIdempotencyKey,

        walletTransactionId:
          walletTransaction._id,

        link: link.trim(),
        quantity,
        charge,

        status: "pending",

        startCount: 0,
        remains: quantity,

        refill:
          Boolean(service.refill),

        refillId: null,

        cancel:
          Boolean(service.cancel),

        dripFeed:
          Boolean(dripFeed),

        note:
          typeof note === "string"
            ? note.trim()
            : ""
      });

    } catch (error) {

      // ------------------------------------------------------
      // Duplicate idempotency request
      // ------------------------------------------------------

      if (isDuplicateKeyError(error)) {

        const existingOrder =
          cleanIdempotencyKey
            ? await Order.findOne({
                userId,
                idempotencyKey:
                  cleanIdempotencyKey
              })
            : null;

        // Refund the wallet debit because the order
        // was not created by this request.
        await Wallet.findByIdAndUpdate(
          wallet._id,
          {
            $inc: {
              balance: charge
            }
          }
        );

        await WalletTransaction.findByIdAndUpdate(
          walletTransaction._id,
          {
            $set: {
              status: "reversed"
            }
          }
        );

        await syncUserBalanceFromWallet(
          userId,
          wallet._id
        );

        if (existingOrder) {
          return res.status(200).json({
            success: true,
            message: "Existing order returned",
            idempotent: true,
            order:
              await populateOrder(existingOrder)
          });
        }
      }

      // Roll back wallet if order creation failed
      await Wallet.findByIdAndUpdate(
        wallet._id,
        {
          $inc: {
            balance: charge
          }
        }
      );

      await WalletTransaction.findByIdAndUpdate(
        walletTransaction._id,
        {
          $set: {
            status: "reversed"
          }
        }
      );

      await syncUserBalanceFromWallet(
        userId,
        wallet._id
      );

      throw error;
    }

    // --------------------------------------------------------
    // Initial status log
    // --------------------------------------------------------

    await createStatusLogSafe({
      orderId: order._id,
      previousStatus: null,
      newStatus: "pending",
      source: "system",
      message: "Order created"
    });

    // --------------------------------------------------------
    // Submit to provider
    // --------------------------------------------------------

    const providerResult =
      await submitOrderToProvider({
        order,
        provider,
        service,
        quantity
      });

    // --------------------------------------------------------
    // Provider uncertain / transient
    // --------------------------------------------------------

    if (
      !providerResult.success &&
      providerResult.uncertain
    ) {

      order.providerError =
        providerResult.message || null;

      order.providerResponse =
        providerResult.providerResponse || {
          uncertain: true
        };

      await order.save();

      await createStatusLogSafe({
        orderId: order._id,
        previousStatus: "pending",
        newStatus: "pending",
        source: "provider",
        message:
          "Provider response is uncertain. Order remains pending for reconciliation.",
        providerResponse:
          providerResult.providerResponse || null
      });

      return res.status(202).json({
        success: true,
        message:
          "Order created but provider response is uncertain. It remains pending for reconciliation.",
        order:
          await populateOrder(order)
      });
    }

    // --------------------------------------------------------
    // Definite provider failure
    // --------------------------------------------------------

    if (!providerResult.success) {

      const previousStatus =
        order.status;

      order.status = "failed";

      order.providerError =
        providerResult.message || null;

      order.providerResponse =
        providerResult.providerResponse || null;

      await order.save();

      await createStatusLogSafe({
        orderId: order._id,
        previousStatus,
        newStatus: "failed",
        source: "provider",
        message:
          providerResult.message ||
          "Provider rejected the order",
        providerResponse:
          providerResult.providerResponse || null
      });

      // ------------------------------------------------------
      // Refund customer
      // ------------------------------------------------------

      const refundResult =
        await refundOrderAmount({
          order,
          reason:
            "Automatic refund after provider rejection"
        });

      if (refundResult.success) {

        const oldStatus =
          order.status;

        order.status = "refunded";

        await order.save();

        await createStatusLogSafe({
          orderId: order._id,
          previousStatus: oldStatus,
          newStatus: "refunded",
          source: "system",
          message:
            "Customer refunded after provider rejection"
        });

        return res.status(400).json({
          success: false,
          message:
            providerResult.message ||
            "Provider rejected the order",
          refunded: true,
          order:
            await populateOrder(order)
        });
      }

      return res.status(502).json({
        success: false,
        message:
          providerResult.message ||
          "Provider rejected the order",
        refunded: false,
        refundError:
          refundResult.message,
        order:
          await populateOrder(order)
      });
    }

    // --------------------------------------------------------
    // Provider success
    // --------------------------------------------------------

    const previousStatus =
      order.status;

    order.providerOrderId =
      providerResult.providerOrderId;

    order.providerResponse =
      providerResult.providerResponse || null;

    order.providerError = null;

    order.providerSubmittedAt =
      new Date();

    order.status = "processing";

    await order.save();

    await createStatusLogSafe({
      orderId: order._id,
      previousStatus,
      newStatus: "processing",
      source: "provider",
      message:
        "Order successfully submitted to provider",
      providerResponse:
        providerResult.providerResponse || null
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      order:
        await populateOrder(order)
    });

  } catch (error) {

    console.error(
      "createOrder error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message
    });
  }
}


// ============================================================
// SYNC PROVIDER STATUS
// ============================================================

async function syncOrderProviderStatus(req, res) {
  try {

    const { orderId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(orderId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId"
      });
    }

    const order =
      await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const isOwner =
      order.userId.toString() ===
      req.user._id.toString();

    if (!isOwner && !isAdminOrStaff(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (!order.providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider is not assigned"
      });
    }

    if (!order.providerOrderId) {
      return res.status(400).json({
        success: false,
        message:
          "Provider order ID is not available"
      });
    }

    const result =
      await syncProviderStatus({
        orderId: order._id
      });

    const updatedOrder =
      await Order.findById(order._id);

    return res.status(200).json({
      success: true,
      message: "Provider status synchronized",
      sync: result,
      order:
        await populateOrder(updatedOrder)
    });

  } catch (error) {

    console.error(
      "syncOrderProviderStatus error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to synchronize provider status",
      error: error.message
    });
  }
}


// ============================================================
// REQUEST REFILL
// ============================================================

async function requestOrderRefill(req, res) {
  try {

    const { orderId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(orderId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId"
      });
    }

    const order =
      await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const isOwner =
      order.userId.toString() ===
      req.user._id.toString();

    if (!isOwner && !isAdminOrStaff(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (!order.refill) {
      return res.status(400).json({
        success: false,
        message:
          "Refill is not enabled for this order"
      });
    }

    if (!order.providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider is not assigned"
      });
    }

    if (!order.providerOrderId) {
      return res.status(400).json({
        success: false,
        message:
          "Provider order ID is not available"
      });
    }

    if (
      !["completed", "partial"].includes(
        order.status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Refill can only be requested for completed or partial orders"
      });
    }

    const provider =
      await Provider.findOne({
        _id: order.providerId,
        status: "active"
      });

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: "Active provider not found"
      });
    }

    // --------------------------------------------------------
    // Centralized provider refill service
    // --------------------------------------------------------

    const result =
      await refillProviderOrder({
        provider,
        providerOrderId:
          order.providerOrderId,
        orderId: order._id
      });

    if (!result || result.success === false) {

      const message =
        result?.message ||
        "Provider refill request failed";

      order.providerError = message;

      await order.save();

      return res.status(502).json({
        success: false,
        message
      });
    }

    const providerResponse =
      result.providerResponse ||
      result.data ||
      result;

    const refillId =
      result.refillId ||
      result.id ||
      result.order ||
      result.data?.refill ||
      result.data?.refillId ||
      result.data?.id ||
      null;

    if (!refillId) {

      order.providerError =
        "Provider accepted refill request but no refill ID was returned";

      order.providerResponse =
        providerResponse;

      await order.save();

      return res.status(502).json({
        success: false,
        message:
          "Provider accepted refill request but no refill ID was returned"
      });
    }

    order.refillId =
      String(refillId);

    order.providerResponse =
      providerResponse;

    order.providerError = null;

    await order.save();

    return res.status(200).json({
      success: true,
      message:
        "Refill requested successfully",
      refillId:
        order.refillId,
      order:
        await populateOrder(order)
    });

  } catch (error) {

    console.error(
      "requestOrderRefill error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to request refill",
      error: error.message
    });
  }
}


// ============================================================
// CANCEL ORDER
// ============================================================

async function cancelOrder(req, res) {
  try {

    const { orderId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(orderId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId"
      });
    }

    const order =
      await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const isOwner =
      order.userId.toString() ===
      req.user._id.toString();

    if (!isOwner && !isAdminOrStaff(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (!CANCELLABLE_STATUSES.has(order.status)) {
      return res.status(400).json({
        success: false,
        message:
          `Order cannot be canceled from status "${order.status}"`
      });
    }

    if (!order.cancel) {
      return res.status(400).json({
        success: false,
        message:
          "Cancellation is not enabled for this order"
      });
    }

    // --------------------------------------------------------
    // Case 1: Provider order does not exist
    // --------------------------------------------------------

    if (!order.providerOrderId) {

      const previousStatus =
        order.status;

      order.status = "canceled";

      await order.save();

      await createStatusLogSafe({
        orderId: order._id,
        previousStatus,
        newStatus: "canceled",
        source: "user",
        message:
          "Order canceled before provider submission"
      });

      const refundResult =
        await refundOrderAmount({
          order,
          reason:
            "Refund after local order cancellation"
        });

      if (!refundResult.success) {

        return res.status(500).json({
          success: false,
          message:
            "Order canceled but refund could not be completed",
          refundError:
            refundResult.message,
          order:
            await populateOrder(order)
        });
      }

      const canceledStatus =
        order.status;

      order.status = "refunded";

      await order.save();

      await createStatusLogSafe({
        orderId: order._id,
        previousStatus: canceledStatus,
        newStatus: "refunded",
        source: "system",
        message:
          "Wallet refunded after order cancellation"
      });

      return res.status(200).json({
        success: true,
        message:
          "Order canceled and refunded successfully",
        order:
          await populateOrder(order)
      });
    }

    // --------------------------------------------------------
    // Provider cancellation
    // --------------------------------------------------------

    if (!order.providerId) {
      return res.status(400).json({
        success: false,
        message:
          "Provider is not assigned"
      });
    }

    const provider =
      await Provider.findOne({
        _id: order.providerId,
        status: "active"
      });

    if (!provider) {
      return res.status(400).json({
        success: false,
        message:
          "Active provider not found"
      });
    }

    // --------------------------------------------------------
    // Request cancellation through provider service
    // --------------------------------------------------------

    const cancelResult =
      await cancelProviderOrder({
        provider,
        providerOrderId:
          order.providerOrderId,
        orderId: order._id
      });

    if (
      !cancelResult ||
      cancelResult.success === false
    ) {

      const message =
        cancelResult?.message ||
        "Provider cancellation request failed";

      order.providerError =
        message;

      await order.save();

      return res.status(502).json({
        success: false,
        message:
          "Provider cancellation was not confirmed",
        providerMessage:
          message,
        refunded: false
      });
    }

    // --------------------------------------------------------
    // IMPORTANT:
    // Confirm provider status before refund.
    // --------------------------------------------------------

    let syncResult;

    try {

      syncResult =
        await syncProviderStatus({
          orderId: order._id
        });

    } catch (syncError) {

      console.error(
        "Cancellation status confirmation failed:",
        syncError.message
      );

      order.providerError =
        "Cancellation requested but provider status could not be confirmed";

      await order.save();

      return res.status(202).json({
        success: false,
        message:
          "Cancellation was requested, but provider cancellation could not yet be confirmed. No refund was issued.",
        refunded: false,
        confirmationError:
          syncError.message
      });
    }

    const refreshedOrder =
      await Order.findById(order._id);

    // --------------------------------------------------------
    // Do NOT refund unless provider says canceled.
    // --------------------------------------------------------

    if (
      !refreshedOrder ||
      refreshedOrder.status !== "canceled"
    ) {

      return res.status(202).json({
        success: false,
        message:
          "Provider cancellation is not yet confirmed. No refund was issued.",
        providerStatus:
          refreshedOrder?.status ||
          syncResult?.status ||
          null,
        refunded: false
      });
    }

    // --------------------------------------------------------
    // Provider cancellation confirmed.
    // Now refund.
    // --------------------------------------------------------

    const refundResult =
      await refundOrderAmount({
        order: refreshedOrder,
        reason:
          "Refund after confirmed provider cancellation"
      });

    if (!refundResult.success) {

      return res.status(500).json({
        success: false,
        message:
          "Provider cancellation confirmed, but refund could not be completed",
        refundError:
          refundResult.message,
        refunded: false,
        order:
          await populateOrder(refreshedOrder)
      });
    }

    const previousStatus =
      refreshedOrder.status;

    refreshedOrder.status =
      "refunded";

    refreshedOrder.providerError = null;

    await refreshedOrder.save();

    await createStatusLogSafe({
      orderId: refreshedOrder._id,
      previousStatus,
      newStatus: "refunded",
      source: "system",
      message:
        "Refund issued after confirmed provider cancellation"
    });

    return res.status(200).json({
      success: true,
      message:
        "Order canceled and refunded successfully",
      refunded: true,
      order:
        await populateOrder(refreshedOrder)
    });

  } catch (error) {

    console.error(
      "cancelOrder error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to cancel order",
      error: error.message
    });
  }
}


// ============================================================
// GET ALL ORDERS
// ============================================================

async function getAllOrders(req, res) {
  try {

    if (!isAdminOrStaff(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin or staff access required"
      });
    }

    const page =
      Math.max(
        Number.parseInt(req.query.page, 10) || 1,
        1
      );

    const limit =
      Math.min(
        Math.max(
          Number.parseInt(req.query.limit, 10) || 20,
          1
        ),
        100
      );

    const skip =
      (page - 1) * limit;

    const filter = {};

    if (req.query.status) {

      if (
        !ORDER_STATUSES.includes(
          req.query.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status"
        });
      }

      filter.status =
        req.query.status;
    }

    if (req.query.providerId) {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.query.providerId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid providerId"
        });
      }

      filter.providerId =
        req.query.providerId;
    }

    if (req.query.userId) {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.query.userId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid userId"
        });
      }

      filter.userId =
        req.query.userId;
    }

    const [orders, total] =
      await Promise.all([
        Order.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .populate(
            "userId",
            "name email"
          )
          .populate(
            "serviceId",
            "name category"
          )
          .populate(
            "providerId",
            "name"
          ),

        Order.countDocuments(filter)
      ]);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.ceil(total / limit)
      }
    });

  } catch (error) {

    console.error(
      "getAllOrders error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch orders",
      error: error.message
    });
  }
}


// ============================================================
// GET MY ORDERS
// ============================================================

async function getMyOrders(req, res) {
  try {

    const userId =
      req.user._id;

    const page =
      Math.max(
        Number.parseInt(req.query.page, 10) || 1,
        1
      );

    const limit =
      Math.min(
        Math.max(
          Number.parseInt(req.query.limit, 10) || 20,
          1
        ),
        100
      );

    const skip =
      (page - 1) * limit;

    const filter = {
      userId
    };

    if (req.query.status) {

      if (
        !ORDER_STATUSES.includes(
          req.query.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid order status"
        });
      }

      filter.status =
        req.query.status;
    }

    const [orders, total] =
      await Promise.all([
        Order.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .populate(
            "serviceId",
            "name category"
          )
          .populate(
            "providerId",
            "name"
          ),

        Order.countDocuments(filter)
      ]);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.ceil(total / limit)
      }
    });

  } catch (error) {

    console.error(
      "getMyOrders error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch your orders",
      error: error.message
    });
  }
}


// ============================================================
// GET ORDER BY ID
// ============================================================

async function getOrderById(req, res) {
  try {

    const { orderId } =
      req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        orderId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId"
      });
    }

    const order =
      await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const isOwner =
      order.userId.toString() ===
      req.user._id.toString();

    if (
      !isOwner &&
      !isAdminOrStaff(req.user)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    return res.status(200).json({
      success: true,
      order:
        await populateOrder(order)
    });

  } catch (error) {

    console.error(
      "getOrderById error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch order",
      error: error.message
    });
  }
}


// ============================================================
// GET ORDER STATUS LOGS
// ============================================================

async function getOrderStatusLogs(req, res) {
  try {

    const { orderId } =
      req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        orderId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId"
      });
    }

    const order =
      await Order.findById(orderId)
        .select("userId");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const isOwner =
      order.userId.toString() ===
      req.user._id.toString();

    if (
      !isOwner &&
      !isAdminOrStaff(req.user)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const logs =
      await OrderStatusLog.find({
        orderId
      }).sort({
        createdAt: 1
      });

    return res.status(200).json({
      success: true,
      data: logs
    });

  } catch (error) {

    console.error(
      "getOrderStatusLogs error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch order status logs",
      error: error.message
    });
  }
}


// ============================================================
// UPDATE ORDER STATUS - ADMIN / STAFF ONLY
// ============================================================

async function updateOrderStatus(req, res) {
  try {

    if (!isAdminOrStaff(req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Admin or staff access required"
      });
    }

    const { orderId } =
      req.params;

    const { status, message } =
      req.body;

    if (
      !mongoose.Types.ObjectId.isValid(
        orderId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId"
      });
    }

    if (
      !ORDER_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid order status"
      });
    }

    const order =
      await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const previousStatus =
      order.status;

    if (previousStatus === status) {
      return res.status(200).json({
        success: true,
        message:
          "Order already has this status",
        order:
          await populateOrder(order)
      });
    }

    const allowed =
      ALLOWED_STATUS_TRANSITIONS[
        previousStatus
      ];

    if (
      !allowed ||
      !allowed.has(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid status transition: ${previousStatus} -> ${status}`
      });
    }

    // --------------------------------------------------------
    // Refunded status requires actual refund transaction
    // --------------------------------------------------------

    if (status === "refunded") {

      const refundReference =
        generateRefundReference(
          order._id.toString()
        );

      const refundTransaction =
        await WalletTransaction.findOne({
          reference: refundReference,
          transactionType: "refund",
          status: "completed"
        });

      if (!refundTransaction) {
        return res.status(400).json({
          success: false,
          message:
            "Order cannot be manually marked refunded without a completed refund transaction"
        });
      }
    }

    order.status =
      status;

    await order.save();

    await createStatusLogSafe({
      orderId: order._id,
      previousStatus,
      newStatus: status,
      source: "admin",
      message:
        message ||
        `Order status changed from ${previousStatus} to ${status}`
    });

    return res.status(200).json({
      success: true,
      message:
        "Order status updated successfully",
      order:
        await populateOrder(order)
    });

  } catch (error) {

    console.error(
      "updateOrderStatus error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update order status",
      error: error.message
    });
  }
}


// ============================================================
// DELETE ORDER
// ============================================================

async function deleteOrder(req, res) {
  try {

    if (!isAdminOrStaff(req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Admin or staff access required"
      });
    }

    const { orderId } =
      req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        orderId
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId"
      });
    }

    const order =
      await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // --------------------------------------------------------
    // Never physically delete financially/provider-linked
    // orders.
    // --------------------------------------------------------

    if (
      order.walletTransactionId ||
      order.providerOrderId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This order cannot be physically deleted because it has wallet or provider records"
      });
    }

    await OrderStatusLog.deleteMany({
      orderId: order._id
    });

    await Order.deleteOne({
      _id: order._id
    });

    return res.status(200).json({
      success: true,
      message:
        "Order deleted successfully"
    });

  } catch (error) {

    console.error(
      "deleteOrder error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete order",
      error: error.message
    });
  }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createOrder,
  syncOrderProviderStatus,
  requestOrderRefill,
  cancelOrder,
  getAllOrders,
  getMyOrders,
  getOrderById,
  getOrderStatusLogs,
  updateOrderStatus,
  deleteOrder
};