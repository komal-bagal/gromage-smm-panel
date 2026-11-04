const mongoose = require("mongoose");
const User = require("../models/User");
const Service = require("../models/Service");
const Provider = require("../models/Provider");
const Order = require("../models/Order");

/**
 * Format currency amount as INR string
 */
const formatCurrency = (amount) => {
  const val = Number(amount) || 0;
  return `₹${val.toLocaleString("en-IN", {
    minimumFractionDigits: val % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Relative time formatter
 */
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "Recently";
  const now = new Date();
  const date = new Date(timestamp);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mins ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} days ago`;

  return date.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
};

/**
 * GET /api/dashboard or GET /api/admin/dashboard
 * Aggregates real MongoDB data for administrative KPI metrics, charts, widgets, and activity
 */
const getDashboardMetrics = async (req, res) => {
  try {
    const { period = "7days" } = req.query;

    // 1. KPI Counts
    const [
      totalUsers,
      totalServices,
      activeServices,
      totalOrders,
      pendingOrders,
      completedOrders,
      revenueResult,
    ] = await Promise.all([
      User.countDocuments(),
      Service.countDocuments(),
      Service.countDocuments({ status: "active" }),
      Order.countDocuments(),
      Order.countDocuments({
        status: { $in: ["pending", "processing", "in_progress"] },
      }),
      Order.countDocuments({ status: "completed" }),
      Order.aggregate([
        {
          $match: {
            status: { $in: ["completed", "processing", "in_progress", "partial"] },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$charge" },
          },
        },
      ]),
    ]);

    const revenueRaw = revenueResult.length > 0 ? Number(revenueResult[0].totalRevenue || 0) : 0;
    const totalRevenue = formatCurrency(revenueRaw);

    // 2. Real Provider Balances Widget (max 5)
    const rawProviders = await Provider.find().sort({ createdAt: -1 }).limit(5);
    const providerBalances = await Promise.all(
      rawProviders.map(async (p) => {
        const dynamicServiceCount = await Service.countDocuments({
          $or: [{ providerId: p._id }, { provider: p.name }],
        });
        const currencySymbol = p.currency === "USD" ? "$" : p.currency === "INR" ? "₹" : `${p.currency} `;
        return {
          id: p._id,
          name: p.name,
          status: p.status === "active" ? "Active" : "Disabled",
          balance: `${currencySymbol}${(p.balance || 0).toFixed(2)}`,
          services: dynamicServiceCount,
          lastSync: p.lastSync || "Never",
        };
      })
    );

    // 3. Real Recent Orders Table (max 5)
    const rawRecentOrders = await Order.find().sort({ createdAt: -1 }).limit(5);
    const recentOrders = rawRecentOrders.map((o) => {
      let displayStatus = "Pending";
      if (o.status === "in_progress") displayStatus = "In Progress";
      else if (o.status) {
        displayStatus = o.status.charAt(0).toUpperCase() + o.status.slice(1);
      }
      return {
        id: o.orderId || String(o._id),
        user: o.user || "Customer",
        service: o.service || "General Service",
        amount: formatCurrency(o.charge || 0),
        charge: o.charge || 0,
        quantity: o.quantity || 0,
        status: displayStatus,
        createdAt: o.createdAt
          ? new Date(o.createdAt).toISOString().replace("T", " ").slice(0, 16)
          : "",
      };
    });

    // 4. Real Recent Activity Feed from actual Order Audit Logs
    const ordersWithLogs = await Order.find({ "logs.0": { $exists: true } })
      .sort({ updatedAt: -1 })
      .limit(10);

    const activities = [];
    for (const ord of ordersWithLogs) {
      for (const log of ord.logs || []) {
        activities.push({
          id: log._id ? String(log._id) : `${ord._id}-${log.timestamp}`,
          action: log.action || "Order Update",
          detail: `${log.details || log.action} (Order #${ord.orderId || ord._id})`,
          time: formatRelativeTime(log.timestamp),
          createdAt: log.timestamp || ord.updatedAt,
        });
      }
    }
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recentActivity = activities.slice(0, 5);

    // 5. Real Revenue Trend Chart Data for 7days, 30days, year
    const now = new Date();

    // --- 7 Days (Last 7 days daily) ---
    const sevenDaysList = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      sevenDaysList.push({
        name: dayNames[d.getDay()],
        start: startOfDay,
        end: endOfDay,
        revenue: 0,
        orders: 0,
      });
    }

    // --- 30 Days (4 weekly intervals) ---
    const thirtyDaysList = [];
    for (let i = 3; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - (i + 1) * 7);
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      thirtyDaysList.push({
        name: `Week ${4 - i}`,
        start,
        end,
        revenue: 0,
        orders: 0,
      });
    }

    // --- Year (12 months of current year) ---
    const yearMonthsList = [];
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    for (let m = 0; m < 12; m++) {
      const start = new Date(now.getFullYear(), m, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), m + 1, 0, 23, 59, 59, 999);
      yearMonthsList.push({
        name: monthNames[m],
        start,
        end,
        revenue: 0,
        orders: 0,
      });
    }

    // Fetch all non-cancelled orders for charting
    const chartOrders = await Order.find({
      status: { $in: ["completed", "processing", "in_progress", "partial"] },
    }).select("charge createdAt");

    for (const ord of chartOrders) {
      const ordDate = new Date(ord.createdAt);
      const chg = Number(ord.charge) || 0;

      // Match 7 days
      for (const bucket of sevenDaysList) {
        if (ordDate >= bucket.start && ordDate <= bucket.end) {
          bucket.revenue += chg;
          bucket.orders += 1;
        }
      }

      // Match 30 days
      for (const bucket of thirtyDaysList) {
        if (ordDate >= bucket.start && ordDate <= bucket.end) {
          bucket.revenue += chg;
          bucket.orders += 1;
        }
      }

      // Match Year
      for (const bucket of yearMonthsList) {
        if (ordDate >= bucket.start && ordDate <= bucket.end) {
          bucket.revenue += chg;
          bucket.orders += 1;
        }
      }
    }

    const chart7days = sevenDaysList.map((b) => ({
      name: b.name,
      revenue: Number(b.revenue.toFixed(2)),
      orders: b.orders,
    }));

    const chart30days = thirtyDaysList.map((b) => ({
      name: b.name,
      revenue: Number(b.revenue.toFixed(2)),
      orders: b.orders,
    }));

    const chartYear = yearMonthsList.map((b) => ({
      name: b.name,
      revenue: Number(b.revenue.toFixed(2)),
      orders: b.orders,
    }));

    const revenueChartData = {
      "7days": chart7days,
      "30days": chart30days,
      year: chartYear,
    };

    const revenueChart = revenueChartData[period] || chart7days;

    // 6. Growth calculation (7-day vs previous 7-day orders)
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const [currentWeekOrders, prevWeekOrders] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Order.countDocuments({ createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } }),
    ]);

    let ordersGrowth = null;
    if (prevWeekOrders > 0) {
      const pct = Math.round(((currentWeekOrders - prevWeekOrders) / prevWeekOrders) * 100);
      ordersGrowth = `${pct >= 0 ? "+" : ""}${pct}% vs last week`;
    } else if (currentWeekOrders > 0) {
      ordersGrowth = `+100% vs last week`;
    }

    const metrics = {
      totalRevenue,
      revenueRaw,
      revenueGrowth: ordersGrowth,
      totalOrders,
      ordersGrowth,
      totalUsers,
      usersGrowth: null,
      activeServices,
      totalServices,
      pendingOrders,
      completedOrders,
      revenueChart,
      revenueChartData,
      providerBalances,
      recentOrders,
      recentActivity,
    };

    return res.status(200).json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error("Dashboard Metrics Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard metrics",
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardMetrics,
};
