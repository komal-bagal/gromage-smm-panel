
const mongoose = require("mongoose");

const MassOrder = require("../models/MassOrder");
const Order = require("../models/Order");
const Service = require("../models/Service");
const Provider = require("../models/Provider");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const OrderStatusLog = require("../models/OrderStatusLog");

const {
  createProviderOrder
} = require("../services/providerApiService");

// ======================================================
// CONSTANTS
// ======================================================

const MAX_MASS_ORDERS = 100;

// ======================================================
// HELPERS
// ======================================================

const roundMoney = (value) => {
  return Math.round(Number(value) * 100) / 100;
};

const parseQuantity = (value) => {
  const quantity = Number(value);

  if (
    !Number.isFinite(quantity) ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  return quantity;
};

// ======================================================
// STATUS LOG HELPER
// ======================================================

const createStatusLogSafe = async ({
  orderId,
  previousStatus = null,
  newStatus,
  source,
  message,
  providerResponse = null
}) => {
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
      "MASS ORDER STATUS LOG ERROR:",
      error.message
    );
  }
};

// ======================================================
// PROVIDER ERROR MESSAGE
// ======================================================

const getProviderErrorMessage = (error) => {
  return (
    error?.message ||
    "Provider order creation failed"
  );
};

// ======================================================
// FIND ACTIVE PROVIDER
// ======================================================
//
// Provider mapping in this project:
//
// Service.providerId
//        +
// Service.providerServiceId
//
// Provider itself does NOT contain a services array.
//
// ======================================================

const findProviderForService = async (service) => {
  if (!service.providerId) {
    return null;
  }

  if (!service.providerServiceId) {
    return null;
  }

  const provider =
    await Provider.findOne({
      _id: service.providerId,

      status: "active",

      apiUrl: {
        $exists: true,
        $ne: ""
      }
    }).select("+apiKey");

  if (!provider) {
    return null;
  }

  if (!provider.apiKey) {
    return null;
  }

  return provider;
};

// ======================================================
// CALCULATE SERVICE CHARGE
// ======================================================

const calculateServiceCharge = ({
  service,
  quantity
}) => {
  const sellingPrice = Number(
    service.sellingPrice ??
      service.price
  );

  if (
    !Number.isFinite(sellingPrice) ||
    sellingPrice < 0
  ) {
    throw new Error(
      "Invalid service selling price"
    );
  }

  // SMM service price is based on 1000 quantity.
  const charge =
    (sellingPrice / 1000) *
    quantity;

  return roundMoney(charge);
};

// ======================================================
// REFUND MASS ORDER
// ======================================================

