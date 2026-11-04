const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    },
    name: {
      type: String,
      required: [true, "Attachment file name is required"],
      trim: true,
      maxlength: [255, "Attachment name too long"],
    },
    size: {
      type: String,
      default: "0 KB",
    },
    sizeBytes: {
      type: Number,
      default: 0,
      max: [10 * 1024 * 1024, "Attachment cannot exceed 10MB"],
    },
    type: {
      type: String,
      default: "application/octet-stream",
    },
    extension: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
    },
    uploadedBy: {
      type: String,
      default: "User",
    },
    uploadedAt: {
      type: String,
      default: () => new Date().toISOString().replace("T", " ").slice(0, 16),
    },
    url: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => String(Date.now()),
    },
    sender: {
      type: String,
      required: [true, "Message sender is required"],
      trim: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    text: {
      type: String,
      required: [true, "Message text is required"],
      trim: true,
      maxlength: [5000, "Message text cannot exceed 5000 characters"],
    },
    time: {
      type: String,
      default: () => new Date().toISOString().replace("T", " ").slice(0, 16),
    },
    attachments: [attachmentSchema],
  },
  {
    timestamps: true,
  }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    user: {
      type: String,
      required: [true, "User name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "User email is required"],
      lowercase: true,
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, "Ticket subject is required"],
      trim: true,
      minlength: [3, "Subject must be at least 3 characters"],
      maxlength: [200, "Subject cannot exceed 200 characters"],
    },
    department: {
      type: String,
      enum: ["Orders", "Payments", "API", "General", "Support", "Other"],
      default: "General",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["Open", "Answered", "Pending", "Closed"],
      default: "Open",
      index: true,
    },
    assignedTo: {
      type: String,
      default: null,
      trim: true,
    },
    messages: [messageSchema],
    attachments: [attachmentSchema],
  },
  {
    timestamps: true,
  }
);

// Auto-generate ticketId e.g. TKT-001 or TKT-101
ticketSchema.pre("validate", function () {
  if (!this.ticketId) {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    this.ticketId = `TKT-${randomSuffix}`;
  }
});

// Format contract JSON matching frontend requirements
ticketSchema.methods.toContractJSON = function () {
  const obj = this.toObject();
  const createdDate = this.createdAt ? new Date(this.createdAt) : new Date();
  const dateFormatted = createdDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const createdAtFormatted = createdDate.toISOString().replace("T", " ").slice(0, 16);
  const lastUpdatedFormatted = this.updatedAt
    ? new Date(this.updatedAt).toISOString().replace("T", " ").slice(0, 16)
    : "Just now";

  return {
    ...obj,
    id: this.ticketId || String(this._id),
    _id: this._id,
    userId: String(this.userId || ""),
    user: this.user,
    email: this.email,
    subject: this.subject,
    department: this.department,
    priority: this.priority,
    status: this.status,
    assignedTo: this.assignedTo,
    messagesCount: this.messages ? this.messages.length : 0,
    messages: this.messages || [],
    attachments: this.attachments || [],
    lastUpdated: lastUpdatedFormatted,
    createdAt: createdAtFormatted,
    date: dateFormatted,
  };
};

module.exports = mongoose.model("Ticket", ticketSchema);
