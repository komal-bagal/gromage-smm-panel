const mongoose = require("mongoose");

const adminActivityLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    action: {
      type: String,
      required: true,
      trim: true
    },

    targetType: {
      type: String,
      trim: true,
      default: null
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },

    description: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "AdminActivityLog",
  adminActivityLogSchema
);