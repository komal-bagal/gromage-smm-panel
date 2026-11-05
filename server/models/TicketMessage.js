const mongoose = require("mongoose");

// ======================================================
// TICKET MESSAGE SCHEMA
// ======================================================

const ticketMessageSchema = new mongoose.Schema(
  {
    // ==================================================
    // TICKET
    // ==================================================

    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },

    // ==================================================
    // MESSAGE SENDER
    // ==================================================

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ==================================================
    // SENDER TYPE
    // ==================================================

    senderType: {
      type: String,
      enum: ["user", "admin", "staff"],
      required: true,
    },

    // ==================================================
    // MESSAGE
    // ==================================================

    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5000,
    },

    // ==================================================
    // OPTIONAL ATTACHMENT
    // ==================================================

    attachmentUrl: {
      type: String,
      default: null,
      trim: true,
    },

    // ==================================================
    // READ STATUS
    // ==================================================

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// INDEXES
// ======================================================

ticketMessageSchema.index({
  ticketId: 1,
  createdAt: 1,
});

ticketMessageSchema.index({
  senderId: 1,
  createdAt: -1,
});

// ======================================================
// CREATE / REUSE MODEL
// ======================================================

const TicketMessage =
  mongoose.models.TicketMessage ||
  mongoose.model(
    "TicketMessage",
    ticketMessageSchema
  );

// ======================================================
// MODEL DEBUG
// ======================================================

console.log(
  "========== TICKET MESSAGE MODEL LOADED =========="
);

console.log(
  "TicketMessage:",
  TicketMessage
);

console.log(
  "TicketMessage type:",
  typeof TicketMessage
);

console.log(
  "TicketMessage.create:",
  typeof TicketMessage.create
);

console.log(
  "TicketMessage.find:",
  typeof TicketMessage.find
);

console.log(
  "TicketMessage.findOne:",
  typeof TicketMessage.findOne
);

console.log(
  "mongoose.models.TicketMessage:",
  mongoose.models.TicketMessage
);

console.log(
  "================================================="
);

// ======================================================
// EXPORT
// ======================================================

module.exports = TicketMessage;