const mongoose = require("mongoose");
const Order = require("../models/Order");
const Service = require("../models/Service");
const Coupon = require("../models/Coupon");
const User = require("../models/User");

/**
 * Normalizes input status to lowercase snake_case for MongoDB
 */
const normalizeApiStatus = (status) => {
  if (!status) return undefined;
  const s = String(status).toLowerCase().replace(/[\s-]/g, "_");
  if (s === "cancelled") return "canceled";
  if (s === "inprogress") return "in_progress";
  if (s === "complete") return "completed";
  return s;
};

/**
 * GET /api/order
 * Fetch all orders with optional filtering by status, search, provider, category, and date
 */
const getOrders = async (req, res) => {
  try {
    const { status, provider, category, search, startDate, endDate } = req.query;
    const query = {};

    // Customer session isolation: non-admins only see their own orders
    if (req.user && req.user.role !== "admin") {
      const userConditions = [
        { userId: req.user._id },
        { user: req.user.name },
        { user: req.user.email },
      ];
      query.$or = userConditions;
    }

    if (status && status !== "all") {
      const normalizedStatus = normalizeApiStatus(status);
      if (normalizedStatus) {
        query.status = normalizedStatus;
      }
    }

    if (provider && provider !== "all") {
      const providerConditions = [{ provider: provider }];
      if (mongoose.Types.ObjectId.isValid(provider)) {
        providerConditions.push({ providerId: provider });
      }
      if (query.$or) {
        query.$and = query.$and || [];
        query.$and.push({ $or: query.$or }, { $or: providerConditions });
        delete query.$or;
      } else {
        query.$or = providerConditions;
      }
    }

    if (category && category !== "all") {
      query.category = category;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      const regex = { $regex: term, $options: "i" };
      const searchConditions = [
        { orderId: regex },
        { user: regex },
        { service: regex },
        { link: regex },
        { providerOrderId: regex },
        { provider: regex },
      ];
      if (mongoose.Types.ObjectId.isValid(term)) {
        searchConditions.push({ _id: term });
      }

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Get Orders Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

/**
 * GET /api/order/:id
 * Fetch single order details by ObjectId or orderId
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    let order = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderId: id });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Role-based authorization: non-admin cannot view other users' orders
    if (req.user && req.user.role !== "admin") {
      const isOwnOrder =
        (order.userId && String(order.userId) === String(req.user._id)) ||
        (order.user && (order.user === req.user.name || order.user === req.user.email));
      if (!isOwnOrder) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You are not authorized to view this order",
        });
      }
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Get Order By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order",
    });
  }
};

/**
 * POST /api/order
 * Create a new order (customer or manual admin order)
 */
const createOrder = async (req, res) => {
  try {
    const {
      serviceId,
      service,
      link,
      quantity,
      user,
      userId,
      category,
      provider,
      providerId,
      charge,
      cost,
      startCount,
      remains,
      status,
      isDripFeed,
      dripRuns,
      dripInterval,
    } = req.body;

    if (!link || !quantity) {
      return res.status(400).json({
        success: false,
        message: "Target link and quantity are required",
      });
    }

    let serviceName = service;
    let serviceCategory = category || "General";
    let providerName = provider || "Direct";
    let calculatedCharge = Number(charge);
    let calculatedCost = Number(cost);

    if (serviceId) {
      let serviceDoc = null;
      if (mongoose.Types.ObjectId.isValid(serviceId)) {
        serviceDoc = await Service.findById(serviceId);
      }
      if (!serviceDoc && service) {
        serviceDoc = await Service.findOne({ name: service });
      }

      if (serviceDoc) {
        if (!serviceName) serviceName = serviceDoc.name;
        if (!serviceCategory) serviceCategory = serviceDoc.category;
        if (!providerName || providerName === "Direct") providerName = serviceDoc.provider;
        if (isNaN(calculatedCharge) || calculatedCharge <= 0) {
          calculatedCharge = (Number(quantity) * (serviceDoc.rate || 0)) / 1000;
        }
        if (isNaN(calculatedCost) || calculatedCost <= 0) {
          calculatedCost = (Number(quantity) * (serviceDoc.cost || 0)) / 1000;
        }
      }
    }

    if (isNaN(calculatedCharge)) calculatedCharge = 0;
    if (isNaN(calculatedCost)) calculatedCost = 0;

    let appliedCoupon = null;
    const inputCouponCode = req.body.couponCode || req.body.coupon;
    if (inputCouponCode && typeof inputCouponCode === "string" && inputCouponCode.trim()) {
      const cleanCode = inputCouponCode.trim().toUpperCase();
      const couponDoc = await Coupon.findOne({ code: cleanCode });
      if (!couponDoc) {
        return res.status(404).json({ success: false, message: `Invalid coupon code '${cleanCode}'` });
      }
      if (!couponDoc.isActive || couponDoc.status === "Disabled") {
        return res.status(400).json({ success: false, message: `Coupon '${cleanCode}' is currently disabled` });
      }
      if (couponDoc.expiryDate && new Date(couponDoc.expiryDate).getTime() < Date.now()) {
        return res.status(400).json({ success: false, message: `Coupon '${cleanCode}' has expired` });
      }
      if (couponDoc.usedCount >= couponDoc.usageLimit) {
        return res.status(400).json({ success: false, message: `Coupon '${cleanCode}' usage limit has been reached` });
      }
      if (couponDoc.minOrderAmount > 0 && calculatedCharge < couponDoc.minOrderAmount) {
        return res.status(400).json({
          success: false,
          message: `Minimum order amount of ₹${couponDoc.minOrderAmount.toFixed(2)} required to apply coupon '${cleanCode}'`,
        });
      }
      let discount = 0;
      if (couponDoc.discountType === "percentage") {
        discount = (calculatedCharge * couponDoc.discountValue) / 100;
        if (couponDoc.maxDiscountAmount > 0) discount = Math.min(discount, couponDoc.maxDiscountAmount);
      } else {
        discount = Math.min(calculatedCharge, couponDoc.discountValue);
      }
      discount = Math.max(0, Number(discount.toFixed(2)));
      calculatedCharge = Math.max(0, Number((calculatedCharge - discount).toFixed(2)));
      await Coupon.findByIdAndUpdate(couponDoc._id, { $inc: { usedCount: 1 } });
      appliedCoupon = { code: couponDoc.code, discount };
    }

    // Role-based identity & anti-spoofing verification
    let targetUserId;
    let targetUserName;

    if (req.user && req.user.role !== "admin") {
      // Authenticated customer: strictly bind order to their own user identity
      if (userId && String(userId) !== String(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You cannot create orders on behalf of another user",
        });
      }
      if (user && user !== req.user.name && user !== req.user.email) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You cannot create orders on behalf of another user",
        });
      }
      targetUserId = req.user._id;
      targetUserName = req.user.name || req.user.email || "Customer";
    } else {
      // Admin: can specify target user or default to admin
      targetUserId = userId || req.user?._id;
      targetUserName = user || (req.user ? req.user.name || req.user.email : "Customer");
    }

    // Wallet balance verification and atomic deduction
    if (targetUserId) {
      const orderingUser = await User.findById(targetUserId);
      if (!orderingUser) {
        return res.status(404).json({
          success: false,
          message: "User account not found",
        });
      }

      const currentBalance = Number(orderingUser.balance || 0);

      // Enforce wallet balance check for customers
      if (req.user?.role !== "admin") {
        if (currentBalance < calculatedCharge) {
          return res.status(400).json({
            success: false,
            message: `Insufficient wallet balance. Required: ₹${calculatedCharge.toFixed(2)}, Current Balance: ₹${currentBalance.toFixed(2)}. Please add funds to place this order.`,
            required: calculatedCharge,
            currentBalance,
          });
        }
      }

      // Deduct charge from wallet if charge > 0
      if (calculatedCharge > 0) {
        await User.findByIdAndUpdate(orderingUser._id, {
          $inc: { balance: -calculatedCharge },
        });
      }
    }

    const newOrder = new Order({
      user: targetUserName,
      userId: targetUserId,
      service: serviceName || "General Service",
      serviceId,
      category: serviceCategory,
      link: String(link).trim(),
      quantity: Number(quantity),
      charge: calculatedCharge,
      cost: calculatedCost,
      startCount: Number(startCount) || 0,
      remains: remains !== undefined ? Number(remains) : Number(quantity),
      provider: providerName,
      providerId,
      providerOrderId: req.body.providerOrderId || `PRV-${Date.now().toString().slice(-6)}`,
      status: status ? normalizeApiStatus(status) : "processing",
      refillStatus: "Available",
      isDripFeed: Boolean(isDripFeed),
      dripFeed: isDripFeed
        ? {
            runs: Number(dripRuns) || 2,
            interval: Number(dripInterval) || 60,
            completedRuns: 0,
          }
        : undefined,
    });

    await newOrder.save();

    return res.status(201).json({
      success: true,
      order: newOrder,
      appliedCoupon: appliedCoupon || undefined,
      message: "Order created successfully",
    });
  } catch (error) {
    console.error("Create Order Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
};

/**
 * POST /api/order/mass or POST /api/mass-order
 * Create multiple orders in bulk
 */
const createMassOrders = async (req, res) => {
  try {
    const ordersList = req.body.orders;
    if (!Array.isArray(ordersList) || ordersList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "An array of orders is required",
      });
    }

    let targetUserId = req.user?._id;
    let targetUserName = req.user ? req.user.name || req.user.email : "Customer";

    if (req.user && req.user.role !== "admin") {
      // Non-admin customers cannot create orders on behalf of other users
      for (const item of ordersList) {
        if (item.userId && String(item.userId) !== String(req.user._id)) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You cannot create orders on behalf of another user",
          });
        }
        if (item.user && item.user !== req.user.name && item.user !== req.user.email) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You cannot create orders on behalf of another user",
          });
        }
      }
      targetUserId = req.user._id;
      targetUserName = req.user.name || req.user.email || "Customer";
    }

    // Validate items and calculate total mass charge
    let totalMassCharge = 0;
    const validatedItems = [];

    for (const item of ordersList) {
      if (!item.link || !item.quantity) continue;
      let itemCharge = Number(item.charge || 0);
      let itemCost = Number(item.cost || 0);
      let itemServiceName = item.service;
      let itemCategory = item.category || "Bulk Import";
      let itemProvider = item.provider || "Direct";

      if (item.serviceId) {
        let sDoc = null;
        if (mongoose.Types.ObjectId.isValid(item.serviceId)) {
          sDoc = await Service.findById(item.serviceId);
        }
        if (!sDoc && item.service) {
          sDoc = await Service.findOne({ name: item.service });
        }
        if (sDoc) {
          if (!itemServiceName) itemServiceName = sDoc.name;
          if (!item.category) itemCategory = sDoc.category;
          if (!item.provider || item.provider === "Direct") itemProvider = sDoc.provider;
          if (isNaN(itemCharge) || itemCharge <= 0) {
            itemCharge = (Number(item.quantity) * (sDoc.rate || 0)) / 1000;
          }
          if (isNaN(itemCost) || itemCost <= 0) {
            itemCost = (Number(item.quantity) * (sDoc.cost || 0)) / 1000;
          }
        }
      }

      totalMassCharge += itemCharge;
      validatedItems.push({
        ...item,
        service: itemServiceName || `Service #${item.serviceId || "Custom"}`,
        category: itemCategory,
        provider: itemProvider,
        charge: itemCharge,
        cost: itemCost,
      });
    }

    if (targetUserId) {
      const orderingUser = await User.findById(targetUserId);
      if (!orderingUser) {
        return res.status(404).json({ success: false, message: "User account not found" });
      }

      const currentBalance = Number(orderingUser.balance || 0);
      if (req.user?.role !== "admin") {
        if (currentBalance < totalMassCharge) {
          return res.status(400).json({
            success: false,
            message: `Insufficient wallet balance for mass orders. Required: ₹${totalMassCharge.toFixed(2)}, Current Balance: ₹${currentBalance.toFixed(2)}. Please add funds to place this order.`,
            required: totalMassCharge,
            currentBalance,
          });
        }
      }

      if (totalMassCharge > 0) {
        await User.findByIdAndUpdate(orderingUser._id, {
          $inc: { balance: -totalMassCharge },
        });
      }
    }

    const createdOrders = [];
    for (const item of validatedItems) {
      const order = new Order({
        user: targetUserName,
        userId: targetUserId,
        service: item.service,
        serviceId: item.serviceId,
        category: item.category,
        link: String(item.link).trim(),
        quantity: Number(item.quantity) || 1000,
        charge: Number(item.charge) || 0,
        cost: Number(item.cost) || 0,
        startCount: Number(item.startCount) || 0,
        remains: Number(item.quantity) || 1000,
        provider: item.provider,
        providerOrderId: `PRV-CSV-${Date.now().toString().slice(-6)}`,
        status: "processing",
        refillStatus: "Not Applicable",
      });
      await order.save();
      createdOrders.push(order);
    }

    return res.status(201).json({
      success: true,
      count: createdOrders.length,
      orders: createdOrders,
      totalCharge: totalMassCharge,
      message: `Successfully created ${createdOrders.length} orders`,
    });
  } catch (error) {
    console.error("Mass Order Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process mass orders",
    });
  }
};

