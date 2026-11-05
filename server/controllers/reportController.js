const Order = require("../models/Order");
const WalletTransaction = require("../models/WalletTransaction");

// ======================================================
// SALES REPORT
// ======================================================

const getSalesReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      status
    } = req.query;

    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(
          `${startDate}T00:00:00.000Z`
        );
      }

      if (endDate) {
        filter.createdAt.$lte = new Date(
          `${endDate}T23:59:59.999Z`
        );
      }
    }

    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const orderCount = orders.length;

    const totalSales = orders.reduce(
      (sum, order) =>
        sum + (Number(order.charge) || 0),
      0
    );

    const totalDiscount = orders.reduce(
      (sum, order) =>
        sum + (Number(order.discountAmount) || 0),
      0
    );

    const originalSales = orders.reduce(
      (sum, order) =>
        sum +
        (
          Number(order.originalCharge) ||
          Number(order.charge) ||
          0
        ),
      0
    );

    const averageOrderValue =
      orderCount > 0
        ? totalSales / orderCount
        : 0;

    const statusBreakdown = {};

    orders.forEach((order) => {
      const orderStatus =
        order.status || "unknown";

      if (!statusBreakdown[orderStatus]) {
        statusBreakdown[orderStatus] = {
          count: 0,
          sales: 0
        };
      }

      statusBreakdown[orderStatus].count += 1;

      statusBreakdown[orderStatus].sales +=
        Number(order.charge) || 0;
    });

    const dailySales = {};

    orders.forEach((order) => {
      if (!order.createdAt) {
        return;
      }

      const date = new Date(order.createdAt)
        .toISOString()
        .split("T")[0];

      if (!dailySales[date]) {
        dailySales[date] = {
          date,
          orders: 0,
          sales: 0
        };
      }

      dailySales[date].orders += 1;

      dailySales[date].sales +=
        Number(order.charge) || 0;
    });

    res.status(200).json({
      success: true,

      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        status: status || null
      },

      summary: {
        orderCount,
        originalSales,
        totalDiscount,
        totalSales,
        averageOrderValue
      },

      statusBreakdown: Object.entries(
        statusBreakdown
      ).map(([status, data]) => ({
        status,
        count: data.count,
        sales: data.sales
      })),

      dailySales: Object.values(
        dailySales
      )
    });

  } catch (error) {
    console.error(
      "GET SALES REPORT ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ======================================================
// ORDERS REPORT
// ======================================================

const getOrdersReport = async (req, res) => {
  try {
    console.log(
      "========== ORDERS REPORT START =========="
    );

    const {
      startDate,
      endDate,
      status,
      userId,
      providerId,
      resellerId
    } = req.query;

    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(
          `${startDate}T00:00:00.000Z`
        );
      }

      if (endDate) {
        filter.createdAt.$lte = new Date(
          `${endDate}T23:59:59.999Z`
        );
      }
    }

    if (status) {
      filter.status = status;
    }

    if (userId) {
      filter.userId = userId;
    }

    if (providerId) {
      filter.providerId = providerId;
    }

    if (resellerId) {
      filter.resellerId = resellerId;
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const orderCount = orders.length;

    const totalQuantity = orders.reduce(
      (sum, order) =>
        sum + (Number(order.quantity) || 0),
      0
    );

    const totalSales = orders.reduce(
      (sum, order) =>
        sum + (Number(order.charge) || 0),
      0
    );

    const statusBreakdown = {};

    orders.forEach((order) => {
      const orderStatus =
        order.status || "unknown";

      if (!statusBreakdown[orderStatus]) {
        statusBreakdown[orderStatus] = {
          count: 0,
          quantity: 0,
          sales: 0
        };
      }

      statusBreakdown[orderStatus].count += 1;

      statusBreakdown[orderStatus].quantity +=
        Number(order.quantity) || 0;

      statusBreakdown[orderStatus].sales +=
        Number(order.charge) || 0;
    });

    const dailyOrders = {};

    orders.forEach((order) => {
      if (!order.createdAt) {
        return;
      }

      const date = new Date(order.createdAt)
        .toISOString()
        .split("T")[0];

      if (!dailyOrders[date]) {
        dailyOrders[date] = {
          date,
          orders: 0,
          quantity: 0,
          sales: 0
        };
      }

      dailyOrders[date].orders += 1;

      dailyOrders[date].quantity +=
        Number(order.quantity) || 0;

      dailyOrders[date].sales +=
        Number(order.charge) || 0;
    });

    res.status(200).json({
      success: true,

      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        status: status || null,
        userId: userId || null,
        providerId: providerId || null,
        resellerId: resellerId || null
      },

      summary: {
        orderCount,
        totalQuantity,
        totalSales
      },

      statusBreakdown: Object.entries(
        statusBreakdown
      ).map(([status, data]) => ({
        status,
        count: data.count,
        quantity: data.quantity,
        sales: data.sales
      })),

      dailyOrders: Object.values(
        dailyOrders
      )
    });

  } catch (error) {
    console.error(
      "GET ORDERS REPORT ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ======================================================
// REVENUE REPORT
// ======================================================

const getRevenueReport = async (req, res) => {
  try {
    console.log(
      "========== REVENUE REPORT START =========="
    );

    const {
      startDate,
      endDate,
      status
    } = req.query;

    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(
          `${startDate}T00:00:00.000Z`
        );
      }

      if (endDate) {
        filter.createdAt.$lte = new Date(
          `${endDate}T23:59:59.999Z`
        );
      }
    }

    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const totalOrders = orders.length;

    const totalRevenue = orders.reduce(
      (sum, order) =>
        sum + (Number(order.charge) || 0),
      0
    );

    const averageRevenuePerOrder =
      totalOrders > 0
        ? totalRevenue / totalOrders
        : 0;

    const statusRevenue = {};

    orders.forEach((order) => {
      const orderStatus =
        order.status || "unknown";

      if (!statusRevenue[orderStatus]) {
        statusRevenue[orderStatus] = {
          orders: 0,
          revenue: 0
        };
      }

      statusRevenue[orderStatus].orders += 1;

      statusRevenue[orderStatus].revenue +=
        Number(order.charge) || 0;
    });

    const dailyRevenue = {};

    orders.forEach((order) => {
      if (!order.createdAt) {
        return;
      }

      const date = new Date(order.createdAt)
        .toISOString()
        .split("T")[0];

      if (!dailyRevenue[date]) {
        dailyRevenue[date] = {
          date,
          orders: 0,
          revenue: 0
        };
      }

      dailyRevenue[date].orders += 1;

      dailyRevenue[date].revenue +=
        Number(order.charge) || 0;
    });

    res.status(200).json({
      success: true,

      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        status: status || null
      },

      summary: {
        totalOrders,
        totalRevenue,
        averageRevenuePerOrder
      },

      statusRevenue: Object.entries(
        statusRevenue
      ).map(([status, data]) => ({
        status,
        orders: data.orders,
        revenue: data.revenue
      })),

      dailyRevenue: Object.values(
        dailyRevenue
      )
    });

  } catch (error) {
    console.error(
      "GET REVENUE REPORT ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ======================================================
// PROVIDER PERFORMANCE REPORT
// ======================================================

const getProviderPerformanceReport = async (
  req,
  res
) => {
  try {
    const {
      startDate,
      endDate,
      providerId,
      status
    } = req.query;

    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(
          `${startDate}T00:00:00.000Z`
        );
      }

      if (endDate) {
        filter.createdAt.$lte = new Date(
          `${endDate}T23:59:59.999Z`
        );
      }
    }

    if (providerId) {
      filter.providerId = providerId;
    }

    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .populate(
        "providerId",
        "name status priority"
      )
      .sort({ createdAt: -1 })
      .lean();

    const providerStats = {};

    orders.forEach((order) => {
      const provider = order.providerId;

      const id = provider?._id
        ? provider._id.toString()
        : "unassigned";

      const providerName =
        provider?.name || "Unassigned";

      if (!providerStats[id]) {
        providerStats[id] = {
          providerId:
            provider?._id || null,

          providerName,

          totalOrders: 0,

          totalQuantity: 0,

          totalRevenue: 0,

          completedOrders: 0,

          processingOrders: 0,

          pendingOrders: 0,

          failedOrders: 0,

          canceledOrders: 0,

          refundedOrders: 0
        };
      }

      const stats =
        providerStats[id];

      stats.totalOrders += 1;

      stats.totalQuantity +=
        Number(order.quantity) || 0;

      stats.totalRevenue +=
        Number(order.charge) || 0;

      switch (order.status) {
        case "completed":
          stats.completedOrders += 1;
          break;

        case "processing":
        case "in_progress":
          stats.processingOrders += 1;
          break;

        case "pending":
          stats.pendingOrders += 1;
          break;

        case "failed":
          stats.failedOrders += 1;
          break;

        case "canceled":
          stats.canceledOrders += 1;
          break;

        case "refunded":
          stats.refundedOrders += 1;
          break;

        default:
          break;
      }
    });

    const providers =
      Object.values(providerStats);

    providers.forEach((provider) => {
      provider.averageRevenuePerOrder =
        provider.totalOrders > 0
          ? Number(
              (
                provider.totalRevenue /
                provider.totalOrders
              ).toFixed(2)
            )
          : 0;

      provider.completionRate =
        provider.totalOrders > 0
          ? Number(
              (
                (provider.completedOrders /
                  provider.totalOrders) *
                100
              ).toFixed(2)
            )
          : 0;
    });

    res.status(200).json({
      success: true,

      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
        providerId: providerId || null,
        status: status || null
      },

      summary: {
        providerCount:
          providers.length,

        totalOrders:
          orders.length,

        totalRevenue:
          orders.reduce(
            (sum, order) =>
              sum +
              (Number(order.charge) || 0),
            0
          )
      },

      providers
    });

  } catch (error) {
    console.error(
      "GET PROVIDER PERFORMANCE REPORT ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ======================================================
// WALLET REPORT
// ======================================================

const getWalletReport = async (
  req,
  res
) => {
  try {
    const {
      startDate,
      endDate,
      transactionType,
      status,
      userId
    } = req.query;

    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(
          `${startDate}T00:00:00.000Z`
        );
      }

      if (endDate) {
        filter.createdAt.$lte = new Date(
          `${endDate}T23:59:59.999Z`
        );
      }
    }

    if (transactionType) {
      filter.transactionType =
        transactionType;
    }

    if (status) {
      filter.status = status;
    }

    if (userId) {
      filter.userId = userId;
    }

    const transactions =
      await WalletTransaction.find(filter)
        .sort({
          createdAt: -1
        })
        .lean();

    let totalAmount = 0;

    let totalCredits = 0;

    let totalDebits = 0;

    const transactionTypes = {};

    const statuses = {};

    const dailyActivity = {};

    const creditTypes = [
      "credit",
      "recharge",
      "refund",
      "cashback",
      "referral_commission",
      "commission"
    ];

    transactions.forEach(
      (transaction) => {
        const amount =
          Number(
            transaction.amount
          ) || 0;

        totalAmount += amount;

        const type =
          transaction.transactionType ||
          "unknown";

        const transactionStatus =
          transaction.status ||
          "unknown";

        if (
          creditTypes.includes(type)
        ) {
          totalCredits += amount;
        }

        if (type === "debit") {
          totalDebits += amount;
        }

        if (!transactionTypes[type]) {
          transactionTypes[type] = {
            count: 0,
            amount: 0
          };
        }

        transactionTypes[type].count += 1;

        transactionTypes[type].amount +=
          amount;

        if (!statuses[transactionStatus]) {
          statuses[transactionStatus] = {
            count: 0,
            amount: 0
          };
        }

        statuses[transactionStatus].count +=
          1;

        statuses[transactionStatus].amount +=
          amount;

        if (transaction.createdAt) {
          const date =
            new Date(
              transaction.createdAt
            )
              .toISOString()
              .split("T")[0];

          if (!dailyActivity[date]) {
            dailyActivity[date] = {
              date,
              transactions: 0,
              amount: 0
            };
          }

          dailyActivity[date].transactions +=
            1;

          dailyActivity[date].amount +=
            amount;
        }
      }
    );

    totalAmount =
      Number(
        totalAmount.toFixed(2)
      );

    totalCredits =
      Number(
        totalCredits.toFixed(2)
      );

    totalDebits =
      Number(
        totalDebits.toFixed(2)
      );

    const netWalletMovement =
      Number(
        (
          totalCredits -
          totalDebits
        ).toFixed(2)
      );

    res.status(200).json({
      success: true,

      filters: {
        startDate:
          startDate || null,

        endDate:
          endDate || null,

        transactionType:
          transactionType || null,

        status:
          status || null,

        userId:
          userId || null
      },

      summary: {
        totalTransactions:
          transactions.length,

        totalAmount,

        totalCredits,

        totalDebits,

        netWalletMovement
      },

      transactionTypes:
        Object.entries(
          transactionTypes
        ).map(
          ([type, data]) => ({
            transactionType: type,
            count: data.count,
            amount:
              Number(
                data.amount.toFixed(2)
              )
          })
        ),

      statuses:
        Object.entries(
          statuses
        ).map(
          ([status, data]) => ({
            status,
            count: data.count,
            amount:
              Number(
                data.amount.toFixed(2)
              )
          })
        ),

      dailyActivity:
        Object.values(
          dailyActivity
        ),

      transactions
    });

  } catch (error) {
    console.error(
      "GET WALLET REPORT ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ======================================================
// PROFIT REPORT
// ======================================================

const getProfitReport = async (
  req,
  res
) => {
  try {
    console.log(
      "========== PROFIT REPORT START =========="
    );

    const {
      startDate,
      endDate,
      status,
      serviceId,
      providerId,
      userId,
      resellerId
    } = req.query;

    const filter = {};

    // --------------------------------------------------
    // DATE FILTER
    // --------------------------------------------------

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte =
          new Date(
            `${startDate}T00:00:00.000Z`
          );
      }

      if (endDate) {
        filter.createdAt.$lte =
          new Date(
            `${endDate}T23:59:59.999Z`
          );
      }
    }

    // --------------------------------------------------
    // OTHER FILTERS
    // --------------------------------------------------

    if (status) {
      filter.status = status;
    }

    if (serviceId) {
      filter.serviceId = serviceId;
    }

    if (providerId) {
      filter.providerId = providerId;
    }

    if (userId) {
      filter.userId = userId;
    }

    if (resellerId) {
      filter.resellerId =
        resellerId;
    }

    // --------------------------------------------------
    // GET ORDERS
    // --------------------------------------------------

    const orders = await Order.find(filter)
      .populate(
        "serviceId",
        "name serviceId cost sellingPrice"
      )
      .populate(
        "providerId",
        "name status priority"
      )
      .sort({
        createdAt: -1
      })
      .lean();

    // --------------------------------------------------
    // TOTALS
    // --------------------------------------------------

    let totalOrders = 0;

    let totalQuantity = 0;

    let totalRevenue = 0;

    let totalCost = 0;

    let totalProfit = 0;

    const profitByProvider = {};

    const profitByService = {};

    const dailyProfit = {};

    const profitOrders = [];

    // --------------------------------------------------
    // CALCULATE PROFIT
    // --------------------------------------------------

    for (const order of orders) {
      const quantity =
        Number(order.quantity) || 0;

      const revenue =
        Number(order.charge) || 0;

      const service =
        order.serviceId;

      const serviceCost =
        Number(
          service?.cost
        ) || 0;

      let cost = 0;

      if (
        serviceCost >= 0 &&
        quantity > 0
      ) {
        cost =
          (
            serviceCost /
            1000
          ) *
          quantity;
      }

      cost =
        Number(
          cost.toFixed(2)
        );

      const profit =
        Number(
          (
            revenue -
            cost
          ).toFixed(2)
        );

      totalOrders += 1;

      totalQuantity +=
        quantity;

      totalRevenue +=
        revenue;

      totalCost +=
        cost;

      totalProfit +=
        profit;

      // ------------------------------------------------
      // PROVIDER PROFIT
      // ------------------------------------------------

      const provider =
        order.providerId;

      const providerKey =
        provider?._id
          ? provider._id.toString()
          : "unassigned";

      if (
        !profitByProvider[
          providerKey
        ]
      ) {
        profitByProvider[
          providerKey
        ] = {
          providerId:
            provider?._id ||
            null,

          providerName:
            provider?.name ||
            "Unassigned",

          orders: 0,

          revenue: 0,

          cost: 0,

          profit: 0
        };
      }

      profitByProvider[
        providerKey
      ].orders += 1;

      profitByProvider[
        providerKey
      ].revenue +=
        revenue;

      profitByProvider[
        providerKey
      ].cost +=
        cost;

      profitByProvider[
        providerKey
      ].profit +=
        profit;

      // ------------------------------------------------
      // SERVICE PROFIT
      // ------------------------------------------------

      const serviceKey =
        service?._id
          ? service._id.toString()
          : "unknown";

      if (
        !profitByService[
          serviceKey
        ]
      ) {
        profitByService[
          serviceKey
        ] = {
          serviceId:
            service?._id ||
            null,

          serviceName:
            service?.name ||
            "Unknown",

          orders: 0,

          revenue: 0,

          cost: 0,

          profit: 0
        };
      }

      profitByService[
        serviceKey
      ].orders += 1;

      profitByService[
        serviceKey
      ].revenue +=
        revenue;

      profitByService[
        serviceKey
      ].cost +=
        cost;

      profitByService[
        serviceKey
      ].profit +=
        profit;

      // ------------------------------------------------
      // DAILY PROFIT
      // ------------------------------------------------

      if (order.createdAt) {
        const date =
          new Date(
            order.createdAt
          )
            .toISOString()
            .split("T")[0];

        if (
          !dailyProfit[date]
        ) {
          dailyProfit[date] = {
            date,
            orders: 0,
            revenue: 0,
            cost: 0,
            profit: 0
          };
        }

        dailyProfit[date].orders +=
          1;

        dailyProfit[date].revenue +=
          revenue;

        dailyProfit[date].cost +=
          cost;

        dailyProfit[date].profit +=
          profit;
      }

      // ------------------------------------------------
      // ORDER LEVEL PROFIT
      // ------------------------------------------------

      profitOrders.push({
        orderId:
          order._id,

        serviceId:
          service?._id ||
          null,

        serviceName:
          service?.name ||
          null,

        providerId:
          provider?._id ||
          null,

        providerName:
          provider?.name ||
          null,

        quantity,

        revenue:
          Number(
            revenue.toFixed(2)
          ),

        cost,

        profit,

        status:
          order.status,

        createdAt:
          order.createdAt
      });
    }

    // --------------------------------------------------
    // ROUND TOTALS
    // --------------------------------------------------

    totalRevenue =
      Number(
        totalRevenue.toFixed(2)
      );

    totalCost =
      Number(
        totalCost.toFixed(2)
      );

    totalProfit =
      Number(
        totalProfit.toFixed(2)
      );

    // --------------------------------------------------
    // ROUND PROVIDER DATA
    // --------------------------------------------------

    const providerProfit =
      Object.values(
        profitByProvider
      ).map(
        (provider) => ({
          providerId:
            provider.providerId,

          providerName:
            provider.providerName,

          orders:
            provider.orders,

          revenue:
            Number(
              provider.revenue.toFixed(2)
            ),

          cost:
            Number(
              provider.cost.toFixed(2)
            ),

          profit:
            Number(
              provider.profit.toFixed(2)
            )
        })
      );

    // --------------------------------------------------
    // ROUND SERVICE DATA
    // --------------------------------------------------

    const serviceProfit =
      Object.values(
        profitByService
      ).map(
        (service) => ({
          serviceId:
            service.serviceId,

          serviceName:
            service.serviceName,

          orders:
            service.orders,

          revenue:
            Number(
              service.revenue.toFixed(2)
            ),

          cost:
            Number(
              service.cost.toFixed(2)
            ),

          profit:
            Number(
              service.profit.toFixed(2)
            )
        })
      );

    // --------------------------------------------------
    // ROUND DAILY DATA
    // --------------------------------------------------

    const dailyProfitData =
      Object.values(
        dailyProfit
      ).map(
        (day) => ({
          date:
            day.date,

          orders:
            day.orders,

          revenue:
            Number(
              day.revenue.toFixed(2)
            ),

          cost:
            Number(
              day.cost.toFixed(2)
            ),

          profit:
            Number(
              day.profit.toFixed(2)
            )
        })
      );

    // --------------------------------------------------
    // PROFIT MARGIN
    // --------------------------------------------------

    const profitMargin =
      totalRevenue > 0
        ? Number(
            (
              (
                totalProfit /
                totalRevenue
              ) *
              100
            ).toFixed(2)
          )
        : 0;

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Profit report generated successfully",

      filters: {
        startDate:
          startDate || null,

        endDate:
          endDate || null,

        status:
          status || null,

        serviceId:
          serviceId || null,

        providerId:
          providerId || null,

        userId:
          userId || null,

        resellerId:
          resellerId || null
      },

      summary: {
        totalOrders,

        totalQuantity,

        totalRevenue,

        totalCost,

        totalProfit,

        profitMargin
      },

      providerProfit,

      serviceProfit,

      dailyProfit:
        dailyProfitData,

      orders:
        profitOrders
    });

  } catch (error) {
    console.error(
      "GET PROFIT REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to generate profit report",

      error:
        error.message
    });
  }
};


