const mongoose = require("mongoose");

const Order = require("../models/Order");

const Service = require("../models/Service");
const Provider = require("../models/Provider");
const OrderStatusLog = require("../models/OrderStatusLog");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const User = require("../models/User");
const Reseller = require("../models/Reseller");
const DripFeedRun = require("../models/DripFeedRun");
const Referral = require("../models/Referral");
const Affiliate = require("../models/Affiliate");

const {
  validateCoupon,
  recordCouponUsage,
  revertCouponUsage,
} = require("../services/couponService");

const affiliateService = require("../services/affiliateService");

const dripFeedQueue = require("../queues/dripFeedQueue");

const {
  syncOrderProviderStatus: syncProviderStatus,
} = require("../services/providerStatusService");

const {
  createProviderOrder,
  cancelProviderOrder,
  refillProviderOrder,
} = require("../services/providerApiService");

// ============================================================
// CONSTANTS
// ============================================================

const ORDER_STATUSES = [
  "pending",
  "processing",
  "in_progress",
  "completed",
  "partial",
  "canceled",
  "refunded",
  "failed",
];

const CANCELLABLE_STATUSES = new Set([
  "pending",
  "processing",
  "in_progress",
]);

const ALLOWED_STATUS_TRANSITIONS = {
  pending: new Set(["processing", "in_progress", "canceled", "failed"]),
  processing: new Set([
    "in_progress",
    "completed",
    "partial",
    "canceled",
    "failed",
  ]),
  in_progress: new Set(["completed", "partial", "canceled", "failed"]),
  completed: new Set(["refunded"]),
  partial: new Set(["completed", "refunded"]),
  canceled: new Set(["refunded"]),
  failed: new Set(["refunded"]),
  refunded: new Set([]),
};

// Generic message returned to clients when a provider rejects an order.
// The real provider message is kept in order.providerError (server side only).
const GENERIC_PROVIDER_FAILURE_MESSAGE =
  "The order could not be processed. Please try again later.";

// Order fields that normal users must never receive.
const CLIENT_HIDDEN_ORDER_FIELDS = [
  "providerResponse",
  "providerError",
  "providerOrderId",
  "providerId",
  "walletId",
  "walletTransactionId",
];

// Same list, as a Mongoose "select" string for list endpoints.
const CLIENT_ORDER_EXCLUDE_SELECT = CLIENT_HIDDEN_ORDER_FIELDS.map(
  (field) => `-${field}`,
).join(" ");

// ============================================================
// DRIP FEED CONSTANTS
// ============================================================

const MAX_DRIP_FEED_RUNS = 1000;
const MAX_DRIP_FEED_INTERVAL = 7 * 24 * 60;

// ============================================================
// LINK VALIDATION
// ============================================================

const MAX_LINK_LENGTH = 2048;

function validateLink(link) {
  if (typeof link !== "string" || !link.trim()) {
    return { ok: false, message: "Link is required" };
  }

  const trimmed = link.trim();

  if (trimmed.length > MAX_LINK_LENGTH) {
    return { ok: false, message: "Link is too long" };
  }

  let url;

  try {
    url = new URL(trimmed);
  } catch (error) {
    return { ok: false, message: "Invalid link format" };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false, message: "Invalid link format" };
  }

  // Reject hosts without a dot such as "http://abc" or "http://localhost"
  if (!url.hostname.includes(".")) {
    return { ok: false, message: "Invalid link format" };
  }

  return { ok: true, link: trimmed };
}

// ============================================================
// BASIC HELPERS
// ============================================================

