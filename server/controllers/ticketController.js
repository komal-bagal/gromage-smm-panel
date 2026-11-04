const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");

/**
 * Whitelist and sanitize attachment metadata to ensure safety
 */
const sanitizeAttachments = (attachments, uploadedBy = "User") => {
  if (!Array.isArray(attachments)) return [];
  const ALLOWED_EXTS = [
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "pdf",
    "txt",
    "csv",
    "json",
    "doc",
    "docx",
  ];

  const sanitized = [];
  for (const att of attachments.slice(0, 5)) {
    if (!att || typeof att !== "object") continue;
    const rawName = String(att.name || "attachment").trim();
    // Strip any path traversal characters
    const baseName = rawName.replace(/^.*[\\/]/, "").slice(0, 100);
    const ext = baseName.includes(".")
      ? baseName.split(".").pop().toLowerCase()
      : "";
    if (ext && !ALLOWED_EXTS.includes(ext)) continue;

    sanitized.push({
      id: att.id || `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: baseName || "attachment.txt",
      size: typeof att.size === "string" ? att.size : "0 KB",
      sizeBytes: Math.min(Number(att.sizeBytes || 0), 10 * 1024 * 1024),
      type: typeof att.type === "string" ? att.type : "application/octet-stream",
      extension: ext,
      uploadedBy: att.uploadedBy || uploadedBy,
      uploadedAt: att.uploadedAt || new Date().toISOString().replace("T", " ").slice(0, 16),
      url:
        typeof att.url === "string" &&
        (att.url.startsWith("http://") ||
          att.url.startsWith("https://") ||
          att.url.startsWith("blob:"))
          ? att.url
          : null,
    });
  }
  return sanitized;
};

/**
 * Normalize status string to TitleCase
 */
const normalizeStatus = (status) => {
  if (!status) return "Open";
  const s = String(status).toLowerCase().trim();
  if (s === "closed") return "Closed";
  if (s === "answered") return "Answered";
  if (s === "pending") return "Pending";
  return "Open";
};

/**
 * Normalize priority string to TitleCase
 */
const normalizePriority = (priority) => {
  if (!priority) return "Medium";
  const p = String(priority).toLowerCase().trim();
  if (p === "urgent") return "Urgent";
  if (p === "high") return "High";
  if (p === "low") return "Low";
  return "Medium";
};

/**
 * GET /api/ticket or GET /api/tickets
 * List tickets (Users see their own; Admins see all)
 */
const getTickets = async (req, res) => {
  try {
    const { status, priority, department, search } = req.query;
    const filter = {};

    // Role-based visibility
    if (req.user && req.user.role !== "admin") {
      filter.$or = [
        { userId: req.user._id },
        { email: String(req.user.email).toLowerCase() },
      ];
    }

    if (status && status !== "all") {
      filter.status = new RegExp(`^${status}$`, "i");
    }

    if (priority && priority !== "all") {
      filter.priority = new RegExp(`^${priority}$`, "i");
    }

    if (department && department !== "all") {
      filter.department = new RegExp(`^${department}$`, "i");
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      const regex = new RegExp(q, "i");
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { ticketId: regex },
          { subject: regex },
          { user: regex },
          { email: regex },
        ],
      });
    }

    const tickets = await Ticket.find(filter).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: tickets.length,
      tickets: tickets.map((t) => t.toContractJSON()),
      data: tickets.map((t) => t.toContractJSON()),
    });
  } catch (error) {
    console.error("Get Tickets Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch support tickets",
      error: error.message,
    });
  }
};

/**
 * GET /api/tickets/admin/all
 * Explicit Admin-only endpoint to list all tickets
 */
const getAllAdminTickets = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Admin access required",
      });
    }

    const { status, priority, department, search } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.status = new RegExp(`^${status}$`, "i");
    }
    if (priority && priority !== "all") {
      filter.priority = new RegExp(`^${priority}$`, "i");
    }
    if (department && department !== "all") {
      filter.department = new RegExp(`^${department}$`, "i");
    }
    if (search && String(search).trim()) {
      const q = String(search).trim();
      const regex = new RegExp(q, "i");
      filter.$or = [
        { ticketId: regex },
        { subject: regex },
        { user: regex },
        { email: regex },
      ];
    }

    const tickets = await Ticket.find(filter).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: tickets.length,
      tickets: tickets.map((t) => t.toContractJSON()),
      data: tickets.map((t) => t.toContractJSON()),
    });
  } catch (error) {
    console.error("Get All Admin Tickets Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin tickets list",
      error: error.message,
    });
  }
};

/**
 * GET /api/tickets/admin/counts or GET /api/ticket/counts
 * Returns summary counts of tickets (open, answered, closed, total)
 */
const getTicketCounts = async (req, res) => {
  try {
    const filter = {};
    if (req.user && req.user.role !== "admin") {
      filter.$or = [
        { userId: req.user._id },
        { email: String(req.user.email).toLowerCase() },
      ];
    }

    const [total, open, answered, closed] = await Promise.all([
      Ticket.countDocuments(filter),
      Ticket.countDocuments({ ...filter, status: /^open$/i }),
      Ticket.countDocuments({ ...filter, status: /^answered$/i }),
      Ticket.countDocuments({ ...filter, status: /^closed$/i }),
    ]);

    return res.status(200).json({
      success: true,
      counts: {
        total,
        open,
        answered,
        closed,
      },
    });
  } catch (error) {
    console.error("Get Ticket Counts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch ticket counts",
      error: error.message,
    });
  }
};

/**
 * GET /api/tickets/:id or GET /api/ticket/:id
 * Retrieve single ticket details with thread messages
 */
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    let ticket = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      ticket = await Ticket.findById(id);
    }
    if (!ticket) {
      ticket = await Ticket.findOne({
        $or: [{ ticketId: id }, { ticketId: `#${id.replace(/^#/, "")}` }],
      });
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: `Support ticket '${id}' not found`,
      });
    }

    // Authorization: regular users can only access their own tickets
    if (
      req.user &&
      req.user.role !== "admin" &&
      String(ticket.userId) !== String(req.user._id) &&
      ticket.email !== req.user.email
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to view this ticket",
      });
    }

    return res.status(200).json({
      success: true,
      ticket: ticket.toContractJSON(),
      data: ticket.toContractJSON(),
    });
  } catch (error) {
    console.error("Get Ticket By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ticket details",
      error: error.message,
    });
  }
};

