
const mongoose = require("mongoose");

// ======================================================
// TICKET SCHEMA
// ======================================================

const ticketSchema = new mongoose.Schema(
  {
    // --------------------------------------------------
    // TICKET NUMBER
    // --------------------------------------------------

    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    // --------------------------------------------------
    // USER
    // --------------------------------------------------

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // --------------------------------------------------
    // SUBJECT
    // --------------------------------------------------

    subject: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },

    // --------------------------------------------------
    // CATEGORY
    // --------------------------------------------------

    category: {
      type: String,
      enum: [
        "order",
        "payment",
        "account",
        "service",
        "wallet",
        "affiliate",
        "technical",
        "other",
      ],
      default: "other",
      index: true,
    },

    // --------------------------------------------------
    // PRIORITY
    // --------------------------------------------------

    priority: {
      type: String,
      enum: [
        "low",
        "medium",
        "high",
        "urgent",
      ],
      default: "medium",
      index: true,
    },

    // --------------------------------------------------
    // STATUS
    // --------------------------------------------------

    status: {
      type: String,
      enum: [
        "open",
        "pending",
        "in_progress",
        "resolved",
        "closed",
      ],
      default: "open",
      index: true,
    },

    // --------------------------------------------------
    // RELATED ORDER
    // --------------------------------------------------

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    // --------------------------------------------------
    // ASSIGNED ADMIN / STAFF
    // --------------------------------------------------

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // --------------------------------------------------
    // LAST MESSAGE
    // --------------------------------------------------

    lastMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    // --------------------------------------------------
    // CLOSED INFORMATION
    // --------------------------------------------------

    closedAt: {
      type: Date,
      default: null,
    },

    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// INDEXES
// ======================================================

ticketSchema.index({
  userId: 1,
  createdAt: -1,
});

ticketSchema.index({
  status: 1,
  priority: 1,
  createdAt: -1,
});

ticketSchema.index({
  assignedTo: 1,
  status: 1,
  createdAt: -1,
});

// ======================================================
// MODEL
// ======================================================

const Ticket = mongoose.model(
  "Ticket",
  ticketSchema
);

// ======================================================
// DEBUG
// ======================================================

console.log(
  "========== TICKET MODEL LOADED =========="
);

console.log(
  "Ticket model type:",
  typeof Ticket
);

console.log(
  "Ticket model name:",
  Ticket.modelName
);

console.log(
  "Ticket.find:",
  typeof Ticket.find
);

console.log(
  "Ticket.findOne:",
  typeof Ticket.findOne
);

console.log(
  "Ticket.findById:",
  typeof Ticket.findById
);

console.log(
  "Ticket.create:",
  typeof Ticket.create
);

console.log(
  "========================================="
);

// ======================================================
// EXPORT
// ======================================================

module.exports = Ticket;
