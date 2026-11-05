
const mongoose = require("mongoose");

const Ticket = require("../models/Ticket");
const TicketMessage = require("../models/TicketMessage");
const User = require("../models/User");
const Order = require("../models/Order");

// ======================================================
// HELPERS
// ======================================================

function getUserId(req) {
  return req.user?._id || req.user?.id || req.user?.userId;
}

function getRole(req) {
  return String(req.user?.role || "").toLowerCase();
}

function isAdminOrStaff(req) {
  return ["admin", "staff"].includes(getRole(req));
}

function getSenderType(req) {
  const role = getRole(req);

  if (role === "admin") return "admin";
  if (role === "staff") return "staff";

  return "user";
}

function getRequestId(req) {
  return req.requestId || undefined;
}

function safeServerError(res, req, message) {
  const response = { success: false, message };
  const requestId = getRequestId(req);

  if (requestId) response.requestId = requestId;

  return res.status(500).json(response);
}

function isValidObjectId(value) {
  if (
    typeof value !== "string" ||
    !mongoose.Types.ObjectId.isValid(value)
  ) {
    return false;
  }

  return String(new mongoose.Types.ObjectId(value)) === value;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getLastMessage(message) {
  return message.slice(0, 500);
}

function canAccessTicket(ticket, req) {
  if (isAdminOrStaff(req)) return true;

  const ticketUserId = ticket.userId?._id || ticket.userId;
  const userId = getUserId(req);

  return Boolean(
    userId &&
    ticketUserId &&
    String(ticketUserId) === String(userId)
  );
}

function getPagination(query, defaultLimit = 10) {
  const parsedPage = Number.parseInt(query.page, 10);
  const parsedLimit = Number.parseInt(query.limit, 10);

  const page =
    Number.isInteger(parsedPage) && parsedPage > 0
      ? parsedPage
      : 1;

  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 100)
      : defaultLimit;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

function isValidMessage(message) {
  return (
    typeof message === "string" &&
    message.trim().length > 0 &&
    message.trim().length <= 5000
  );
}

function invalidMessageResponse(res) {
  return res.status(400).json({
    success: false,
    message: "Message must contain between 1 and 5000 characters",
  });
}

// ======================================================
// CONSTANTS
// ======================================================

const ALLOWED_CATEGORIES = [
  "order",
  "payment",
  "account",
  "service",
  "wallet",
  "affiliate",
  "technical",
  "other",
];

const ALLOWED_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
];

const ALLOWED_STATUSES = [
  "open",
  "pending",
  "in_progress",
  "resolved",
  "closed",
];

// ======================================================
// GENERATE UNIQUE TICKET NUMBER
// ======================================================

async function generateTicketNumber() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const randomNumber = Math.floor(
      100000 + Math.random() * 900000
    );

    const ticketNumber = `TKT-${randomNumber}`;
    const exists = await Ticket.exists({ ticketNumber });

    if (!exists) return ticketNumber;
  }

  throw new Error("Unable to generate a unique ticket number");
}

// ======================================================
// CREATE TICKET
// POST /api/tickets
// ======================================================

const createTicket = async (req, res) => {
  let createdTicketId = null;

  try {
    const userId = getUserId(req);

    if (!userId || !isValidObjectId(String(userId))) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const {
      subject,
      category,
      priority,
      message,
      orderId,
    } = req.body || {};

    if (typeof subject !== "string" || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject is required",
      });
    }

    const trimmedSubject = subject.trim();

    if (
      trimmedSubject.length < 3 ||
      trimmedSubject.length > 200
    ) {
      return res.status(400).json({
        success: false,
        message: "Subject must contain between 3 and 200 characters",
      });
    }

    if (!isValidMessage(message)) {
      return invalidMessageResponse(res);
    }

    const trimmedMessage = message.trim();
    const finalCategory = category || "other";

    if (!ALLOWED_CATEGORIES.includes(finalCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket category",
      });
    }

    const finalPriority = isAdminOrStaff(req)
      ? priority || "medium"
      : "medium";

    if (!ALLOWED_PRIORITIES.includes(finalPriority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket priority",
      });
    }

    let order = null;

    if (orderId) {
      if (!isValidObjectId(orderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID",
        });
      }

      order = await Order.findById(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      if (!isAdminOrStaff(req)) {
        const orderUserId = order.userId?._id || order.userId;

        if (String(orderUserId) !== String(userId)) {
          return res.status(403).json({
            success: false,
            message: "You cannot create a ticket for this order",
          });
        }
      }
    }

    let ticket;
    let firstMessage;
    let created = false;

    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      const ticketNumber = await generateTicketNumber();

      try {
        ticket = await Ticket.create({
          ticketNumber,
          userId,
          subject: trimmedSubject,
          category: finalCategory,
          priority: finalPriority,
          status: "open",
          orderId: order?._id || null,
          lastMessage: getLastMessage(trimmedMessage),
        });

        createdTicketId = ticket._id;

        firstMessage = await TicketMessage.create({
          ticketId: ticket._id,
          senderId: userId,
          senderType: getSenderType(req),
          message: trimmedMessage,
          isRead: false,
        });

        created = true;
      } catch (error) {
        if (createdTicketId) {
          try {
            await TicketMessage.deleteMany({
              ticketId: createdTicketId,
            });

            await Ticket.deleteOne({
              _id: createdTicketId,
            });
          } catch (cleanupError) {
            console.error("TICKET CLEANUP ERROR:", cleanupError);
          }
        }

        createdTicketId = null;
        ticket = undefined;
        firstMessage = undefined;

        if (isDuplicateKeyError(error) && attempt < 2) {
          continue;
        }

        throw error;
      }
    }

    if (!created || !ticket) {
      throw new Error("Unable to create ticket");
    }

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("userId", "name email role status")
      .populate("assignedTo", "name email role status")
      .populate("orderId");

    return res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      data: {
        ticket: populatedTicket,
        firstMessage,
      },
    });
  } catch (error) {
    console.error("CREATE TICKET ERROR:", error);

    return safeServerError(
      res,
      req,
      "Failed to create ticket"
    );
  }
};