/**
 * PATCH /api/order/:id/status
 * Update order status or parameters (link, startCount, remains)
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, link, startCount, remains } = req.body;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderId: id });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (status) {
      const normalized = normalizeApiStatus(status);
      if (normalized) {
        order.status = normalized;
        if (order.status === "completed") {
          order.remains = 0;
        }
      }
    }
    if (link) order.link = String(link).trim();
    if (startCount !== undefined) order.startCount = Number(startCount);
    if (remains !== undefined) order.remains = Number(remains);

    order.logs.push({
      action: `Status updated to ${order.status}`,
      status: "Success",
      details: `Order status changed to ${order.status}`,
      timestamp: new Date(),
    });

    await order.save();

    return res.status(200).json({
      success: true,
      order,
      message: `Order #${order.orderId || id} status updated to ${order.status}`,
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
    });
  }
};

/**
 * POST /api/order/:id/cancel
 * Cancel order and refund to customer
 */
const cancelAndRefundOrder = async (req, res) => {
  try {
    const { id } = req.params;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderId: id });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.status = "refunded";
    order.remains = order.quantity;
    order.logs.push({
      action: "Order Canceled & Refunded",
      status: "Success",
      details: `Admin cancelled order #${order.orderId || id} and refunded charge to wallet`,
      timestamp: new Date(),
    });

    await order.save();

    if (order.charge > 0 && order.userId) {
      await User.findByIdAndUpdate(order.userId, {
        $inc: { balance: order.charge },
      });
    }

    return res.status(200).json({
      success: true,
      order,
      message: `Order #${order.orderId || id} canceled and refunded successfully`,
    });
  } catch (error) {
    console.error("Cancel Order Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel order",
    });
  }
};