function generateOrderReference() {
  return `ORD-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;
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

function isDuplicateKeyError(error) {
  return error && error.code === 11000;
}

function isAdminOrStaff(user) {
  return Boolean(user && ["admin", "staff"].includes(user.role));
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

// ============================================================
// PROVIDER ERROR STATUS
// ============================================================

function getProviderErrorStatusCode(error) {
  const possibleStatuses = [
    error?.statusCode,
    error?.status,
    error?.httpStatus,
    error?.response?.status,
    error?.response?.statusCode,
    error?.data?.statusCode,
    error?.data?.status,
  ];

  for (const value of possibleStatuses) {
    const numericValue = Number(value);

    if (
      Number.isInteger(numericValue) &&
      numericValue >= 100 &&
      numericValue <= 599
    ) {
      return numericValue;
    }
  }

  return null;
}

// ============================================================
// DEFINITE PROVIDER FAILURE
// ============================================================

function isDefiniteProviderFailure(error) {
  if (!error) {
    return false;
  }

  if (error.retryable === false) {
    return true;
  }

  const statusCode = getProviderErrorStatusCode(error);

  if (
    statusCode &&
    statusCode >= 400 &&
    statusCode < 500 &&
    ![408, 429].includes(statusCode)
  ) {
    return true;
  }

  return false;
}

// ============================================================
// PROVIDER
// ============================================================

async function findActiveProviderWithKey(providerId) {
  if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
    return null;
  }

  return Provider.findOne({
    _id: providerId,
    status: "active",
  }).select("+apiKey");
}

// ============================================================
// PROVIDER SELECTION / PRIORITY / FALLBACK
// ============================================================

async function findProviderCandidates(service) {
  if (!service || !service.providerServiceId) {
    return [];
  }

  const mappedServices = await Service.find({
    providerServiceId: service.providerServiceId,
    status: "active",
    providerId: { $ne: null },
  }).select("providerId");

  const providerIds = [];

  if (service.providerId) {
    providerIds.push(service.providerId.toString());
  }

  for (const mappedService of mappedServices) {
    if (!mappedService.providerId) {
      continue;
    }

    const providerId = mappedService.providerId.toString();

    if (!providerIds.includes(providerId)) {
      providerIds.push(providerId);
    }
  }

  if (!providerIds.length) {
    return [];
  }

  const providers = await Provider.find({
    _id: { $in: providerIds },
    status: "active",
  })
    .select("+apiKey")
    .sort({
      priority: 1,
      sortOrder: 1,
      createdAt: 1,
    });

  const providerMap = new Map(
    providers.map((provider) => [provider._id.toString(), provider]),
  );

  const orderedProviders = [];

  for (const providerId of providerIds) {
    const provider = providerMap.get(providerId);

    if (provider) {
      orderedProviders.push(provider);
    }
  }

  orderedProviders.sort((a, b) => {
    const priorityA = Number.isFinite(Number(a.priority))
      ? Number(a.priority)
      : 1;

    const priorityB = Number.isFinite(Number(b.priority))
      ? Number(b.priority)
      : 1;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const sortA = Number.isFinite(Number(a.sortOrder))
      ? Number(a.sortOrder)
      : 0;

    const sortB = Number.isFinite(Number(b.sortOrder))
      ? Number(b.sortOrder)
      : 0;

    if (sortA !== sortB) {
      return sortA - sortB;
    }

    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  return orderedProviders;
}

// ============================================================
// STATUS LOG
// ============================================================

async function createStatusLogSafe({
  orderId,
  previousStatus = null,
  newStatus,
  source = "system",
  message = "",
  providerResponse = null,
}) {
  try {
    await OrderStatusLog.create({
      orderId,
      previousStatus,
      newStatus,
      source,
      message,
      providerResponse,
    });
  } catch (error) {
    console.error("OrderStatusLog creation failed:", error.message);
  }
}

// ============================================================
// AFFILIATE COMMISSION (best-effort, non-blocking)
// ============================================================
//
// Awards commission to the referring affiliate when a normal
// (non-reseller) customer order successfully captures payment
// and is confirmed with the provider (or, for Drip Feed, is
// confirmed scheduled). This is intentionally best-effort:
// a failure here is logged but never fails the order response,
// since the customer's order has already succeeded by the time
// this runs.
//
// NOTE: this does not currently reverse commission if the order
// is later refunded/canceled. That requires a revertCommission()
// counterpart in affiliateService.js (mirroring revertCouponUsage)
// — flagged for a follow-up change once this integration point
// is confirmed.
// ============================================================

async function awardAffiliateCommissionForOrder(order) {
  try {
    if (!order || !order._id || !order.userId) {
      return;
    }

    // Reseller-originated orders are not eligible for affiliate
    // commission through this path; reseller economics are
    // handled separately.
    if (order.resellerId) {
      return;
    }

    const referral = await Referral.findOne({
      referredUserId: order.userId,
      status: "active",
    });

    if (!referral) {
      return;
    }

    const affiliate = await Affiliate.findOne({
      user: referral.referrerId,
    });

    if (!affiliate || !affiliate.isActive) {
      return;
    }

    const orderAmount = Number(order.originalCharge ?? order.charge);

    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      return;
    }

    await affiliateService.addCommission({
      affiliateId: affiliate._id,
      orderAmount,
      orderId: order._id.toString(),
    });
  } catch (error) {
    console.error("awardAffiliateCommissionForOrder error:", error.message);
  }
}

// ============================================================
// POPULATE ORDER
// ============================================================
//
// privileged = true  -> admin / staff view (full internal data)
// privileged = false -> normal user / reseller view (default).
//                       No balance/role/status of the user, no provider
//                       details, no provider responses/errors, no wallet ids.
// ============================================================

async function populateOrder(order, { privileged = false } = {}) {
  if (!order) {
    return null;
  }

  let query = Order.findById(order._id).populate(
    "couponId",
    "code description discountType discountValue",
  );

  if (privileged) {
    query = query
      .populate("userId", "name email balance role status")
      .populate(
        "serviceId",
        "name category sellingPrice providerServiceId",
      )
      .populate("providerId", "name status priority")
      .populate(
        "resellerId",
        "resellerCode markupType markupValue status apiEnabled",
      );
  } else {
    query = query
      .populate("userId", "name email")
      .populate("serviceId", "name category sellingPrice")
      .populate("resellerId", "resellerCode");
  }

  const populated = await query;

  if (!populated) {
    return null;
  }

  // toJSON() keeps any schema-level JSON transforms.
  const plain = populated.toJSON();

  if (!privileged) {
    for (const field of CLIENT_HIDDEN_ORDER_FIELDS) {
      delete plain[field];
    }
  }

  return plain;
}

// ============================================================
// USER BALANCE SYNC
// ============================================================
//
// Copies Wallet.balance into User.balance.
//
// session = null  -> best-effort. Errors are logged and swallowed
//                    (used by order creation, where the wallet is
//                    already the source of truth).
// session = given -> runs INSIDE the caller's transaction. Errors are
//                    re-thrown so the whole transaction rolls back
//                    instead of leaving Wallet and User out of sync.
// ============================================================

async function syncUserBalanceFromWallet(userId, walletId, session = null) {
  try {
    const walletQuery = Wallet.findById(walletId).select("balance");

    if (session) {
      walletQuery.session(session);
    }

    const wallet = await walletQuery;

    if (!wallet) {
      if (session) {
        throw new Error("Wallet not found during user balance sync");
      }

      return null;
    }

    const options = session ? { session } : {};

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { balance: roundMoney(wallet.balance) } },
      { ...options, new: true },
    );

    if (!updatedUser && session) {
      throw new Error("User not found during wallet balance sync");
    }

    return roundMoney(wallet.balance);
  } catch (error) {
    if (session) {
      throw error;
    }

    console.error("User balance sync failed:", error.message);

    return null;
  }
}

// ============================================================
// RESELLER PRICE
// ============================================================

function calculateResellerPrice({ basePrice, markupType, markupValue }) {
  const cleanBasePrice = Number(basePrice);
  const cleanMarkupValue = Number(markupValue);

  if (!Number.isFinite(cleanBasePrice) || cleanBasePrice < 0) {
    throw new Error("Invalid base price");
  }

  if (!["percentage", "fixed"].includes(markupType)) {
    throw new Error("Invalid reseller markup type");
  }

  if (!Number.isFinite(cleanMarkupValue) || cleanMarkupValue < 0) {
    throw new Error("Invalid reseller markup value");
  }

  if (markupType === "percentage" && cleanMarkupValue > 100) {
    throw new Error("Reseller percentage markup cannot exceed 100");
  }

  let finalPrice;

  if (markupType === "percentage") {
    finalPrice = cleanBasePrice + (cleanBasePrice * cleanMarkupValue) / 100;
  } else {
    finalPrice = cleanBasePrice + cleanMarkupValue;
  }

  return roundMoney(finalPrice);
}

// ============================================================
// REFUND (MONGODB TRANSACTION)
// ============================================================
//
// Every refund runs inside ONE MongoDB transaction:
//
//   Normal user : Wallet credit + WalletTransaction ledger entry
//                 + User.balance sync
//   Reseller    : Order.resellerRefundedAt claim + Reseller credit
//
// If any step fails the whole transaction is rolled back, so no
// manual "$inc: -amount" compensation is needed anymore.
//
// IDEMPOTENCY
// -----------
//   Normal user : partial unique index "unique_refund_reference"
//                 ({ reference, transactionType }, only for
//                 transactionType "refund") on WalletTransaction.
//                 A duplicate refund hits the index, the transaction
//                 aborts (nothing credited) and the function returns
//                 alreadyRefunded: true ONLY if the existing refund
//                 record is found; otherwise it reports failure.
//   Reseller    : atomic claim on Order.resellerRefundedAt
//                 (null -> Date). Only the request that wins the
//                 claim credits the reseller.
//
// REQUIRES
//   - MongoDB replica set (Atlas works; a standalone mongod does not)
//   - `resellerRefundedAt: { type: Date, default: null }` in
//     models/Order.js
//
// An existing session can be passed as `session` to join a caller's
// transaction. In that case the caller owns commit / abort, and any
// refund error is THROWN to the caller (not returned as a result object)
// so the caller can abort its transaction. When this function owns the
// session it never throws; it returns { success, ... } instead.
// ============================================================

// Thrown inside the transaction to abort it with a controlled result.
class RefundAbort extends Error {
  constructor(result) {
    super(result.message || "Refund aborted");
    this.refundResult = result;
  }
}

async function refundOrderAmount({ order, session: externalSession = null }) {
  const amount = roundMoney(order.charge);

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      success: false,
      message: "Invalid refund amount",
    };
  }

  const ownsSession = !externalSession;
  let session = externalSession;

  try {
    if (ownsSession) {
      session = await mongoose.startSession();
    }
  } catch (sessionError) {
    console.error("Refund session could not be started:", sessionError.message);

    return {
      success: false,
      message: "Refund could not be completed safely",
    };
  }

  const performRefund = async () => {
    // ========================================================
    // RESELLER REFUND
    // ========================================================

    if (order.resellerId) {
      const claim = await Order.findOneAndUpdate(
        { _id: order._id, resellerRefundedAt: null },
        { $set: { resellerRefundedAt: new Date() } },
        { new: true, session },
      );

      if (!claim) {
        // The claim can miss for reasons other than "already refunded"
        // (order deleted, field missing), so verify before reporting success.
        const existingOrder = await Order.findById(order._id)
          .select("resellerRefundedAt")
          .session(session);

        if (!existingOrder) {
          throw new RefundAbort({
            success: false,
            message: "Order not found for reseller refund",
          });
        }

        if (existingOrder.resellerRefundedAt) {
          // Confirmed: already refunded earlier - never credit twice.
          return {
            success: true,
            alreadyRefunded: true,
          };
        }

        console.error(
          "Reseller refund claim failed unexpectedly for order",
          order._id.toString(),
        );

        throw new RefundAbort({
          success: false,
          message: "Reseller refund claim could not be verified",
        });
      }

      if (!claim.resellerRefundedAt) {
        // Schema does not contain the field, so the claim was not persisted.
        console.error(
          "Reseller refund blocked: Order schema is missing resellerRefundedAt",
        );

        throw new RefundAbort({
          success: false,
          message: "Reseller refund protection is not configured",
        });
      }

      const updatedReseller = await Reseller.findOneAndUpdate(
        { _id: order.resellerId },
        { $inc: { balance: amount } },
        { new: true, session },
      );

      if (!updatedReseller) {
        // Throwing aborts the transaction, which also undoes the claim.
        throw new RefundAbort({
          success: false,
          message: "Unable to credit reseller balance",
        });
      }

      return {
        success: true,
        alreadyRefunded: false,
        reseller: updatedReseller,
      };
    }

    // ========================================================
    // NORMAL USER WALLET REFUND
    // ========================================================

    const refundReference = generateRefundReference(order._id.toString());

    const existingRefund = await WalletTransaction.findOne({
      reference: refundReference,
      transactionType: "refund",
    }).session(session);

    if (existingRefund) {
      return {
        success: true,
        alreadyRefunded: true,
        transaction: existingRefund,
      };
    }

    let wallet = null;

    if (order.walletId) {
      wallet = await Wallet.findOne({
        _id: order.walletId,
        userId: order.userId,
      }).session(session);
    }

    if (!wallet) {
      wallet = await Wallet.findOne({ userId: order.userId }).session(session);
    }

    if (!wallet) {
      throw new RefundAbort({
        success: false,
        message: "Wallet not found for refund",
      });
    }

    const updatedWallet = await Wallet.findOneAndUpdate(
      { _id: wallet._id },
      { $inc: { balance: amount } },
      { new: true, session },
    );

    if (!updatedWallet) {
      throw new RefundAbort({
        success: false,
        message: "Unable to credit wallet",
      });
    }

    // Derived from the atomic update result, not from an earlier read,
    // so concurrent balance changes cannot make these values wrong.
    const balanceAfter = roundMoney(updatedWallet.balance);
    const balanceBefore = roundMoney(balanceAfter - amount);

    const [refundTransaction] = await WalletTransaction.create(
      [
        {
          userId: order.userId,
          walletId: wallet._id,
          transactionType: "refund",
          reference: refundReference,
          amount,
          balanceBefore,
          balanceAfter,
          status: "completed",
        },
      ],
      { session },
    );

    await syncUserBalanceFromWallet(order.userId, wallet._id, session);

    return {
      success: true,
      alreadyRefunded: false,
      transaction: refundTransaction,
    };
  };

  try {
    let result;

    if (ownsSession) {
      // withTransaction commits on success, aborts on error, and
      // automatically retries on transient transaction errors.
      await session.withTransaction(async () => {
        result = await performRefund();
      });
    } else {
      result = await performRefund();
    }

    return result;
  } catch (error) {
    // Caller-owned transaction: never swallow the error. The caller must
    // see it so it can abort its own transaction instead of committing
    // a half-finished refund.
    if (!ownsSession) {
      throw error;
    }

    if (error instanceof RefundAbort) {
      return error.refundResult;
    }

    // Duplicate ledger entry: the transaction is already rolled back,
    // so nothing was credited. Report the existing refund.
    if (isDuplicateKeyError(error) && !order.resellerId) {
      try {
        const existing = await WalletTransaction.findOne({
          reference: generateRefundReference(order._id.toString()),
          transactionType: "refund",
        });

        if (existing) {
          return {
            success: true,
            alreadyRefunded: true,
            transaction: existing,
          };
        }

        console.error(
          "Refund duplicate-key error but no existing refund was found:",
          order._id.toString(),
        );

        return {
          success: false,
          message: "Refund could not be verified safely",
        };
      } catch (lookupError) {
        console.error(
          "Refund duplicate lookup failed:",
          lookupError.message,
        );
      }
    }

    console.error("Refund transaction failed:", error.message);

    return {
      success: false,
      message: "Refund could not be completed safely",
    };
  } finally {
    if (ownsSession && session) {
      await session.endSession();
    }
  }
}

// ============================================================
// DRIP FEED VALIDATION
// ============================================================

function validateDripFeedInput({ dripFeed, quantity, runs, interval }) {
  if (!dripFeed) {
    return {
      valid: true,
      runs: null,
      interval: null,
    };
  }

  if (runs === undefined || runs === null || runs === "") {
    return {
      valid: false,
      message: "runs is required when dripFeed is enabled",
    };
  }

  if (interval === undefined || interval === null || interval === "") {
    return {
      valid: false,
      message: "interval is required when dripFeed is enabled",
    };
  }

  const parsedRuns = parseQuantity(runs);
  const parsedInterval = Number(interval);

  if (!parsedRuns || parsedRuns < 1) {
    return {
      valid: false,
      message: "runs must be a positive integer",
    };
  }

  if (parsedRuns > MAX_DRIP_FEED_RUNS) {
    return {
      valid: false,
      message: `runs cannot exceed ${MAX_DRIP_FEED_RUNS}`,
    };
  }

  if (parsedRuns > quantity) {
    return {
      valid: false,
      message: "runs cannot be greater than total quantity",
    };
  }

  if (!Number.isFinite(parsedInterval) || parsedInterval < 1) {
    return {
      valid: false,
      message: "interval must be at least 1 minute",
    };
  }

  if (parsedInterval > MAX_DRIP_FEED_INTERVAL) {
    return {
      valid: false,
      message: `interval cannot exceed ${MAX_DRIP_FEED_INTERVAL} minutes`,
    };
  }

  return {
    valid: true,
    runs: parsedRuns,
    interval: parsedInterval,
  };
}

// ============================================================
// SPLIT DRIP FEED
// ============================================================

function splitQuantityAcrossRuns(quantity, runs) {
  const baseQuantity = Math.floor(quantity / runs);
  const remainder = quantity % runs;
  const quantities = [];

  for (let index = 1; index <= runs; index++) {
    const runQuantity = baseQuantity + (index <= remainder ? 1 : 0);

    quantities.push(runQuantity);
  }

  return quantities;
}

// ============================================================
// SCHEDULE DRIP FEED
// ============================================================

async function createAndScheduleDripFeedRuns({
  order,
  userId,
  quantity,
  runs,
  interval,
}) {
  if (!order || !order._id) {
    throw new Error("Order is required for Drip Feed scheduling");
  }

  const validation = validateDripFeedInput({
    dripFeed: true,
    quantity,
    runs,
    interval,
  });

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const parsedRuns = validation.runs;
  const parsedInterval = validation.interval;
  const quantities = splitQuantityAcrossRuns(quantity, parsedRuns);

  const createdRuns = [];
  const queuedJobs = [];

  try {
    const now = new Date();

    for (let runNumber = 1; runNumber <= parsedRuns; runNumber++) {
      const scheduledAt = new Date(
        now.getTime() + (runNumber - 1) * parsedInterval * 60 * 1000,
      );

      const run = await DripFeedRun.create({
        orderId: order._id,
        userId,
        runNumber,
        quantity: quantities[runNumber - 1],
        status: "pending",
        scheduledAt,
        startedAt: null,
        completedAt: null,
        providerOrderId: null,
        providerResponse: null,
        error: null,
      });

      createdRuns.push(run);
    }

    for (const run of createdRuns) {
      const delay = Math.max(
        0,
        new Date(run.scheduledAt).getTime() - Date.now(),
      );

      const jobId = `drip-feed:${order._id.toString()}:${run.runNumber}`;

      const job = await dripFeedQueue.add(
        "process-drip-feed-run",
        {
          orderId: order._id.toString(),
          runId: run._id.toString(),
          userId: userId.toString(),
          runNumber: run.runNumber,
          quantity: run.quantity,
        },
        {
          jobId,
          delay,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      queuedJobs.push(job);
    }

    return {
      success: true,
      runs: createdRuns,
      queuedJobs,
      totalRuns: parsedRuns,
      totalQuantity: quantity,
      interval: parsedInterval,
    };
  } catch (error) {
    console.error("Drip Feed scheduling failed:", error.message);

    for (const job of queuedJobs) {
      try {
        await job.remove();
      } catch (removeError) {
        console.error("Failed to remove Drip Feed job:", removeError.message);
      }
    }

    if (createdRuns.length) {
      try {
        await DripFeedRun.deleteMany({
          _id: { $in: createdRuns.map((run) => run._id) },
        });
      } catch (deleteError) {
        console.error(
          "Failed to cleanup DripFeedRun records:",
          deleteError.message,
        );
      }
    }

    throw error;
  }
}

// ============================================================
// CANCEL DRIP FEED RUNS
// ============================================================

async function cancelPendingDripFeedRuns(orderId) {
  try {
    const pendingRuns = await DripFeedRun.find({
      orderId,
      status: "pending",
    });

    for (const run of pendingRuns) {
      const jobId = `drip-feed:${orderId.toString()}:${run.runNumber}`;

      try {
        const job = await dripFeedQueue.getJob(jobId);

        if (job) {
          await job.remove();
        }
      } catch (jobError) {
        console.error(
          `Failed to remove Drip Feed job ${jobId}:`,
          jobError.message,
        );
      }

      run.status = "canceled";
      run.error = "Canceled with parent order";

      await run.save();
    }

    return true;
  } catch (error) {
    console.error("cancelPendingDripFeedRuns error:", error.message);

    return false;
  }
}

// ============================================================
// NORMAL ORDER
// ============================================================

async function createOrder(req, res) {
  let wallet = null;
  let walletTransaction = null;
  let charge = 0;
  let walletDebitCompleted = false;
  // Set to true right before the first provider call. Once the
  // provider may have received the order, the outer catch must never
  // automatically credit the wallet back.
  let providerSubmissionStarted = false;

  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status && user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "User account is inactive",
      });
    }

    const body = req.body || {};

    const serviceId = body.serviceId;
    const link = body.link;
    const quantityInput = body.quantity;
    const idempotencyKey = body.idempotencyKey;

    const dripFeed = body.dripFeed === true || body.dripFeed === "true";

    const note = body.note || "";

    const couponCode =
      typeof body.couponCode === "string" ? body.couponCode.trim() : "";

    const runs = body.runs;
    const interval = body.interval;

    if (typeof serviceId !== "string" || !serviceId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid serviceId",
      });
    }

    const cleanServiceId = serviceId.trim();

    // Link validation (runs before any wallet, coupon or provider logic)
    const linkCheck = validateLink(link);

    if (!linkCheck.ok) {
      return res.status(400).json({
        success: false,
        message: linkCheck.message,
      });
    }

    const cleanLink = linkCheck.link;

    const quantity = parseQuantity(quantityInput);

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than zero",
      });
    }

    const dripFeedValidation = validateDripFeedInput({
      dripFeed,
      quantity,
      runs,
      interval,
    });

    if (!dripFeedValidation.valid) {
      return res.status(400).json({
        success: false,
        message: dripFeedValidation.message,
      });
    }

    const validatedRuns = dripFeedValidation.runs;
    const validatedInterval = dripFeedValidation.interval;

    let cleanIdempotencyKey;

    if (idempotencyKey !== undefined && idempotencyKey !== null) {
      cleanIdempotencyKey = String(idempotencyKey).trim();

      if (!cleanIdempotencyKey) {
        return res.status(400).json({
          success: false,
          message: "Invalid idempotencyKey",
        });
      }
    }

    if (cleanIdempotencyKey) {
      const existingOrder = await Order.findOne({
        userId,
        idempotencyKey: cleanIdempotencyKey,
      });

      if (existingOrder) {
        return res.status(200).json({
          success: true,
          message: "Existing order returned",
          idempotent: true,
          order: await populateOrder(existingOrder),
        });
      }
    }

    const service = await Service.findOne({
      serviceId: cleanServiceId,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    if (service.status && service.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Service is inactive",
      });
    }

    if (service.min !== undefined && quantity < Number(service.min)) {
      return res.status(400).json({
        success: false,
        message: `Minimum quantity is ${service.min}`,
      });
    }

    if (service.max !== undefined && quantity > Number(service.max)) {
      return res.status(400).json({
        success: false,
        message: `Maximum quantity is ${service.max}`,
      });
    }

    const servicePrice = Number(service.sellingPrice ?? service.price ?? 0);

    const rateQuantity = Number(service.rateQuantity || 1000);

    if (!Number.isFinite(servicePrice) || servicePrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid service price",
      });
    }

    if (!Number.isFinite(rateQuantity) || rateQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid service rate quantity",
      });
    }

    const originalCharge = roundMoney((servicePrice / rateQuantity) * quantity);

    charge = originalCharge;

    let appliedCoupon = null;
    let discountAmount = 0;

    if (couponCode) {
      try {
        const couponResult = await validateCoupon({
          code: couponCode,
          userId,
          orderAmount: originalCharge,
        });

        appliedCoupon = couponResult.coupon;

        discountAmount = roundMoney(couponResult.discountAmount);

        charge = roundMoney(couponResult.finalAmount);
      } catch (couponError) {
        return res.status(400).json({
          success: false,
          message: couponError.message,
        });
      }
    }

    if (!service.providerServiceId) {
      return res.status(400).json({
        success: false,
        message: "Provider service mapping is missing",
      });
    }

    const providerCandidates = await findProviderCandidates(service);

    if (!providerCandidates.length) {
      return res.status(400).json({
        success: false,
        message: "No active provider is configured for this service",
      });
    }

    const usableProviders = providerCandidates.filter((provider) => {
      const hasApiKey = Boolean(provider.apiKey);

      const providerUrl = provider.apiUrl || provider.baseUrl || provider.url;

      return hasApiKey && Boolean(providerUrl);
    });

    if (!usableProviders.length) {
      const missingKey = providerCandidates.some((provider) => !provider.apiKey);

      if (missingKey) {
        return res.status(400).json({
          success: false,
          message: "Provider API key is missing",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Provider API URL is missing",
      });
    }

    wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
      });
    }

    const balanceBefore = roundMoney(wallet.balance);

    const updatedWallet = await Wallet.findOneAndUpdate(
      {
        _id: wallet._id,
        userId,
        balance: { $gte: charge },
      },
      { $inc: { balance: -charge } },
      { new: true },
    );

    if (!updatedWallet) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    walletDebitCompleted = true;

    const balanceAfter = roundMoney(updatedWallet.balance);

    const orderReference = generateOrderReference();

    try {
      walletTransaction = await WalletTransaction.create({
        userId,
        walletId: wallet._id,
        transactionType: "debit",
        reference: orderReference,
        amount: charge,
        balanceBefore,
        balanceAfter,
        status: "completed",
      });
    } catch (transactionError) {
      await Wallet.findByIdAndUpdate(wallet._id, {
        $inc: { balance: charge },
      });

      walletDebitCompleted = false;

      await syncUserBalanceFromWallet(userId, wallet._id);

      throw transactionError;
    }

    await syncUserBalanceFromWallet(userId, wallet._id);

    const initialProvider = usableProviders[0];

    let order;

    try {
      order = await Order.create({
        userId,
        resellerId: null,
        serviceId: service._id,
        providerId: initialProvider._id,

        providerOrderId: null,
        providerResponse: null,
        providerError: null,
        providerSubmittedAt: null,

        idempotencyKey: cleanIdempotencyKey,

        walletTransactionId: walletTransaction._id,

        walletId: wallet._id,

        link: cleanLink,
        quantity,
        charge,

        couponId: appliedCoupon ? appliedCoupon._id : null,

        couponCode: appliedCoupon ? appliedCoupon.code : null,

        discountAmount,
        originalCharge,

        status: "pending",
        startCount: 0,
        remains: quantity,

        refill: Boolean(service.refill),
        refillId: null,
        cancel: Boolean(service.cancel),

        dripFeed: Boolean(dripFeed),
        note: typeof note === "string" ? note.trim() : "",

        runs: validatedRuns !== null ? validatedRuns : undefined,

        interval: validatedInterval !== null ? validatedInterval : undefined,
      });
    } catch (orderError) {
      if (isDuplicateKeyError(orderError) && cleanIdempotencyKey) {
        const existingOrder = await Order.findOne({
          userId,
          idempotencyKey: cleanIdempotencyKey,
        });

        if (existingOrder) {
          await Wallet.findByIdAndUpdate(wallet._id, {
            $inc: { balance: charge },
          });

          await WalletTransaction.findByIdAndUpdate(walletTransaction._id, {
            $set: { status: "reversed" },
          });

          walletDebitCompleted = false;

          await syncUserBalanceFromWallet(userId, wallet._id);

          return res.status(200).json({
            success: true,
            message: "Existing order returned",
            idempotent: true,
            order: await populateOrder(existingOrder),
          });
        }
      }

      await Wallet.findByIdAndUpdate(wallet._id, {
        $inc: { balance: charge },
      });

      await WalletTransaction.findByIdAndUpdate(walletTransaction._id, {
        $set: { status: "reversed" },
      });

      walletDebitCompleted = false;

      await syncUserBalanceFromWallet(userId, wallet._id);

      throw orderError;
    }

    if (appliedCoupon) {
      try {
        await recordCouponUsage({
          couponId: appliedCoupon._id,
          userId,
          orderId: order._id,
          discountAmount,
          orderAmount: originalCharge,
        });
      } catch (couponUsageError) {
        const previousStatus = order.status;

        order.status = "failed";

        order.providerError = `Coupon usage recording failed: ${couponUsageError.message}`;

        await order.save();

        await createStatusLogSafe({
          orderId: order._id,
          previousStatus,
          newStatus: "failed",
          source: "system",
          message: order.providerError,
        });

        // recordCouponUsage may have created the CouponUsage doc
        // before failing on the Coupon.usageCount update (or the
        // reverse) — always attempt cleanup rather than assume
        // nothing was written.
        await revertCouponUsage(order._id);

        const refundResult = await refundOrderAmount({ order });

        if (refundResult.success) {
          const failedStatus = order.status;

          order.status = "refunded";

          await order.save();

          await createStatusLogSafe({
            orderId: order._id,
            previousStatus: failedStatus,
            newStatus: "refunded",
            source: "system",
            message:
              "Customer refunded because coupon usage could not be recorded",
          });

          walletDebitCompleted = false;

          return res.status(500).json({
            success: false,
            message:
              "Coupon usage could not be recorded. Customer has been refunded.",
            refunded: true,
            order: await populateOrder(order),
          });
        }

        return res.status(500).json({
          success: false,
          message:
            "Coupon usage could not be recorded and refund could not be completed safely",
          refunded: false,
          refundError: refundResult.message,
          order: await populateOrder(order),
        });
      }
    }

    await createStatusLogSafe({
      orderId: order._id,
      previousStatus: null,
      newStatus: "pending",
      source: "system",
      message: dripFeed ? "Drip Feed order created" : "Order created",
    });

    if (dripFeed) {
      try {
        const dripFeedResult = await createAndScheduleDripFeedRuns({
          order,
          userId,
          quantity,
          runs: validatedRuns,
          interval: validatedInterval,
        });

        order.providerResponse = {
          type: "drip_feed",
          scheduled: true,
          totalRuns: dripFeedResult.totalRuns,
          totalQuantity: dripFeedResult.totalQuantity,
          intervalMinutes: dripFeedResult.interval,
        };

        order.providerError = null;

        await order.save();

        // Payment is captured and the Drip Feed is confirmed
        // scheduled — safe to award affiliate commission here.
        await awardAffiliateCommissionForOrder(order);

        return res.status(201).json({
          success: true,
          message: "Drip Feed order created and scheduled successfully",
          dripFeed: true,
          runs: dripFeedResult.totalRuns,
          interval: dripFeedResult.interval,
          order: await populateOrder(order),
        });
      } catch (dripFeedError) {
        const previousStatus = order.status;

        order.status = "failed";
        order.providerError = `Drip Feed scheduling failed: ${dripFeedError.message}`;

        await order.save();

        await createStatusLogSafe({
          orderId: order._id,
          previousStatus,
          newStatus: "failed",
          source: "system",
          message: order.providerError,
        });

        if (appliedCoupon) {
          await revertCouponUsage(order._id);
        }

        const refundResult = await refundOrderAmount({ order });

        if (refundResult.success) {
          const failedStatus = order.status;

          order.status = "refunded";

          await order.save();

          await createStatusLogSafe({
            orderId: order._id,
            previousStatus: failedStatus,
            newStatus: "refunded",
            source: "system",
            message: "Customer refunded because Drip Feed scheduling failed",
          });

          walletDebitCompleted = false;

          return res.status(500).json({
            success: false,
            message: "Drip Feed scheduling failed. Customer has been refunded.",
            refunded: true,
            order: await populateOrder(order),
          });
        }

        return res.status(500).json({
          success: false,
          message:
            "Drip Feed scheduling failed and refund could not be completed safely",
          refunded: false,
          refundError: refundResult.message,
          order: await populateOrder(order),
        });
      }
    }

    let providerResult = null;
    let selectedProvider = null;
    let lastProviderError = null;
    const attemptedProviders = [];
    let providerOutcomeUncertain = false;

    for (
      let providerIndex = 0;
      providerIndex < usableProviders.length;
      providerIndex++
    ) {
      const provider = usableProviders[providerIndex];

      const providerId = provider._id.toString();

      const providerPriority = Number(provider.priority || 1);

      attemptedProviders.push(providerId);

      if (!order.providerId || order.providerId.toString() !== providerId) {
        order.providerId = provider._id;

        await order.save();
      }

      try {
        // Provider may receive the order from this point onward.
        providerSubmissionStarted = true;

        providerResult = await createProviderOrder({
          provider,
          orderId: order._id,
          service: service.providerServiceId,
          link: cleanLink,
          quantity,
          runs: undefined,
          interval: undefined,
        });

        if (providerResult && providerResult.success !== false) {
          selectedProvider = provider;

          break;
        }

        const providerMessage =
          providerResult?.message || "Provider request failed";

        const retryable = providerResult?.retryable === true;

        lastProviderError = new Error(providerMessage);

        lastProviderError.retryable = retryable;

        if (retryable && providerIndex < usableProviders.length - 1) {
          continue;
        }

        break;
      } catch (providerError) {
        lastProviderError = providerError;

        const isRetryable = providerError?.retryable === true;

        const isDefiniteFailure = isDefiniteProviderFailure(providerError);

        if (isRetryable && providerIndex < usableProviders.length - 1) {
          await createStatusLogSafe({
            orderId: order._id,
            previousStatus: "pending",
            newStatus: "pending",
            source: "provider",
            message: `Provider "${provider.name}" exhausted retry attempts. Falling back to next priority provider.`,
            providerResponse: {
              provider: provider.name,
              providerId: provider._id,
              priority: providerPriority,
              retryable: true,
              error: providerError.message,
            },
          });

          continue;
        }

        if (isDefiniteFailure) {
          break;
        }

        providerOutcomeUncertain = true;

        break;
      }
    }

    if (
      selectedProvider &&
      providerResult &&
      providerResult.success !== false
    ) {
      order.providerId = selectedProvider._id;

      const providerOrderId = providerResult.providerOrderId;

      if (!providerOrderId) {
        order.providerError = "Provider response did not contain an order ID";

        order.providerResponse = providerResult.providerResponse || null;

        await order.save();

        return res.status(202).json({
          success: true,
          message:
            "Order created but provider order ID was not returned. Order remains pending for reconciliation.",
          order: await populateOrder(order),
        });
      }

      const previousStatus = order.status;

      order.providerOrderId = String(providerOrderId);

      order.providerResponse = providerResult.providerResponse || null;

      order.providerError = null;
      order.providerSubmittedAt = new Date();

      order.status = "processing";

      await order.save();

      await createStatusLogSafe({
        orderId: order._id,
        previousStatus,
        newStatus: "processing",
        source: "provider",
        message: `Order successfully submitted to provider "${selectedProvider.name}" with priority ${selectedProvider.priority || 1}`,
        providerResponse: providerResult.providerResponse || null,
      });

      // Payment captured and provider order confirmed —
      // safe to award affiliate commission here.
      await awardAffiliateCommissionForOrder(order);

      return res.status(201).json({
        success: true,
        message: "Order created successfully",
        order: await populateOrder(order),
      });
    }

    const finalProviderMessage =
      lastProviderError?.message ||
      providerResult?.message ||
      "Provider request failed";

    const finalRetryable =
      lastProviderError?.retryable === true ||
      providerResult?.retryable === true;

    if (!providerResult && !lastProviderError) {
      providerOutcomeUncertain = true;
    }

    if (finalRetryable || providerOutcomeUncertain) {
      order.providerError = finalProviderMessage;

      order.providerResponse = providerResult?.providerResponse || {
        error: finalProviderMessage,
        retryable: finalRetryable,
        attemptedProviders,
      };

      await order.save();

      // attemptedProviders (internal provider ids) is NOT returned to clients.
      return res.status(202).json({
        success: true,
        message:
          "Order created but all provider attempts are uncertain. It remains pending for reconciliation.",
        order: await populateOrder(order),
      });
    }

    const previousStatus = order.status;

    order.status = "failed";

    order.providerError = finalProviderMessage;

    order.providerResponse = providerResult?.providerResponse || null;

    await order.save();

    await createStatusLogSafe({
      orderId: order._id,
      previousStatus,
      newStatus: "failed",
      source: "provider",
      message: order.providerError,
      providerResponse: order.providerResponse,
    });

    if (appliedCoupon) {
      await revertCouponUsage(order._id);
    }

    const refundResult = await refundOrderAmount({ order });

    if (refundResult.success) {
      const oldStatus = order.status;

      order.status = "refunded";

      await order.save();

      await createStatusLogSafe({
        orderId: order._id,
        previousStatus: oldStatus,
        newStatus: "refunded",
        source: "system",
        message: "Customer refunded after provider rejection",
      });

      walletDebitCompleted = false;

      return res.status(400).json({
        success: false,
        message: GENERIC_PROVIDER_FAILURE_MESSAGE,
        refunded: true,
        order: await populateOrder(order),
      });
    }

    return res.status(502).json({
      success: false,
      message: GENERIC_PROVIDER_FAILURE_MESSAGE,
      refunded: false,
      refundError: refundResult.message,
      order: await populateOrder(order),
    });
  } catch (error) {
    console.error("createOrder error:", error);

    if (
      walletDebitCompleted &&
      !providerSubmissionStarted &&
      wallet &&
      walletTransaction
    ) {
      try {
        await Wallet.findByIdAndUpdate(wallet._id, {
          $inc: { balance: charge },
        });

        await WalletTransaction.findByIdAndUpdate(walletTransaction._id, {
          $set: { status: "reversed" },
        });

        await syncUserBalanceFromWallet(req.user._id, wallet._id);
      } catch (rollbackError) {
        console.error("Emergency wallet rollback failed:", rollbackError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create order",
    });
  }
}

// ============================================================
// RESELLER API ORDER
// ============================================================

async function createResellerOrder(req, res) {
  let reseller = null;
  let resellerDebitCompleted = false;
  // Set to true right before the first provider call. Once the
  // provider may have received the order, the outer catch must never refund.
  let providerSubmissionStarted = false;
  let charge = 0;
  // Declared outside try so the outer catch can see the local order.
  let order = null;

  try {
    reseller = req.reseller;

    if (!reseller) {
      return res.status(401).json({
        success: false,
        message: "Reseller authentication required",
      });
    }

    if (!reseller._id) {
      return res.status(401).json({
        success: false,
        message: "Invalid reseller",
      });
    }

    const resellerUserId = reseller.user?._id || reseller.user;

    if (!resellerUserId) {
      return res.status(400).json({
        success: false,
        message: "Reseller user is not configured",
      });
    }

    const body = req.body || {};

    const serviceId = body.serviceId;
    const link = body.link;
    const quantityInput = body.quantity;
    const idempotencyKey = body.idempotencyKey;

    if (typeof serviceId !== "string" || !serviceId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Invalid serviceId",
      });
    }

    const cleanServiceId = serviceId.trim();

    // Link validation (runs before any balance or provider logic)
    const linkCheck = validateLink(link);

    if (!linkCheck.ok) {
      return res.status(400).json({
        success: false,
        message: linkCheck.message,
      });
    }

    const cleanLink = linkCheck.link;

    const quantity = parseQuantity(quantityInput);

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than zero",
      });
    }

    // idempotencyKey is REQUIRED for reseller API orders.
    if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
      return res.status(400).json({
        success: false,
        message: "idempotencyKey is required",
      });
    }

    const cleanIdempotencyKey = idempotencyKey.trim();

    if (cleanIdempotencyKey.length > 128) {
      return res.status(400).json({
        success: false,
        message: "idempotencyKey must not exceed 128 characters",
      });
    }

    // ---------------------------------------------------------
    // IDEMPOTENCY
    // ---------------------------------------------------------

    const existingIdempotentOrder = await Order.findOne({
      userId: resellerUserId,
      resellerId: reseller._id,
      idempotencyKey: cleanIdempotencyKey,
    });

    if (existingIdempotentOrder) {
      return res.status(200).json({
        success: true,
        message: "Existing reseller order returned",
        idempotent: true,
        order: await populateOrder(existingIdempotentOrder),
      });
    }

    // ---------------------------------------------------------
    // SERVICE
    // ---------------------------------------------------------

    const service = await Service.findOne({
      serviceId: cleanServiceId,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    if (service.status && service.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Service is inactive",
      });
    }

    // ---------------------------------------------------------
    // MIN / MAX
    // ---------------------------------------------------------

    if (service.min !== undefined && quantity < Number(service.min)) {
      return res.status(400).json({
        success: false,
        message: `Minimum quantity is ${service.min}`,
      });
    }

    if (service.max !== undefined && quantity > Number(service.max)) {
      return res.status(400).json({
        success: false,
        message: `Maximum quantity is ${service.max}`,
      });
    }

    // ---------------------------------------------------------
    // BASE SERVICE PRICE
    // ---------------------------------------------------------

    const servicePrice = Number(service.sellingPrice ?? service.price ?? 0);

    const rateQuantity = Number(service.rateQuantity || 1000);

    if (!Number.isFinite(servicePrice) || servicePrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid service price",
      });
    }

    if (!Number.isFinite(rateQuantity) || rateQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid service rate quantity",
      });
    }

    const baseCharge = roundMoney((servicePrice / rateQuantity) * quantity);

    // ---------------------------------------------------------
    // RESELLER MARKUP
    // ---------------------------------------------------------

    charge = calculateResellerPrice({
      basePrice: baseCharge,
      markupType: reseller.markupType,
      markupValue: reseller.markupValue,
    });

    const markupAmount = roundMoney(charge - baseCharge);

    // ---------------------------------------------------------
    // PROVIDER MAPPING
    // ---------------------------------------------------------

    if (!service.providerServiceId) {
      return res.status(400).json({
        success: false,
        message: "Provider service mapping is missing",
      });
    }

    // ---------------------------------------------------------
    // PROVIDER CANDIDATES
    // ---------------------------------------------------------

    const providerCandidates = await findProviderCandidates(service);

    if (!providerCandidates.length) {
      return res.status(400).json({
        success: false,
        message: "No active provider is configured for this service",
      });
    }

    const usableProviders = providerCandidates.filter((provider) => {
      const hasApiKey = Boolean(provider.apiKey);

      const providerUrl = provider.apiUrl || provider.baseUrl || provider.url;

      return hasApiKey && Boolean(providerUrl);
    });

    if (!usableProviders.length) {
      const missingKey = providerCandidates.some((provider) => !provider.apiKey);

      if (missingKey) {
        return res.status(400).json({
          success: false,
          message: "Provider API key is missing",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Provider API URL is missing",
      });
    }

    // ---------------------------------------------------------
    // ATOMIC RESELLER BALANCE DEBIT
    // ---------------------------------------------------------

    const updatedReseller = await Reseller.findOneAndUpdate(
      {
        _id: reseller._id,
        status: "active",
        apiEnabled: true,
        balance: { $gte: charge },
      },
      { $inc: { balance: -charge } },
      { new: true },
    );

    if (!updatedReseller) {
      return res.status(400).json({
        success: false,
        message: "Insufficient reseller balance",
      });
    }

    resellerDebitCompleted = true;

    // ---------------------------------------------------------
    // CREATE LOCAL ORDER
    // ---------------------------------------------------------

    const initialProvider = usableProviders[0];

    try {
      // Assigns to the outer `order` variable (no local `let order`).
      order = await Order.create({
        userId: resellerUserId,
        resellerId: reseller._id,
        serviceId: service._id,
        providerId: initialProvider._id,

        providerOrderId: null,
        providerResponse: null,
        providerError: null,
        providerSubmittedAt: null,

        idempotencyKey: cleanIdempotencyKey,

        walletTransactionId: null,
        walletId: null,

        link: cleanLink,
        quantity,
        charge,

        couponId: null,
        couponCode: null,
        discountAmount: 0,
        originalCharge: baseCharge,

        status: "pending",
        startCount: 0,
        remains: quantity,

        refill: Boolean(service.refill),
        refillId: null,
        cancel: Boolean(service.cancel),

        dripFeed: false,
        note: "Reseller API order",

        runs: undefined,
        interval: undefined,
      });
    } catch (orderError) {
      // -------------------------------------------------------
      // DUPLICATE IDEMPOTENCY (two parallel requests, same key)
      // -------------------------------------------------------

      if (isDuplicateKeyError(orderError)) {
        const existingOrder = await Order.findOne({
          userId: resellerUserId,
          resellerId: reseller._id,
          idempotencyKey: cleanIdempotencyKey,
        });

        if (existingOrder) {
          await Reseller.findByIdAndUpdate(reseller._id, {
            $inc: { balance: charge },
          });

          resellerDebitCompleted = false;

          return res.status(200).json({
            success: true,
            message: "Existing reseller order returned",
            idempotent: true,
            order: await populateOrder(existingOrder),
          });
        }
      }

      // -------------------------------------------------------
      // ROLLBACK RESELLER BALANCE (no local order exists)
      // -------------------------------------------------------

      await Reseller.findByIdAndUpdate(reseller._id, {
        $inc: { balance: charge },
      });

      resellerDebitCompleted = false;

      throw orderError;
    }

    // ---------------------------------------------------------
    // INITIAL STATUS LOG
    // ---------------------------------------------------------

    await createStatusLogSafe({
      orderId: order._id,
      previousStatus: null,
      newStatus: "pending",
      source: "reseller_api",
      message: `Reseller order created. Base price: ${baseCharge}, markup: ${markupAmount}, final charge: ${charge}`,
    });

    // ---------------------------------------------------------
    // PROVIDER ORDER
    // ---------------------------------------------------------

    let providerResult = null;
    let selectedProvider = null;
    let lastProviderError = null;

    const attemptedProviders = [];

    let providerOutcomeUncertain = false;

    for (
      let providerIndex = 0;
      providerIndex < usableProviders.length;
      providerIndex++
    ) {
      const provider = usableProviders[providerIndex];

      const providerId = provider._id.toString();

      const providerPriority = Number(provider.priority || 1);

      attemptedProviders.push(providerId);

      if (!order.providerId || order.providerId.toString() !== providerId) {
        order.providerId = provider._id;

        await order.save();
      }

      try {
        // From this point the provider may have received the order.
        providerSubmissionStarted = true;

        providerResult = await createProviderOrder({
          provider,
          orderId: order._id,
          service: service.providerServiceId,
          link: cleanLink,
          quantity,
          runs: undefined,
          interval: undefined,
        });

        // -----------------------------------------------------
        // SUCCESS
        // -----------------------------------------------------

        if (providerResult && providerResult.success !== false) {
          selectedProvider = provider;

          break;
        }

        const providerMessage =
          providerResult?.message || "Provider request failed";

        const retryable = providerResult?.retryable === true;

        lastProviderError = new Error(providerMessage);

        lastProviderError.retryable = retryable;

        if (retryable && providerIndex < usableProviders.length - 1) {
          await createStatusLogSafe({
            orderId: order._id,
            previousStatus: "pending",
            newStatus: "pending",
            source: "provider",
            message: `Provider "${provider.name}" failed. Falling back to next priority provider for reseller order.`,
            providerResponse: {
              provider: provider.name,
              providerId: provider._id,
              priority: providerPriority,
              retryable: true,
              error: providerMessage,
            },
          });

          continue;
        }

        break;
      } catch (providerError) {
        lastProviderError = providerError;

        const isRetryable = providerError?.retryable === true;

        const isDefiniteFailure = isDefiniteProviderFailure(providerError);

        if (isRetryable && providerIndex < usableProviders.length - 1) {
          await createStatusLogSafe({
            orderId: order._id,
            previousStatus: "pending",
            newStatus: "pending",
            source: "provider",
            message: `Provider "${provider.name}" exhausted retry attempts. Falling back to next priority provider.`,
            providerResponse: {
              provider: provider.name,
              providerId: provider._id,
              priority: providerPriority,
              retryable: true,
              error: providerError.message,
            },
          });

          continue;
        }

        if (isDefiniteFailure) {
          break;
        }

        providerOutcomeUncertain = true;

        break;
      }
    }

    // ---------------------------------------------------------
    // PROVIDER SUCCESS
    // ---------------------------------------------------------

    if (
      selectedProvider &&
      providerResult &&
      providerResult.success !== false
    ) {
      const providerOrderId = providerResult.providerOrderId;

      order.providerId = selectedProvider._id;

      if (!providerOrderId) {
        order.providerError = "Provider response did not contain an order ID";

        order.providerResponse = providerResult.providerResponse || null;

        await order.save();

        return res.status(202).json({
          success: true,
          message:
            "Reseller order created but provider order ID was not returned. Order remains pending for reconciliation.",
          order: await populateOrder(order),
        });
      }

      const previousStatus = order.status;

      order.providerOrderId = String(providerOrderId);

      order.providerResponse = providerResult.providerResponse || null;

      order.providerError = null;

      order.providerSubmittedAt = new Date();

      order.status = "processing";

      await order.save();

      await createStatusLogSafe({
        orderId: order._id,
        previousStatus,
        newStatus: "processing",
        source: "provider",
        message: `Reseller order successfully submitted to provider "${selectedProvider.name}" with priority ${selectedProvider.priority || 1}`,
        providerResponse: providerResult.providerResponse || null,
      });

      // The provider order already exists, so a failure while
      // updating statistics must not turn the response into a 500.
      try {
        await Reseller.findByIdAndUpdate(reseller._id, {
          $inc: {
            totalOrders: 1,
            totalSpent: charge,
          },
        });
      } catch (statsError) {
        console.error("Reseller stats update failed:", statsError.message);
      }

      // NOTE: affiliate commission is intentionally NOT awarded
      // for reseller-originated orders.

      return res.status(201).json({
        success: true,
        message: "Reseller order created successfully",
        order: await populateOrder(order),
        reseller: {
          resellerId: reseller._id,
          resellerCode: reseller.resellerCode,
          baseCharge,
          markupAmount,
          finalCharge: charge,
          balance: roundMoney(updatedReseller.balance),
        },
      });
    }

    // ---------------------------------------------------------
    // UNCERTAIN / RETRYABLE
    // ---------------------------------------------------------

    const finalProviderMessage =
      lastProviderError?.message ||
      providerResult?.message ||
      "Provider request failed";

    const finalRetryable =
      lastProviderError?.retryable === true ||
      providerResult?.retryable === true;

    if (!providerResult && !lastProviderError) {
      providerOutcomeUncertain = true;
    }

    if (finalRetryable || providerOutcomeUncertain) {
      order.providerError = finalProviderMessage;

      order.providerResponse = providerResult?.providerResponse || {
        error: finalProviderMessage,
        retryable: finalRetryable,
        attemptedProviders,
      };

      await order.save();

      await createStatusLogSafe({
        orderId: order._id,
        previousStatus: "pending",
        newStatus: "pending",
        source: "provider",
        message:
          "All available providers failed after retry/fallback attempts. Reseller order remains pending for reconciliation.",
        providerResponse: order.providerResponse,
      });

      // IMPORTANT:
      // Balance remains deducted because the provider
      // result is uncertain and the order can be reconciled.

      return res.status(202).json({
        success: true,
        message:
          "Reseller order created but provider result is uncertain. Order remains pending for reconciliation.",
        order: await populateOrder(order),
      });
    }

    // ---------------------------------------------------------
    // DEFINITE PROVIDER FAILURE
    // ---------------------------------------------------------

    const previousStatus = order.status;

    order.status = "failed";

    order.providerError = finalProviderMessage;

    order.providerResponse = providerResult?.providerResponse || null;

    await order.save();

    await createStatusLogSafe({
      orderId: order._id,
      previousStatus,
      newStatus: "failed",
      source: "provider",
      message: finalProviderMessage,
      providerResponse: order.providerResponse,
    });

    // ---------------------------------------------------------
    // RESELLER REFUND
    // ---------------------------------------------------------

    const refundResult = await refundOrderAmount({ order });

    if (refundResult.success) {
      // The refund is already done. Clear the flag immediately so the
      // outer catch can never refund a second time.
      resellerDebitCompleted = false;

      try {
        const failedStatus = order.status;

        order.status = "refunded";

        await order.save();

        await createStatusLogSafe({
          orderId: order._id,
          previousStatus: failedStatus,
          newStatus: "refunded",
          source: "system",
          message: "Reseller balance refunded after provider rejection",
        });
      } catch (saveError) {
        console.error("Post-refund status save failed:", saveError.message);
      }

      return res.status(400).json({
        success: false,
        message: GENERIC_PROVIDER_FAILURE_MESSAGE,
        refunded: true,
        order: await populateOrder(order),
      });
    }

    console.error(
      "Reseller refund failed for order",
      order._id.toString(),
      refundResult.message,
    );

    return res.status(502).json({
      success: false,
      message:
        "The order could not be processed and the refund could not be completed automatically. Please contact support.",
      refunded: false,
      order: await populateOrder(order),
    });
  } catch (error) {
    console.error("createResellerOrder error:", error);

    // ---------------------------------------------------------
    // EMERGENCY RESELLER ROLLBACK
    // ---------------------------------------------------------
    // Only roll back if the provider was never called.
    // If a local order exists, claim the refund on the order first
    // (resellerRefundedAt) and mark it failed, so a later cancel can
    // never credit the reseller a second time.

    if (
      resellerDebitCompleted &&
      !providerSubmissionStarted &&
      reseller &&
      reseller._id &&
      charge > 0
    ) {
      try {
        if (order && order._id) {
          const claim = await Order.findOneAndUpdate(
            { _id: order._id, resellerRefundedAt: null },
            {
              $set: {
                resellerRefundedAt: new Date(),
                status: "failed",
                providerError: "Order failed before provider submission",
              },
            },
            { new: true },
          );

          if (claim) {
            await Reseller.findByIdAndUpdate(reseller._id, {
              $inc: { balance: charge },
            });

            resellerDebitCompleted = false;

            await createStatusLogSafe({
              orderId: order._id,
              previousStatus: "pending",
              newStatus: "failed",
              source: "system",
              message: "Reseller balance restored after internal error",
            });
          }
        } else {
          // No local order exists, so nothing can be refunded twice.
          await Reseller.findByIdAndUpdate(reseller._id, {
            $inc: { balance: charge },
          });

          resellerDebitCompleted = false;
        }
      } catch (rollbackError) {
        console.error(
          "Emergency reseller balance rollback failed:",
          rollbackError,
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create reseller order",
    });
  }
}

// ============================================================
// SYNC PROVIDER STATUS
// ============================================================

async function syncOrderProviderStatus(req, res) {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isOwner = order.userId.toString() === req.user._id.toString();
    const privileged = isAdminOrStaff(req.user);

    if (!isOwner && !privileged) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (order.dripFeed && !order.providerOrderId) {
      let runsQuery = DripFeedRun.find({
        orderId: order._id,
      }).sort({ runNumber: 1 });

      if (!privileged) {
        runsQuery = runsQuery.select(
          "-providerResponse -providerOrderId -error",
        );
      }

      const runs = await runsQuery;

      return res.status(200).json({
        success: true,
        message:
          "Drip Feed order does not have one provider order ID. Check individual Drip Feed runs.",
        dripFeed: true,
        runs,
        order: await populateOrder(order, { privileged }),
      });
    }

    if (!order.providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider is not assigned",
      });
    }

    if (!order.providerOrderId) {
      return res.status(400).json({
        success: false,
        message: "Provider order ID is not available",
      });
    }

    const result = await syncProviderStatus({
      orderId: order._id,
    });

    const updatedOrder = await Order.findById(order._id);

    const responseBody = {
      success: true,
      message: "Provider status synchronized",
      order: await populateOrder(updatedOrder, { privileged }),
    };

    // Raw sync result may contain provider internals - admin/staff only.
    if (privileged) {
      responseBody.sync = result;
    }

    return res.status(200).json(responseBody);
  } catch (error) {
    console.error("syncOrderProviderStatus error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to synchronize provider status",
    });
  }
}

// ============================================================
// REQUEST REFILL
// ============================================================

async function requestOrderRefill(req, res) {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isOwner = order.userId.toString() === req.user._id.toString();
    const privileged = isAdminOrStaff(req.user);

    if (!isOwner && !privileged) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (order.dripFeed) {
      return res.status(400).json({
        success: false,
        message: "Refill must be handled for individual Drip Feed runs",
      });
    }

    if (!order.refill) {
      return res.status(400).json({
        success: false,
        message: "Refill is not enabled for this order",
      });
    }

    if (!order.providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider is not assigned",
      });
    }

    if (!order.providerOrderId) {
      return res.status(400).json({
        success: false,
        message: "Provider order ID is not available",
      });
    }

    if (!["completed", "partial"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Refill can only be requested for completed or partial orders",
      });
    }

    if (order.refillId) {
      return res.status(200).json({
        success: true,
        message: "Refill has already been requested for this order",
        refillId: order.refillId,
        order: await populateOrder(order, { privileged }),
      });
    }

    const provider = await findActiveProviderWithKey(order.providerId);

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: "Active provider not found",
      });
    }

    if (!provider.apiKey) {
      return res.status(400).json({
        success: false,
        message: "Provider API key is missing",
      });
    }

    // refillProviderOrder THROWS on any provider error (for example a
    // 404 "Order not found" from the provider). Catch it here so the
    // client gets a 502 instead of a generic 500, and the real provider
    // message is stored server-side in order.providerError only.
    let result;

    try {
      result = await refillProviderOrder({
        provider,
        providerOrderId: order.providerOrderId,
        orderId: order._id,
      });
    } catch (providerError) {
      console.error(
        "requestOrderRefill provider error:",
        providerError.message,
      );

      try {
        order.providerError =
          providerError.message || "Provider refill request failed";

        await order.save();
      } catch (saveError) {
        console.error(
          "requestOrderRefill could not save providerError:",
          saveError.message,
        );
      }

      return res.status(502).json({
        success: false,
        message: "Refill request could not be completed. Please try later.",
      });
    }

    if (!result || result.success === false) {
      const message = result?.message || "Provider refill request failed";

      order.providerError = message;

      await order.save();

      return res.status(502).json({
        success: false,
        message: "Refill request could not be completed. Please try later.",
      });
    }

    const providerResponse = result.providerResponse || result.data || result;

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

      order.providerResponse = providerResponse;

      await order.save();

      return res.status(502).json({
        success: false,
        message: "Refill request could not be completed. Please try later.",
      });
    }

    order.refillId = String(refillId);

    order.providerResponse = providerResponse;

    order.providerError = null;

    await order.save();

    return res.status(200).json({
      success: true,
      message: "Refill requested successfully",
      refillId: order.refillId,
      order: await populateOrder(order, { privileged }),
    });
  } catch (error) {
    console.error("requestOrderRefill error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to request refill",
    });
  }
}

// ============================================================
// CANCEL ORDER HELPERS
// ============================================================

// Atomically moves an order from a cancellable status to "canceled".
// Returns the updated order, or null if another request already changed it.
async function claimOrderCancellation(order) {
  return Order.findOneAndUpdate(
    {
      _id: order._id,
      status: { $in: Array.from(CANCELLABLE_STATUSES) },
    },
    { $set: { status: "canceled", providerError: null } },
    { new: true },
  );
}

// Refunds an order that is already in "canceled" status and then marks it
// "refunded". Safe to call repeatedly: refundOrderAmount() is idempotent for
// both normal users (WalletTransaction) and resellers (resellerRefundedAt).
// If the refund fails the order stays "canceled" so the user/admin can retry.
async function finalizeCancellationRefund(
  res,
  order,
  { privileged, logMessage, successMessage, failureMessage },
) {
  const refundResult = await refundOrderAmount({ order });

  if (!refundResult.success) {
    // Internal refund error is logged only, not sent to the client.
    console.error(
      "Cancellation refund failed for order",
      order._id.toString(),
      refundResult.message,
    );

    return res.status(500).json({
      success: false,
      message: failureMessage,
      refunded: false,
      retryable: true,
      order: await populateOrder(order, { privileged }),
    });
  }

  const previousStatus = order.status;

  order.status = "refunded";
  order.providerError = null;

  await order.save();

  await createStatusLogSafe({
    orderId: order._id,
    previousStatus,
    newStatus: "refunded",
    source: "system",
    message: logMessage,
  });

  return res.status(200).json({
    success: true,
    message: successMessage,
    refunded: true,
    order: await populateOrder(order, { privileged }),
  });
}

// ============================================================
// CANCEL ORDER
// ============================================================

async function cancelOrder(req, res) {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isOwner = order.userId.toString() === req.user._id.toString();
    const privileged = isAdminOrStaff(req.user);

    if (!isOwner && !privileged) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // ---------------------------------------------------------
    // RETRY REFUND FOR AN ALREADY-CANCELED ORDER
    // ---------------------------------------------------------
    // If a previous cancel succeeded but the refund failed, the order stays
    // "canceled". Calling cancel again completes the refund (idempotent).

    if (order.status === "canceled") {
      return finalizeCancellationRefund(res, order, {
        privileged,
        logMessage: order.resellerId
          ? "Reseller balance refunded on retry after cancellation"
          : "Wallet refunded on retry after cancellation",
        successMessage: order.resellerId
          ? "Order was already canceled. Reseller balance refunded successfully"
          : "Order was already canceled. Refund completed successfully",
        failureMessage:
          "Refund could not be completed yet. Please try again shortly.",
      });
    }

    if (!CANCELLABLE_STATUSES.has(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be canceled from status "${order.status}"`,
      });
    }

    if (!order.cancel) {
      return res.status(400).json({
        success: false,
        message: "Cancellation is not enabled for this order",
      });
    }

    // ---------------------------------------------------------
    // DRIP FEED
    // ---------------------------------------------------------

    if (order.dripFeed && !order.providerOrderId) {
      await cancelPendingDripFeedRuns(order._id);

      const previousStatus = order.status;

      const claimedOrder = await claimOrderCancellation(order);

      if (!claimedOrder) {
        return res.status(409).json({
          success: false,
          message: "Order status changed. Please refresh and try again.",
        });
      }

      await createStatusLogSafe({
        orderId: claimedOrder._id,
        previousStatus,
        newStatus: "canceled",
        source: "user",
        message:
          "Drip Feed order canceled before individual provider submissions",
      });

      return finalizeCancellationRefund(res, claimedOrder, {
        privileged,
        logMessage: claimedOrder.resellerId
          ? "Reseller balance refunded after Drip Feed cancellation"
          : "Wallet refunded after Drip Feed cancellation",
        successMessage: claimedOrder.resellerId
          ? "Drip Feed order canceled and reseller balance refunded successfully"
          : "Drip Feed order canceled and refunded successfully",
        failureMessage:
          "Drip Feed order canceled but refund could not be completed. Call cancel again to retry the refund.",
      });
    }

    // ---------------------------------------------------------
    // LOCAL CANCELLATION
    // ---------------------------------------------------------

    if (!order.providerOrderId) {
      const previousStatus = order.status;

      const claimedOrder = await claimOrderCancellation(order);

      if (!claimedOrder) {
        return res.status(409).json({
          success: false,
          message: "Order status changed. Please refresh and try again.",
        });
      }

      await createStatusLogSafe({
        orderId: claimedOrder._id,
        previousStatus,
        newStatus: "canceled",
        source: "user",
        message: "Order canceled before provider submission",
      });

      return finalizeCancellationRefund(res, claimedOrder, {
        privileged,
        logMessage: claimedOrder.resellerId
          ? "Reseller balance refunded after order cancellation"
          : "Wallet refunded after order cancellation",
        successMessage: claimedOrder.resellerId
          ? "Order canceled and reseller balance refunded successfully"
          : "Order canceled and refunded successfully",
        failureMessage:
          "Order canceled but refund could not be completed. Call cancel again to retry the refund.",
      });
    }

    // ---------------------------------------------------------
    // PROVIDER
    // ---------------------------------------------------------

    if (!order.providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider is not assigned",
      });
    }

    const provider = await findActiveProviderWithKey(order.providerId);

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: "Active provider not found",
      });
    }

    if (!provider.apiKey) {
      return res.status(400).json({
        success: false,
        message: "Provider API key is missing",
      });
    }

    const cancelResult = await cancelProviderOrder({
      provider,
      providerOrderId: order.providerOrderId,
      orderId: order._id,
    });

    if (!cancelResult || cancelResult.success === false) {
      const message =
        cancelResult?.message || "Provider cancellation request failed";

      // Detailed provider message stays server-side only.
      order.providerError = message;

      await order.save();

      return res.status(502).json({
        success: false,
        message: "Provider cancellation was not confirmed",
        refunded: false,
      });
    }

    try {
      await syncProviderStatus({
        orderId: order._id,
      });
    } catch (syncError) {
      console.error("cancelOrder provider sync error:", syncError.message);

      order.providerError =
        "Cancellation requested but provider status could not be confirmed";

      await order.save();

      return res.status(202).json({
        success: false,
        message:
          "Cancellation was requested, but provider cancellation could not yet be confirmed. No refund was issued.",
        refunded: false,
      });
    }

    const refreshedOrder = await Order.findById(order._id);

    if (!refreshedOrder || refreshedOrder.status !== "canceled") {
      return res.status(202).json({
        success: false,
        message:
          "Provider cancellation is not yet confirmed. No refund was issued.",
        refunded: false,
      });
    }

    return finalizeCancellationRefund(res, refreshedOrder, {
      privileged,
      logMessage: refreshedOrder.resellerId
        ? "Reseller balance refunded after confirmed provider cancellation"
        : "Refund issued after confirmed provider cancellation",
      successMessage: refreshedOrder.resellerId
        ? "Order canceled and reseller balance refunded successfully"
        : "Order canceled and refunded successfully",
      failureMessage:
        "Provider cancellation confirmed, but refund could not be completed. Call cancel again to retry the refund.",
    });
  } catch (error) {
    console.error("cancelOrder error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel order",
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
        message: "Admin or staff access required",
      });
    }

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
      100,
    );

    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      if (!ORDER_STATUSES.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status",
        });
      }

      filter.status = req.query.status;
    }

    if (req.query.providerId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.providerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid providerId",
        });
      }

      filter.providerId = req.query.providerId;
    }

    if (req.query.userId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid userId",
        });
      }

      filter.userId = req.query.userId;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email balance role")
        .populate("serviceId", "name category")
        .populate("providerId", "name priority")
        .populate(
          "resellerId",
          "resellerCode markupType markupValue status",
        ),

      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getAllOrders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
}