// ======================================================
// GET MY TICKETS
// GET /api/tickets/my
// ======================================================

const getMyTickets = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId || !isValidObjectId(String(userId))) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { page, limit, skip } = getPagination(req.query, 10);
    const filter = { userId };

    if (req.query.status) {
      if (!ALLOWED_STATUSES.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket status",
        });
      }

      filter.status = req.query.status;
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate("assignedTo", "name email role")
        .populate("orderId")
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Ticket.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: tickets,
    });
  } catch (error) {
    console.error("GET MY TICKETS ERROR:", error);

    return safeServerError(res, req, "Failed to fetch tickets");
  }
};

// ======================================================
// GET TICKET BY ID
// GET /api/tickets/:id
// ======================================================

const getTicketById = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (!canAccessTicket(ticket, req)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this ticket",
      });
    }

    await ticket.populate("userId", "name email role status");
    await ticket.populate("assignedTo", "name email role status");
    await ticket.populate("orderId");

    const messages = await TicketMessage.find({
      ticketId: ticket._id,
    })
      .populate("senderId", "name email role")
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        ticket,
        messages,
      },
    });
  } catch (error) {
    console.error("GET TICKET ERROR:", error);

    return safeServerError(res, req, "Failed to fetch ticket");
  }
};

// ======================================================
// REPLY TO TICKET
// POST /api/tickets/:id/reply
// ======================================================

const replyToTicket = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { message } = req.body || {};

    if (!userId || !isValidObjectId(String(userId))) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    if (!isValidMessage(message)) {
      return invalidMessageResponse(res);
    }

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (!canAccessTicket(ticket, req)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to reply to this ticket",
      });
    }

    if (ticket.status === "closed") {
      return res.status(400).json({
        success: false,
        message: "Cannot reply to a closed ticket",
        code: "TICKET_CLOSED",
      });
    }

    const trimmedMessage = message.trim();
    const senderType = getSenderType(req);

    // Update ticket first; do not allow a reply after closure.
    const newStatus = isAdminOrStaff(req)
      ? ticket.status === "open"
        ? "in_progress"
        : ticket.status
      : ["pending", "resolved"].includes(ticket.status)
        ? "open"
        : ticket.status;

    const updatedTicket = await Ticket.findOneAndUpdate(
      {
        _id: id,
        status: { $ne: "closed" },
      },
      {
        $set: {
          lastMessage: getLastMessage(trimmedMessage),
          status: newStatus,
          closedAt: null,
          closedBy: null,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedTicket) {
      return res.status(400).json({
        success: false,
        message: "Cannot reply to a closed ticket",
        code: "TICKET_CLOSED",
      });
    }

    let reply;

    try {
      reply = await TicketMessage.create({
        ticketId: updatedTicket._id,
        senderId: userId,
        senderType,
        message: trimmedMessage,
        isRead: false,
      });
    } catch (error) {
      console.error("CREATE TICKET REPLY ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Ticket was updated but reply could not be saved",
      });
    }

    const populatedTicket = await Ticket.findById(updatedTicket._id)
      .populate("userId", "name email role status")
      .populate("assignedTo", "name email role status")
      .populate("orderId");

    return res.status(201).json({
      success: true,
      message: "Reply added successfully",
      data: {
        ticket: populatedTicket,
        reply,
      },
    });
  } catch (error) {
    console.error("REPLY TO TICKET ERROR:", error);

    return safeServerError(res, req, "Failed to reply to ticket");
  }
};

// ======================================================
// CLOSE TICKET
// PATCH /api/tickets/:id/close
// ADMIN / STAFF ONLY
// ======================================================

const closeTicket = async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin or staff can close tickets",
      });
    }

    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (ticket.status === "closed") {
      return res.status(200).json({
        success: true,
        message: "Ticket is already closed",
        data: ticket,
      });
    }

    ticket.status = "closed";
    ticket.closedAt = new Date();
    ticket.closedBy = getUserId(req);

    await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Ticket closed successfully",
      data: ticket,
    });
  } catch (error) {
    console.error("CLOSE TICKET ERROR:", error);

    return safeServerError(res, req, "Failed to close ticket");
  }
};