const refundMassOrder = async ({
  order,
  userId,
  walletId,
  amount
}) => {
  const refundReference =
    `REFUND-${order._id}`;

  // ----------------------------------------------------
  // PREVENT DUPLICATE REFUND
  // ----------------------------------------------------

  const existingRefund =
    await WalletTransaction.findOne({
      reference: refundReference,
      transactionType: "refund"
    });

  if (existingRefund) {
    return true;
  }

  // ----------------------------------------------------
  // GET CURRENT WALLET
  // ----------------------------------------------------

  const walletBefore =
    await Wallet.findOne({
      _id: walletId,
      userId,
      status: "active"
    });

  if (!walletBefore) {
    return false;
  }

  const balanceBefore =
    roundMoney(walletBefore.balance);

  // ----------------------------------------------------
  // CREDIT WALLET
  // ----------------------------------------------------

  const walletAfter =
    await Wallet.findOneAndUpdate(
      {
        _id: walletId,
        userId,
        status: "active"
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

  if (!walletAfter) {
    return false;
  }

  const balanceAfter =
    roundMoney(walletAfter.balance);

  // ----------------------------------------------------
  // CREATE REFUND TRANSACTION
  // ----------------------------------------------------

  await WalletTransaction.create({
    userId,

    walletId,

    transactionType:
      "refund",

    reference:
      refundReference,

    amount,

    balanceBefore,

    balanceAfter,

    status: "completed"
  });

  return true;
};

// ======================================================
// CREATE MASS ORDER
// ======================================================

const createMassOrder = async (
  req,
  res
) => {
  let massOrder = null;

  try {
    // ==================================================
    // AUTHENTICATION
    // ==================================================

    const userId =
      req.user?._id ||
      req.user?.id ||
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required"
      });
    }

    // ==================================================
    // REQUEST BODY
    // ==================================================

    const {
      batchName = "",
      orders,
      notes = ""
    } = req.body;

    // ==================================================
    // VALIDATE ORDERS ARRAY
    // ==================================================

    if (!Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        message:
          "orders must be an array"
      });
    }

    if (orders.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "At least one order is required"
      });
    }

    if (
      orders.length >
      MAX_MASS_ORDERS
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Maximum ${MAX_MASS_ORDERS} orders are allowed per mass order`
      });
    }

    // ==================================================
    // GET WALLET
    // ==================================================

    let wallet =
      await Wallet.findOne({
        userId
      });

    if (!wallet) {
      wallet =
        await Wallet.create({
          userId,
          balance: 0,
          status: "active"
        });
    }

    if (
      wallet.status !==
      "active"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Wallet is suspended"
      });
    }

    // ==================================================
    // VALIDATE ALL ORDERS FIRST
    // ==================================================

    const preparedOrders = [];

    let totalAmount = 0;

    for (
      let index = 0;
      index < orders.length;
      index++
    ) {
      const item =
        orders[index];

      // ------------------------------------------------
      // VALIDATE ITEM
      // ------------------------------------------------

      if (
        !item ||
        typeof item !== "object"
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid order at index ${index + 1}`
        });
      }

      // ------------------------------------------------
      // SERVICE ID
      // ------------------------------------------------

      const serviceId =
        String(
          item.serviceId || ""
        ).trim();

      const link =
        String(
          item.link || ""
        ).trim();

      const quantity =
        parseQuantity(
          item.quantity
        );

      // ------------------------------------------------
      // SERVICE ID VALIDATION
      // ------------------------------------------------
      //
      // IMPORTANT:
      // Service.serviceId is a STRING in this project.
      //
      // Example:
      // 6aa238e98ba457a92258af2b-1003
      //
      // Do NOT validate it as ObjectId.
      //

      if (!serviceId) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid serviceId at order ${index + 1}`
        });
      }

      // ------------------------------------------------
      // LINK
      // ------------------------------------------------

      if (!link) {
        return res.status(400).json({
          success: false,
          message:
            `Link is required at order ${index + 1}`
        });
      }

      // ------------------------------------------------
      // QUANTITY
      // ------------------------------------------------

      if (quantity === null) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid quantity at order ${index + 1}`
        });
      }

      // ------------------------------------------------
      // GET SERVICE BY serviceId STRING
      // ------------------------------------------------

      const service =
        await Service.findOne({
          serviceId
        });

      if (!service) {
        return res.status(400).json({
          success: false,
          message:
            `Service not found at order ${index + 1}`
        });
      }

      // ------------------------------------------------
      // SERVICE STATUS
      // ------------------------------------------------

      if (
        service.status !==
        "active"
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Service is inactive at order ${index + 1}`
        });
      }

      // ------------------------------------------------
      // QUANTITY LIMIT
      // ------------------------------------------------

      if (
        quantity <
          service.min ||
        quantity >
          service.max
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Quantity at order ${index + 1} must be between ${service.min} and ${service.max}`
        });
      }

      // ------------------------------------------------
      // PROVIDER SERVICE ID
      // ------------------------------------------------

      if (
        !service.providerServiceId
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Provider service ID is missing for order ${index + 1}`
        });
      }

      // ------------------------------------------------
      // PROVIDER
      // ------------------------------------------------

      const provider =
        await findProviderForService(
          service
        );

      if (!provider) {
        return res.status(400).json({
          success: false,
          message:
            `No usable provider found for order ${index + 1}`
        });
      }

      // ------------------------------------------------
      // CALCULATE CHARGE
      // ------------------------------------------------

      const charge =
        calculateServiceCharge({
          service,
          quantity
        });

      totalAmount =
        roundMoney(
          totalAmount +
            charge
        );

      // ------------------------------------------------
      // STORE PREPARED ORDER
      // ------------------------------------------------

      preparedOrders.push({
        index,
        service,
        provider,
        link,
        quantity,
        charge
      });
    }

    // ==================================================
    // CHECK TOTAL WALLET BALANCE
    // ==================================================

    if (
      Number(wallet.balance) <
      totalAmount
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Insufficient wallet balance",

        requiredAmount:
          totalAmount,

        availableBalance:
          roundMoney(
            wallet.balance
          )
      });
    }

    // ==================================================
    // CREATE MASS ORDER
    // ==================================================

    massOrder =
      await MassOrder.create({
        user: userId,

        batchName:
          String(
            batchName
          ).trim(),

        totalOrders:
          preparedOrders.length,

        successfulOrders: 0,

        failedOrders: 0,

        totalAmount,

        status:
          "processing",

        rawData:
          JSON.stringify(
            orders
          ),

        notes:
          String(
            notes
          ).trim()
      });

    // ==================================================
    // PROCESS EACH ORDER
    // ==================================================

    const createdOrderIds = [];

    const results = [];

    let successfulOrders = 0;

    let failedOrders = 0;

    for (
      const prepared of
        preparedOrders
    ) {
      const {
        index,
        service,
        provider,
        link,
        quantity,
        charge
      } = prepared;

      let order = null;

      let walletDebited = false;

      try {
        // ==============================================
        // ATOMIC WALLET DEBIT
        // ==============================================

        const walletBefore =
          await Wallet.findOne({
            _id: wallet._id,

            userId,

            status: "active",

            balance: {
              $gte: charge
            }
          });

        if (!walletBefore) {
          throw new Error(
            "Insufficient wallet balance while processing batch"
          );
        }

        const walletAfter =
          await Wallet.findOneAndUpdate(
            {
              _id: wallet._id,

              userId,

              status: "active",

              balance: {
                $gte: charge
              }
            },

            {
              $inc: {
                balance:
                  -charge
              }
            },

            {
              new: true
            }
          );

        if (!walletAfter) {
          throw new Error(
            "Wallet debit failed"
          );
        }

        walletDebited = true;

        // ==============================================
        // WALLET TRANSACTION
        // ==============================================

        const transactionReference =
          `MASS-ORDER-${massOrder._id}-${index + 1}-${Date.now()}`;

        let walletTransaction;

        try {
          walletTransaction =
            await WalletTransaction.create({
              userId,

              walletId:
                wallet._id,

              transactionType:
                "debit",

              reference:
                transactionReference,

              amount:
                charge,

              balanceBefore:
                roundMoney(
                  walletBefore.balance
                ),

              balanceAfter:
                roundMoney(
                  walletAfter.balance
                ),

              status:
                "completed"
            });
        } catch (
          transactionError
        ) {
          // --------------------------------------------
          // ROLLBACK WALLET DEBIT
          // --------------------------------------------

          await Wallet.updateOne(
            {
              _id:
                wallet._id,

              userId
            },

            {
              $inc: {
                balance:
                  charge
              }
            }
          );

          walletDebited = false;

          throw transactionError;
        }

        // ==============================================
        // CREATE ORDER
        // ==============================================

        order =
          await Order.create({
            userId,

            serviceId:
              service._id,

            providerId:
              provider._id,

            providerOrderId:
              null,

            providerResponse:
              null,

            providerError:
              null,

            providerSubmittedAt:
              null,

            walletId:
              wallet._id,

            walletTransactionId:
              walletTransaction._id,

            link,

            quantity,

            charge,

            status:
              "pending",

            startCount:
              0,

            remains:
              quantity,

            refill:
              Boolean(
                service.refill
              ),

            cancel:
              Boolean(
                service.cancel
              ),

            dripFeed: false,

            // IMPORTANT:
            // Normal Mass Orders are not drip-feed orders.
            // Order schema requires runs and interval >= 1.
            runs: 1,

            interval: 1,

            note:
              `Mass order: ${massOrder._id}`
          });

        createdOrderIds.push(
          order._id
        );

        // ==============================================
        // PENDING STATUS LOG
        // ==============================================

        await createStatusLogSafe({
          orderId:
            order._id,

          previousStatus:
            null,

          newStatus:
            "pending",

          source:
            "mass_order",

          message:
            `Order created through Mass Order ${massOrder._id}`
        });

        // ==============================================
        // CREATE PROVIDER ORDER
        // ==============================================

        const providerResult =
          await createProviderOrder({
            provider,

            orderId:
              order._id,

            service:
              service.providerServiceId,

            link,

            quantity
          });

        // ==============================================
        // SAVE PROVIDER RESULT
        // ==============================================

        order.providerOrderId =
          providerResult.providerOrderId;

        order.providerResponse =
          providerResult.providerResponse;

        order.providerSubmittedAt =
          new Date();

        order.providerError =
          null;

        order.status =
          "processing";

        await order.save();

        // ==============================================
        // PROCESSING STATUS LOG
        // ==============================================

        await createStatusLogSafe({
          orderId:
            order._id,

          previousStatus:
            "pending",

          newStatus:
            "processing",

          source:
            "mass_order",

          message:
            `Provider order created through Mass Order ${massOrder._id}`,

          providerResponse:
            providerResult.providerResponse
        });

        // ==============================================
        // SUCCESS
        // ==============================================

        successfulOrders++;

        results.push({
          index:
            index + 1,

          success: true,

          orderId:
            order._id,

          providerOrderId:
            providerResult.providerOrderId,

          charge,

          status:
            "processing"
        });

      } catch (error) {
        failedOrders++;

        const errorMessage =
          getProviderErrorMessage(
            error
          );

        // ==============================================
        // ORDER CREATED BUT PROVIDER FAILED
        // ==============================================

        if (order) {
          const previousStatus =
            order.status;

          order.status =
            "failed";

          order.providerError =
            errorMessage;

          await order.save();

          await createStatusLogSafe({
            orderId:
              order._id,

            previousStatus,

            newStatus:
              "failed",

            source:
              "mass_order",

            message:
              errorMessage
          });

          // ============================================
          // REFUND
          // ============================================

          try {
            const refunded =
              await refundMassOrder({
                order,

                userId,

                walletId:
                  wallet._id,

                amount:
                  charge
              });

            if (refunded) {
              order.status =
                "refunded";

              await order.save();

              await createStatusLogSafe({
                orderId:
                  order._id,

                previousStatus:
                  "failed",

                newStatus:
                  "refunded",

                source:
                  "mass_order",

                message:
                  "Order amount refunded after provider failure"
              });
            }
          } catch (
            refundError
          ) {
            console.error(
              "MASS ORDER REFUND ERROR:",
              refundError
            );
          }
        }

        // ==============================================
        // WALLET DEBITED BUT ORDER NOT CREATED
        // ==============================================

        if (
          !order &&
          walletDebited
        ) {
          try {
            const currentWallet =
              await Wallet.findOne({
                _id:
                  wallet._id,

                userId
              });

            const balanceBefore =
              currentWallet
                ? roundMoney(
                    currentWallet.balance
                  )
                : 0;

            await Wallet.updateOne(
              {
                _id:
                  wallet._id,

                userId
              },

              {
                $inc: {
                  balance:
                    charge
                }
              }
            );

            const balanceAfter =
              roundMoney(
                balanceBefore +
                  charge
              );

            const refundReference =
              `MASS-ROLLBACK-${massOrder._id}-${index + 1}`;

            await WalletTransaction.create({
              userId,

              walletId:
                wallet._id,

              transactionType:
                "refund",

              reference:
                refundReference,

              amount:
                charge,

              balanceBefore,

              balanceAfter,

              status:
                "completed"
            });

          } catch (
            rollbackError
          ) {
            console.error(
              "MASS ORDER WALLET ROLLBACK ERROR:",
              rollbackError
            );
          }
        }

        // ==============================================
        // FAILED RESULT
        // ==============================================

        results.push({
          index:
            index + 1,

          success: false,

          orderId:
            order?._id ||
            null,

          charge,

          status:
            order?.status ||
            "failed",

          error:
            errorMessage
        });
      }
    }

    // ==================================================
    // FINAL MASS ORDER STATUS
    // ==================================================

    let massOrderStatus =
      "failed";

    if (
      successfulOrders ===
      preparedOrders.length
    ) {
      massOrderStatus =
        "completed";
    } else if (
      successfulOrders > 0
    ) {
      massOrderStatus =
        "partial";
    }

    // ==================================================
    // UPDATE MASS ORDER
    // ==================================================

    massOrder.orders =
      createdOrderIds;

    massOrder.successfulOrders =
      successfulOrders;

    massOrder.failedOrders =
      failedOrders;

    massOrder.status =
      massOrderStatus;

    await massOrder.save();

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(
      failedOrders > 0
        ? 207
        : 201
    ).json({
      success:
        successfulOrders > 0,

      message:
        `Mass order processed: ${successfulOrders} successful, ${failedOrders} failed`,

      massOrder: {
        id:
          massOrder._id,

        status:
          massOrder.status,

        totalOrders:
          massOrder.totalOrders,

        successfulOrders:
          massOrder.successfulOrders,

        failedOrders:
          massOrder.failedOrders,

        totalAmount:
          massOrder.totalAmount
      },

      results
    });

  } catch (error) {
    console.error(
      "CREATE MASS ORDER ERROR:",
      error
    );

    // ==================================================
    // MARK MASS ORDER FAILED
    // ==================================================

    if (massOrder) {
      massOrder.status =
        "failed";

      await massOrder.save();
    }

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to process mass order"
    });
  }
};

// ======================================================
// GET MY MASS ORDERS
// ======================================================

const getMyMassOrders = async (
  req,
  res
) => {
  try {
    const userId =
      req.user?._id ||
      req.user?.id ||
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,

        message:
          "Authentication required"
      });
    }

    const page =
      Math.max(
        Number(
          req.query.page
        ) || 1,
        1
      );

    const limit =
      Math.min(
        Math.max(
          Number(
            req.query.limit
          ) || 10,
          1
        ),
        100
      );

    const skip =
      (page - 1) *
      limit;

    const [
      massOrders,
      total
    ] = await Promise.all([
      MassOrder.find({
        user: userId
      })
        .populate({
          path: "orders",

          select:
            "serviceId link quantity charge status providerOrderId createdAt"
        })

        .sort({
          createdAt: -1
        })

        .skip(skip)

        .limit(limit),

      MassOrder.countDocuments({
        user: userId
      })
    ]);

    return res.status(200).json({
      success: true,

      data:
        massOrders,

      pagination: {
        page,

        limit,

        total,

        pages:
          Math.ceil(
            total / limit
          )
      }
    });

  } catch (error) {
    console.error(
      "GET MY MASS ORDERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to fetch mass orders"
    });
  }
};

// ======================================================
// GET MASS ORDER BY ID
// ======================================================

const getMassOrderById = async (
  req,
  res
) => {
  try {
    const userId =
      req.user?._id ||
      req.user?.id ||
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,

        message:
          "Authentication required"
      });
    }

    const {
      massOrderId
    } = req.params;

    // ==================================================
    // VALIDATE MASS ORDER ID
    // ==================================================

    if (
      !mongoose.Types.ObjectId.isValid(
        massOrderId
      )
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Invalid mass order ID"
      });
    }

    // ==================================================
    // FIND MASS ORDER
    // ==================================================

    const massOrder =
      await MassOrder.findOne({
        _id:
          massOrderId,

        user:
          userId
      }).populate({
        path: "orders",

        populate: [
          {
            path:
              "serviceId",

            select:
              "serviceId name platform sellingPrice"
          },

          {
            path:
              "providerId",

            select:
              "name apiUrl"
          }
        ]
      });

    if (!massOrder) {
      return res.status(404).json({
        success: false,

        message:
          "Mass order not found"
      });
    }

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,

      data:
        massOrder
    });

  } catch (error) {
    console.error(
      "GET MASS ORDER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Failed to fetch mass order"
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createMassOrder,
  getMyMassOrders,
  getMassOrderById
};