/**
 * POST /api/ticket or POST /api/tickets
 * Create a new support ticket (User or Admin)
 */
const createTicket = async (req, res) => {
  try {
    const {
      subject,
      priority,
      department,
      message,
      text,
      attachments,
    } = req.body;

    // 1. Validate Subject
    const cleanSubject = String(subject || "").trim();
    if (!cleanSubject) {
      return res.status(400).json({
        success: false,
        message: "Ticket subject is required",
      });
    }
    if (cleanSubject.length < 3 || cleanSubject.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Subject must be between 3 and 200 characters long",
      });
    }

    // 2. Validate Message
    const cleanMessage = String(message || text || "").trim();
    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        message: "Ticket message description is required",
      });
    }

    // 3. User Resolution
    const user = req.user ? req.user.name || "Customer" : "Customer";
    const email = req.user ? req.user.email : "";
    const userId = req.user ? req.user._id : undefined;

    if (!userId || !email) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to create a ticket",
      });
    }

    const normPriority = normalizePriority(priority);
    const normDept = ["Orders", "Payments", "API", "General", "Support"].includes(department)
      ? department
      : "General";

    const safeAttachments = sanitizeAttachments(
      attachments,
      req.user.role === "admin" ? "Support Staff (Admin)" : user
    );

    const initialMessage = {
      id: String(Date.now()),
      sender: user,
      senderId: userId,
      role: req.user.role === "admin" ? "admin" : "user",
      text: cleanMessage,
      attachments: safeAttachments,
      time: new Date().toISOString().replace("T", " ").slice(0, 16),
    };

    const newTicket = new Ticket({
      userId,
      user,
      email,
      subject: cleanSubject,
      department: normDept,
      priority: normPriority,
      status: "Open",
      messages: [initialMessage],
      attachments: safeAttachments,
    });

    await newTicket.save();

    return res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      ticket: newTicket.toContractJSON(),
      data: newTicket.toContractJSON(),
    });
  } catch (error) {
    console.error("Create Ticket Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create support ticket",
      error: error.message,
    });
  }
};

/**
 * POST /api/tickets/:id/reply or POST /api/ticket/:id/reply
 * Post a message/reply in the ticket thread (User or Admin)
 */
const replyTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, message, attachments } = req.body;

    let ticket = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      ticket = await Ticket.findById(id);
    }
    if (!ticket) {
      ticket = await Ticket.findOne({
        $or: [{ ticketId: id }, { ticketId: `#${id.replace(/^#/, "")}` }],
      });
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: `Support ticket '${id}' not found`,
      });
    }

    const isAdmin = req.user?.role === "admin";
    const isOwner =
      req.user &&
      (String(ticket.userId) === String(req.user._id) || ticket.email === req.user.email);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You cannot reply to another user's ticket",
      });
    }

    const cleanText = String(text || message || "").trim();
    const safeAttachments = sanitizeAttachments(
      attachments,
      isAdmin ? "Support Staff (Admin)" : ticket.user
    );

    if (!cleanText && safeAttachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Reply message or attachment is required",
      });
    }

    const senderName = isAdmin
      ? "Support Staff (Admin)"
      : req.user.name || ticket.user;

    const newMsg = {
      id: String(Date.now()),
      sender: senderName,
      senderId: req.user._id,
      role: isAdmin ? "admin" : "user",
      text: cleanText,
      attachments: safeAttachments,
      time: new Date().toISOString().replace("T", " ").slice(0, 16),
    };

    ticket.messages.push(newMsg);

    // Append attachments to ticket-level attachments array
    if (safeAttachments.length > 0) {
      ticket.attachments = [...(ticket.attachments || []), ...safeAttachments];
    }

    // Status transition
    if (isAdmin) {
      ticket.status = "Answered";
    } else {
      ticket.status = "Open";
    }

    await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Reply posted successfully",
      ticketId: ticket.ticketId,
      messageObj: newMsg,
      ticket: ticket.toContractJSON(),
    });
  } catch (error) {
    console.error("Reply Ticket Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to post reply",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/tickets/:id/status or PATCH /api/ticket/:id/status
 * Update ticket status (Admin, or user closing own ticket)
 */
const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    let ticket = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      ticket = await Ticket.findById(id);
    }
    if (!ticket) {
      ticket = await Ticket.findOne({
        $or: [{ ticketId: id }, { ticketId: `#${id.replace(/^#/, "")}` }],
      });
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: `Support ticket '${id}' not found`,
      });
    }

    const isAdmin = req.user?.role === "admin";
    const isOwner =
      req.user &&
      (String(ticket.userId) === String(req.user._id) || ticket.email === req.user.email);

    const normStatus = normalizeStatus(status);

    if (!isAdmin) {
      // Regular user can only close their own ticket
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You cannot modify another user's ticket",
        });
      }
      if (normStatus !== "Closed") {
        return res.status(403).json({
          success: false,
          message: "Forbidden: Regular users can only close their own tickets",
        });
      }
    }

    ticket.status = normStatus;
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: `Ticket status updated to ${ticket.status}`,
      id: ticket.ticketId,
      status: ticket.status,
      ticket: ticket.toContractJSON(),
    });
  } catch (error) {
    console.error("Update Ticket Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update ticket status",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/tickets/:id/close or PATCH /api/ticket/:id/close
 * Close support ticket
 */
const closeTicket = async (req, res) => {
  req.body = { status: "Closed" };
  return updateTicketStatus(req, res);
};

/**
 * PATCH /api/tickets/:id/priority or PATCH /api/ticket/:id/priority
 * Update ticket priority (Admin only)
 */
const updateTicketPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Admin access required",
      });
    }

    let ticket = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      ticket = await Ticket.findById(id);
    }
    if (!ticket) {
      ticket = await Ticket.findOne({
        $or: [{ ticketId: id }, { ticketId: `#${id.replace(/^#/, "")}` }],
      });
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: `Support ticket '${id}' not found`,
      });
    }

    ticket.priority = normalizePriority(priority);
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: `Ticket priority updated to ${ticket.priority}`,
      id: ticket.ticketId,
      priority: ticket.priority,
      ticket: ticket.toContractJSON(),
    });
  } catch (error) {
    console.error("Update Priority Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update ticket priority",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/tickets/:id/assign or PATCH /api/ticket/:id/assign
 * Assign ticket to admin/staff (Admin only)
 */
const assignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Admin access required",
      });
    }

    let ticket = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      ticket = await Ticket.findById(id);
    }
    if (!ticket) {
      ticket = await Ticket.findOne({
        $or: [{ ticketId: id }, { ticketId: `#${id.replace(/^#/, "")}` }],
      });
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: `Support ticket '${id}' not found`,
      });
    }

    ticket.assignedTo = assignedTo ? String(assignedTo).trim() : null;
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: `Ticket assigned to ${ticket.assignedTo || "Unassigned"}`,
      id: ticket.ticketId,
      assignedTo: ticket.assignedTo,
      ticket: ticket.toContractJSON(),
    });
  } catch (error) {
    console.error("Assign Ticket Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to assign ticket",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/tickets/:id or DELETE /api/ticket/:id
 * Delete ticket permanently (Admin only)
 */
const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Admin access required",
      });
    }

    let ticket = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      ticket = await Ticket.findByIdAndDelete(id);
    }
    if (!ticket) {
      ticket = await Ticket.findOneAndDelete({
        $or: [{ ticketId: id }, { ticketId: `#${id.replace(/^#/, "")}` }],
      });
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: `Support ticket '${id}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Ticket '${ticket.ticketId}' deleted successfully`,
      id: ticket.ticketId,
    });
  } catch (error) {
    console.error("Delete Ticket Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete ticket",
      error: error.message,
    });
  }
};

module.exports = {
  getTickets,
  getAllAdminTickets,
  getTicketCounts,
  getTicketById,
  createTicket,
  replyTicket,
  updateTicketStatus,
  closeTicket,
  updateTicketPriority,
  assignTicket,
  deleteTicket,
};
