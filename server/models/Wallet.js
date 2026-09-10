const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },

    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },

    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Wallet", walletSchema);