// ============================================================
// GET MY ORDERS
// ============================================================

async function getMyOrders(req, res) {
  try {
    const userId = req.user._id;

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
      100,
    );

    const skip = (page - 1) * limit;

    const filter = { userId };

    if (req.query.status) {
      if (!ORDER_STATUSES.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status",
        });
      }

      filter.status = req.query.status;
    }

    // Normal users: no provider details, provider responses/errors,
    // wallet ids, or reseller markup settings.
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select(CLIENT_ORDER_EXCLUDE_SELECT)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("serviceId", "name category")
        .populate("resellerId", "resellerCode"),

      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getMyOrders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your orders",
    });
  }
}

// ============================================================
// GET ORDER BY ID
// ============================================================

async function getOrderById(req, res) {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isOwner = order.userId.toString() === req.user._id.toString();
    const privileged = isAdminOrStaff(req.user);

    if (!isOwner && !privileged) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    return res.status(200).json({
      success: true,
      order: await populateOrder(order, { privileged }),
    });
  } catch (error) {
    console.error("getOrderById error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
    });
  }
}

// ============================================================
// GET ORDER STATUS LOGS
// ============================================================

async function getOrderStatusLogs(req, res) {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId",
      });
    }

    const order = await Order.findById(orderId).select("userId");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const isOwner = order.userId.toString() === req.user._id.toString();
    const privileged = isAdminOrStaff(req.user);

    if (!isOwner && !privileged) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (privileged) {
      const logs = await OrderStatusLog.find({ orderId }).sort({
        createdAt: 1,
      });

      return res.status(200).json({
        success: true,
        data: logs,
      });
    }

    // Normal users: never expose raw provider responses, and replace
    // provider-sourced messages (which may contain provider names or
    // provider error text) with a generic one.
    const rawLogs = await OrderStatusLog.find({ orderId })
      .select("-providerResponse")
      .sort({ createdAt: 1 });

    const logs = rawLogs.map((log) => {
      const plain = log.toJSON();

      if (plain.source === "provider") {
        plain.message = "Order status updated";
      }

      return plain;
    });

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("getOrderStatusLogs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch order status logs",
    });
  }
}