/**
 * POST /api/order/:id/refill
 * Place refill request for order
 */
const refillOrder = async (req, res) => {
  try {
    const { id } = req.params;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderId: id });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const refillId = `RF-${Math.floor(1000 + Math.random() * 9000)}`;
    order.refillStatus = "Requested";
    order.logs.push({
      action: "Refill Requested",
      status: "Success",
      details: `Refill #${refillId} requested for order`,
      timestamp: new Date(),
    });

    await order.save();

    return res.status(200).json({
      success: true,
      refillId,
      order,
      message: `Refill request #${refillId} placed successfully`,
    });
  } catch (error) {
    console.error("Refill Order Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to request refill",
    });
  }
};

/**
 * POST /api/order/:id/sync
 * Sync order state
 */
const syncOrder = async (req, res) => {
  try {
    const { id } = req.params;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderId: id });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.logs.push({
      action: "Provider Sync Check",
      status: "Success",
      details: `Order synced with provider ${order.provider}`,
      timestamp: new Date(),
    });

    await order.save();

    return res.status(200).json({
      success: true,
      order,
      message: "Order status synchronized",
    });
  } catch (error) {
    console.error("Sync Order Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync order",
    });
  }
};

/**
 * GET /api/order/:id/logs
 * Retrieve order audit logs / timeline
 */
const getOrderLogs = async (req, res) => {
  try {
    const { id } = req.params;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderId: id });
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Role-based authorization: non-admin cannot view other users' order logs
    if (req.user && req.user.role !== "admin") {
      const isOwnOrder =
        (order.userId && String(order.userId) === String(req.user._id)) ||
        (order.user && (order.user === req.user.name || order.user === req.user.email));
      if (!isOwnOrder) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You are not authorized to view this order",
        });
      }
    }

    return res.status(200).json({
      success: true,
      logs: order.logs || [],
    });
  } catch (error) {
    console.error("Get Order Logs Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch order logs",
    });
  }
};

/**
 * DELETE /api/order/:id
 * Delete order by ObjectId or orderId
 */
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    let deleted = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deleted = await Order.findByIdAndDelete(id);
    }
    if (!deleted) {
      deleted = await Order.findOneAndDelete({ orderId: id });
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Delete Order Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete order",
    });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  createMassOrders,
  updateOrderStatus,
  cancelAndRefundOrder,
  refillOrder,
  syncOrder,
  getOrderLogs,
  deleteOrder,
};
