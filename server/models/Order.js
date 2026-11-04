const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      trim: true,
      index: true,
    },
    user: {
      type: String,
      required: true,
      trim: true,
      default: "Customer",
    },
    userId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "User",
    },
    service: {
      type: String,
      required: true,
      trim: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Service",
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    link: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    charge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    startCount: {
      type: Number,
      default: 0,
    },
    remains: {
      type: Number,
      default: 0,
    },
    provider: {
      type: String,
      trim: true,
      default: "Direct",
    },
    providerId: {
      type: mongoose.Schema.Types.Mixed,
      ref: "Provider",
    },
    providerOrderId: {
      type: String,
      trim: true,
      default: "",
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
        "refunded",
      ],
      default: "pending",
    },
    refillStatus: {
      type: String,
      enum: [
        "Not Applicable",
        "Available",
        "Requested",
        "Approved",
        "Rejected",
        "Completed",
      ],
      default: "Not Applicable",
    },
    isDripFeed: {
      type: Boolean,
      default: false,
    },
    dripFeed: {
      runs: { type: Number },
      interval: { type: Number },
      completedRuns: { type: Number, default: 0 },
    },
    logs: [
      {
        action: { type: String, required: true },
        status: { type: String, default: "Success" },
        details: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Auto-generate human-readable orderId if not provided
orderSchema.pre("save", function () {
  if (!this.orderId) {
    this.orderId = `ORD-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
  }
  if (this.isNew && (!this.logs || this.logs.length === 0)) {
    this.logs = [
      {
        action: "Order Placed",
        status: "Success",
        details: "Order created successfully",
        timestamp: new Date(),
      },
    ];
  }
  if (this.remains === undefined || this.remains === null) {
    this.remains = this.quantity;
  }
});

module.exports = mongoose.model("Order", orderSchema);