// ============================================================
// UPDATE ORDER STATUS
// ADMIN / STAFF
// ============================================================

async function updateOrderStatus(req, res) {
  try {
    if (!isAdminOrStaff(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin or staff access required",
      });
    }

    const { orderId } = req.params;

    const { status, message } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId",
      });
    }

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const previousStatus = order.status;

    if (previousStatus === status) {
      return res.status(200).json({
        success: true,
        message: "Order already has this status",
        order: await populateOrder(order, { privileged: true }),
      });
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[previousStatus];

    if (!allowed || !allowed.has(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition: ${previousStatus} -> ${status}`,
      });
    }

    // ---------------------------------------------------------
    // REFUNDED
    // ---------------------------------------------------------

    if (status === "refunded") {
      if (order.resellerId) {
        return res.status(400).json({
          success: false,
          message:
            "Reseller orders must be refunded through the reseller refund flow",
        });
      }

      const refundReference = generateRefundReference(order._id.toString());

      const refundTransaction = await WalletTransaction.findOne({
        reference: refundReference,
        transactionType: "refund",
        status: "completed",
      });

      if (!refundTransaction) {
        return res.status(400).json({
          success: false,
          message:
            "Order cannot be manually marked refunded without a completed refund transaction",
        });
      }
    }

    if (status === "canceled" && order.dripFeed) {
      await cancelPendingDripFeedRuns(order._id);
    }

    order.status = status;

    await order.save();

    await createStatusLogSafe({
      orderId: order._id,
      previousStatus,
      newStatus: status,
      source: "admin",
      message:
        message || `Order status changed from ${previousStatus} to ${status}`,
    });

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order: await populateOrder(order, { privileged: true }),
    });
  } catch (error) {
    console.error("updateOrderStatus error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
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
        message: "Admin or staff access required",
      });
    }

    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.walletTransactionId || order.providerOrderId) {
      return res.status(400).json({
        success: false,
        message:
          "This order cannot be physically deleted because it has wallet or provider records",
      });
    }

    if (order.dripFeed) {
      await cancelPendingDripFeedRuns(order._id);

      await DripFeedRun.deleteMany({
        orderId: order._id,
      });
    }

    await OrderStatusLog.deleteMany({
      orderId: order._id,
    });

    await Order.deleteOne({
      _id: order._id,
    });

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("deleteOrder error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete order",
    });
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createOrder,
  createResellerOrder,
  syncOrderProviderStatus,
  requestOrderRefill,
  cancelOrder,
  getAllOrders,
  getMyOrders,
  getOrderById,
  getOrderStatusLogs,
  updateOrderStatus,
  deleteOrder,
};