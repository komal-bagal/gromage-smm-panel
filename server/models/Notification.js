const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    type: {
      type: String,
      enum: [
        "order",
        "payment",
        "wallet",
        "ticket",
        "affiliate",
        "system",
        "promotion",
      ],
      default: "system",
      index: true,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// CREATE / REUSE MODEL
// =====================================================

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

// =====================================================
// EXPORT
// =====================================================

module.exports = Notification;