// =====================================================
// NOTIFICATION CONTROLLER
// =====================================================

const mongoose = require("mongoose");
const Notification = require("../models/Notification");

// =====================================================
// HELPERS
// =====================================================

const getUserId = (req) => {
  return req.userId || req.user?.id || req.user?._id || null;
};

const getRequestId = (req) => {
  return req.id || req.requestId || null;
};

const safeServerError = (res, req, message) => {
  const response = {
    success: false,
    message,
  };

  const requestId = getRequestId(req);

  if (requestId) {
    response.requestId = requestId;
  }

  return res.status(500).json(response);
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// =====================================================
// CREATE NOTIFICATION
// =====================================================

const createNotification = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const {
      title,
      message,
      type,
      metadata,
    } = req.body || {};

    // -------------------------------------------------
    // VALIDATE TITLE
    // -------------------------------------------------

    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    const cleanTitle = title.trim();

    if (cleanTitle.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Title must not exceed 200 characters",
      });
    }

    // -------------------------------------------------
    // VALIDATE MESSAGE
    // -------------------------------------------------

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const cleanMessage = message.trim();

    if (cleanMessage.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Message must not exceed 5000 characters",
      });
    }

    // -------------------------------------------------
    // VALIDATE TYPE
    // -------------------------------------------------

    const notificationType =
      typeof type === "string" && type.trim()
        ? type.trim()
        : "system";

    if (notificationType.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Notification type is too long",
      });
    }

    // -------------------------------------------------
    // VALIDATE METADATA
    // -------------------------------------------------

    let cleanMetadata = {};

    if (
      metadata !== undefined &&
      metadata !== null
    ) {
      if (
        typeof metadata !== "object" ||
        Array.isArray(metadata)
      ) {
        return res.status(400).json({
          success: false,
          message: "Metadata must be an object",
        });
      }

      cleanMetadata = metadata;
    }

    // -------------------------------------------------
    // CREATE
    // -------------------------------------------------

    const notification =
      await Notification.create({
        userId,
        title: cleanTitle,
        message: cleanMessage,
        type: notificationType,
        metadata: cleanMetadata,
      });

    return res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });

  } catch (error) {
    console.error(
      "CREATE NOTIFICATION ERROR:",
      error
    );

    return safeServerError(
      res,
      req,
      "Failed to create notification"
    );
  }
};

// =====================================================
// GET MY NOTIFICATIONS
// =====================================================

const getMyNotifications = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // -------------------------------------------------
    // PAGE
    // -------------------------------------------------

    const requestedPage =
      Number.parseInt(
        req.query.page,
        10
      );

    const page =
      Number.isFinite(requestedPage) &&
      requestedPage > 0
        ? requestedPage
        : 1;

    // -------------------------------------------------
    // LIMIT
    // -------------------------------------------------

    const requestedLimit =
      Number.parseInt(
        req.query.limit,
        10
      );

    const limit =
      Number.isFinite(requestedLimit) &&
      requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 10;

    const skip =
      (page - 1) * limit;

    // -------------------------------------------------
    // FETCH
    // -------------------------------------------------

    const notifications =
      await Notification.find({
        userId,
      })
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean();

    const total =
      await Notification.countDocuments({
        userId,
      });

    return res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error(
      "GET MY NOTIFICATIONS ERROR:",
      error
    );

    return safeServerError(
      res,
      req,
      "Failed to fetch notifications"
    );
  }
};

// =====================================================
// GET UNREAD COUNT
// =====================================================

const getUnreadCount = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const count =
      await Notification.countDocuments({
        userId,
        isRead: false,
      });

    return res.status(200).json({
      success: true,
      unreadCount: count,
    });

  } catch (error) {
    console.error(
      "GET UNREAD COUNT ERROR:",
      error
    );

    return safeServerError(
      res,
      req,
      "Failed to get unread notification count"
    );
  }
};

// =====================================================
// MARK ONE NOTIFICATION AS READ
// =====================================================

const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // -------------------------------------------------
    // VALIDATE ID
    // -------------------------------------------------

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    // -------------------------------------------------
    // UPDATE ONLY OWNER'S NOTIFICATION
    // -------------------------------------------------

    const notification =
      await Notification.findOneAndUpdate(
        {
          _id: id,
          userId,
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        },
        {
          new: true,
        }
      );

    // -------------------------------------------------
    // NOT FOUND
    // -------------------------------------------------

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });

  } catch (error) {
    console.error(
      "MARK NOTIFICATION READ ERROR:",
      error
    );

    return safeServerError(
      res,
      req,
      "Failed to mark notification as read"
    );
  }
};

// =====================================================
// MARK ALL NOTIFICATIONS AS READ
// =====================================================

const markAllAsRead = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result =
      await Notification.updateMany(
        {
          userId,
          isRead: false,
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        }
      );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      modifiedCount:
        result.modifiedCount || 0,
    });

  } catch (error) {
    console.error(
      "MARK ALL NOTIFICATIONS READ ERROR:",
      error
    );

    return safeServerError(
      res,
      req,
      "Failed to mark all notifications as read"
    );
  }
};

// =====================================================
// DELETE NOTIFICATION
// =====================================================

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // -------------------------------------------------
    // VALIDATE ID
    // -------------------------------------------------

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
    }

    // -------------------------------------------------
    // DELETE ONLY OWNER'S NOTIFICATION
    // -------------------------------------------------

    const notification =
      await Notification.findOneAndDelete({
        _id: id,
        userId,
      });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });

  } catch (error) {
    console.error(
      "DELETE NOTIFICATION ERROR:",
      error
    );

    return safeServerError(
      res,
      req,
      "Failed to delete notification"
    );
  }
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
  createNotification,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};