// ======================================================
// TAX REPORT
// ======================================================

const getTaxReport = async (
  req,
  res
) => {
  try {
    console.log(
      "========== TAX REPORT START =========="
    );

    const {
      startDate,
      endDate,
      status,
      userId,
      providerId,
      resellerId,
      taxRate
    } = req.query;

    // --------------------------------------------------
    // TAX RATE
    // --------------------------------------------------

    const rate =
      taxRate !== undefined
        ? Number(taxRate)
        : 0;

    if (
      Number.isNaN(rate) ||
      rate < 0 ||
      rate > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "taxRate must be a number between 0 and 100"
      });
    }

    // --------------------------------------------------
    // FILTER
    // --------------------------------------------------

    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte =
          new Date(
            `${startDate}T00:00:00.000Z`
          );
      }

      if (endDate) {
        filter.createdAt.$lte =
          new Date(
            `${endDate}T23:59:59.999Z`
          );
      }
    }

    if (status) {
      filter.status = status;
    }

    if (userId) {
      filter.userId = userId;
    }

    if (providerId) {
      filter.providerId = providerId;
    }

    if (resellerId) {
      filter.resellerId = resellerId;
    }

    // --------------------------------------------------
    // GET ORDERS
    // --------------------------------------------------

    const orders =
      await Order.find(filter)
        .sort({
          createdAt: -1
        })
        .lean();

    // --------------------------------------------------
    // CALCULATE TAX
    // --------------------------------------------------

    let totalOrders = 0;

    let totalRevenue = 0;

    let totalTax = 0;

    let totalAfterTax = 0;

    const statusTax = {};

    const dailyTax = {};

    const taxOrders = [];

    orders.forEach((order) => {
      const revenue =
        Number(order.charge) || 0;

      const taxAmount =
        Number(
          (
            revenue *
            rate /
            100
          ).toFixed(2)
        );

      const amountAfterTax =
        Number(
          (
            revenue +
            taxAmount
          ).toFixed(2)
        );

      totalOrders += 1;

      totalRevenue +=
        revenue;

      totalTax +=
        taxAmount;

      totalAfterTax +=
        amountAfterTax;

      // ----------------------------------------------
      // STATUS TAX
      // ----------------------------------------------

      const orderStatus =
        order.status ||
        "unknown";

      if (!statusTax[orderStatus]) {
        statusTax[orderStatus] = {
          orders: 0,
          revenue: 0,
          tax: 0
        };
      }

      statusTax[
        orderStatus
      ].orders += 1;

      statusTax[
        orderStatus
      ].revenue +=
        revenue;

      statusTax[
        orderStatus
      ].tax +=
        taxAmount;

      // ----------------------------------------------
      // DAILY TAX
      // ----------------------------------------------

      if (order.createdAt) {
        const date =
          new Date(
            order.createdAt
          )
            .toISOString()
            .split("T")[0];

        if (!dailyTax[date]) {
          dailyTax[date] = {
            date,
            orders: 0,
            revenue: 0,
            tax: 0
          };
        }

        dailyTax[date].orders +=
          1;

        dailyTax[date].revenue +=
          revenue;

        dailyTax[date].tax +=
          taxAmount;
      }

      // ----------------------------------------------
      // ORDER TAX
      // ----------------------------------------------

      taxOrders.push({
        orderId:
          order._id,

        status:
          order.status,

        charge:
          Number(
            revenue.toFixed(2)
          ),

        taxRate:
          rate,

        taxAmount,

        amountAfterTax,

        createdAt:
          order.createdAt
      });
    });

    // --------------------------------------------------
    // ROUND TOTALS
    // --------------------------------------------------

    totalRevenue =
      Number(
        totalRevenue.toFixed(2)
      );

    totalTax =
      Number(
        totalTax.toFixed(2)
      );

    totalAfterTax =
      Number(
        totalAfterTax.toFixed(2)
      );

    // --------------------------------------------------
    // STATUS DATA
    // --------------------------------------------------

    const statusTaxData =
      Object.entries(
        statusTax
      ).map(
        ([status, data]) => ({
          status,

          orders:
            data.orders,

          revenue:
            Number(
              data.revenue.toFixed(2)
            ),

          tax:
            Number(
              data.tax.toFixed(2)
            )
        })
      );

    // --------------------------------------------------
    // DAILY DATA
    // --------------------------------------------------

    const dailyTaxData =
      Object.values(
        dailyTax
      ).map(
        (day) => ({
          date:
            day.date,

          orders:
            day.orders,

          revenue:
            Number(
              day.revenue.toFixed(2)
            ),

          tax:
            Number(
              day.tax.toFixed(2)
            )
        })
      );

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Tax report generated successfully",

      filters: {
        startDate:
          startDate || null,

        endDate:
          endDate || null,

        status:
          status || null,

        userId:
          userId || null,

        providerId:
          providerId || null,

        resellerId:
          resellerId || null,

        taxRate:
          rate
      },

      summary: {
        totalOrders,

        totalRevenue,

        taxRate:
          rate,

        totalTax,

        totalAfterTax
      },

      statusTax:
        statusTaxData,

      dailyTax:
        dailyTaxData,

      orders:
        taxOrders
    });

  } catch (error) {
    console.error(
      "GET TAX REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to generate tax report",

      error:
        error.message
    });
  }
};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getSalesReport,
  getOrdersReport,
  getRevenueReport,
  getProviderPerformanceReport,
  getWalletReport,
  getProfitReport,
  getTaxReport
};