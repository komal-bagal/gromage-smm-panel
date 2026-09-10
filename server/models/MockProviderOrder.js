const mongoose = require("mongoose");

const mockProviderOrderSchema = new mongoose.Schema(
  {
    providerOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    service: {
      type: String,
      required: true,
      trim: true
    },

    link: {
      type: String,
      required: true,
      trim: true
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "in_progress",
        "completed",
        "partial",
        "canceled",
        "failed"
      ],
      default: "processing"
    },

    startCount: {
      type: Number,
      default: 0,
      min: 0
    },

    remains: {
      type: Number,
      required: true,
      min: 0
    },

    refill: {
      type: Boolean,
      default: false
    },

    refillId: {
      type: String,
      default: null,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "MockProviderOrder",
  mockProviderOrderSchema
);