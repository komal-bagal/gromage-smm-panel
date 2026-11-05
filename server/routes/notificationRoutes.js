const express = require("express");

const {
  createNotification,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require("../controllers/notificationController");

const authMiddleware =
  require("../middleware/authMiddleware");

const router = express.Router();

// Create notification
router.post(
  "/",
  authMiddleware,
  createNotification
);

// Get logged-in user's notifications
router.get(
  "/my",
  authMiddleware,
  getMyNotifications
);

// Get unread notification count
router.get(
  "/unread-count",
  authMiddleware,
  getUnreadCount
);

// Mark one notification as read
router.put(
  "/:id/read",
  authMiddleware,
  markAsRead
);

// Mark all notifications as read
router.put(
  "/read-all",
  authMiddleware,
  markAllAsRead
);

// Delete notification
router.delete(
  "/:id",
  authMiddleware,
  deleteNotification
);

module.exports = router;