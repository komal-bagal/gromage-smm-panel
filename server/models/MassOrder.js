
const mongoose = require("mongoose");

const massOrderSchema =
  new mongoose.Schema(
    {
      // ======================================================
      // USER
      // ======================================================

      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
      },

      // ======================================================
      // BATCH NAME
      // ======================================================

      batchName: {
        type: String,
        trim: true,
        default: ""
      },

      // ======================================================
      // ORDERS CREATED
      // ======================================================

      orders: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order"
        }
      ],

      // ======================================================
      // TOTAL COUNTS
      // ======================================================

      totalOrders: {
        type: Number,
        default: 0
      },

      successfulOrders: {
        type: Number,
        default: 0
      },

      failedOrders: {
        type: Number,
        default: 0
      },

      // ======================================================
      // COST
      // ======================================================

      totalAmount: {
        type: Number,
        required: true,
        min: 0
      },

      // ======================================================
      // STATUS
      // ======================================================

      status: {
        type: String,
        enum: [
          "pending",
          "processing",
          "completed",
          "partial",
          "failed"
        ],
        default: "pending"
      },

      // ======================================================
      // RAW INPUT
      // ======================================================

      rawData: {
        type: String,
        default: ""
      },

      // ======================================================
      // NOTES
      // ======================================================

      notes: {
        type: String,
        trim: true,
        default: ""
      }
    },
    {
      timestamps: true
    }
  );

// ======================================================
// INDEXES
// ======================================================

massOrderSchema.index({
  user: 1,
  createdAt: -1
});

module.exports =
  mongoose.model(
    "MassOrder",
    massOrderSchema
  );