// ======================================================
// GET ALL TICKETS
// GET /api/tickets/admin/all
// ADMIN / STAFF ONLY
// ======================================================

const getAllTickets = async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin or staff can view all tickets",
      });
    }

    const { page, limit, skip } = getPagination(req.query, 20);
    const filter = {};

    if (req.query.status) {
      if (!ALLOWED_STATUSES.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket status",
        });
      }

      filter.status = req.query.status;
    }

    if (req.query.priority) {
      if (!ALLOWED_PRIORITIES.includes(req.query.priority)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket priority",
        });
      }

      filter.priority = req.query.priority;
    }

    if (req.query.category) {
      if (!ALLOWED_CATEGORIES.includes(req.query.category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket category",
        });
      }

      filter.category = req.query.category;
    }

    if (req.query.assignedTo) {
      if (!isValidObjectId(req.query.assignedTo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assigned user ID",
        });
      }

      filter.assignedTo = req.query.assignedTo;
    }

    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const search = escapeRegex(req.query.search.trim().slice(0, 100));

      filter.$or = [
        { ticketNumber: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .populate("userId", "name email role")
        .populate("assignedTo", "name email role")
        .populate("orderId")
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Ticket.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: tickets,
    });
  } catch (error) {
    console.error("GET ALL TICKETS ERROR:", error);

    return safeServerError(res, req, "Failed to fetch tickets");
  }
};

// ======================================================
// UPDATE TICKET STATUS
// PATCH /api/tickets/:id/status
// ADMIN / STAFF ONLY
// ======================================================

const updateTicketStatus = async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin or staff can update ticket status",
      });
    }

    const { id } = req.params;
    const { status } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket status",
      });
    }

    const update = { status };

    if (status === "closed") {
      update.closedAt = new Date();
      update.closedBy = getUserId(req);
    } else {
      update.closedAt = null;
      update.closedBy = null;
    }

    const ticket = await Ticket.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    )
      .populate("userId", "name email role")
      .populate("assignedTo", "name email role")
      .populate("orderId");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ticket status updated successfully",
      data: ticket,
    });
  } catch (error) {
    console.error("UPDATE TICKET STATUS ERROR:", error);

    return safeServerError(res, req, "Failed to update ticket status");
  }
};

// ======================================================
// UPDATE TICKET PRIORITY
// PATCH /api/tickets/:id/priority
// ADMIN / STAFF ONLY
// ======================================================

const updateTicketPriority = async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin or staff can update ticket priority",
      });
    }

    const { id } = req.params;
    const { priority } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    if (!ALLOWED_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket priority",
      });
    }

    const ticket = await Ticket.findByIdAndUpdate(
      id,
      { $set: { priority } },
      { new: true, runValidators: true }
    )
      .populate("userId", "name email role")
      .populate("assignedTo", "name email role")
      .populate("orderId");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ticket priority updated successfully",
      data: ticket,
    });
  } catch (error) {
    console.error("UPDATE TICKET PRIORITY ERROR:", error);

    return safeServerError(res, req, "Failed to update ticket priority");
  }
};

// ======================================================
// ASSIGN TICKET
// PATCH /api/tickets/:id/assign
// ADMIN / STAFF ONLY
// ======================================================

const assignTicket = async (req, res) => {
  try {
    if (!isAdminOrStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Only admin or staff can assign tickets",
      });
    }

    const { id } = req.params;
    const { assignedTo } = req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    if (!isValidObjectId(assignedTo)) {
      return res.status(400).json({
        success: false,
        message: "Valid assignedTo user ID is required",
      });
    }

    const [ticket, assignedUser] = await Promise.all([
      Ticket.findById(id),
      User.findById(assignedTo),
    ]);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (!assignedUser) {
      return res.status(404).json({
        success: false,
        message: "Assigned user not found",
      });
    }

    const assignedRole = String(assignedUser.role || "").toLowerCase();

    if (!["admin", "staff"].includes(assignedRole)) {
      return res.status(400).json({
        success: false,
        message: "Ticket can only be assigned to admin or staff",
      });
    }

    if (
      assignedUser.status &&
      String(assignedUser.status).toLowerCase() !== "active"
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot assign ticket to an inactive user",
      });
    }

    ticket.assignedTo = assignedUser._id;
    await ticket.save();

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("userId", "name email role")
      .populate("assignedTo", "name email role status")
      .populate("orderId");

    return res.status(200).json({
      success: true,
      message: "Ticket assigned successfully",
      data: populatedTicket,
    });
  } catch (error) {
    console.error("ASSIGN TICKET ERROR:", error);

    return safeServerError(res, req, "Failed to assign ticket");
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createTicket,
  getMyTickets,
  getTicketById,
  replyToTicket,
  closeTicket,
  getAllTickets,
  updateTicketStatus,
  updateTicketPriority,
  assignTicket,
};
