const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
    },
    providerServiceId: {
      type: String,
      trim: true,
      default: "",
    },
    cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    rate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    min: {
      type: Number,
      default: 100,
      min: 1,
    },
    max: {
      type: Number,
      default: 10000,
      min: 1,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Service", serviceSchema);
