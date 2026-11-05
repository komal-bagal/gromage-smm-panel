const express = require("express");

const {
  createTicket,
  getMyTickets,
  getTicketById,
  replyToTicket,
  closeTicket,
  getAllTickets,
  updateTicketStatus,
  updateTicketPriority,
  assignTicket,
} = require("../controllers/ticketController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// ======================================================
// ADMIN / STAFF
// Keep /admin/all before /:id
// ======================================================

router.get(
  "/admin/all",
  authMiddleware,
  getAllTickets
);

// ======================================================
// CREATE TICKET
// POST /api/tickets
// ======================================================

router.post(
  "/",
  authMiddleware,
  createTicket
);

// ======================================================
// USER TICKETS
// GET /api/tickets/my
// ======================================================

router.get(
  "/my",
  authMiddleware,
  getMyTickets
);

// ======================================================
// GET SINGLE TICKET
// GET /api/tickets/:id
// ======================================================

router.get(
  "/:id",
  authMiddleware,
  getTicketById
);

// ======================================================
// REPLY TO TICKET
// POST /api/tickets/:id/reply
// ======================================================

router.post(
  "/:id/reply",
  authMiddleware,
  replyToTicket
);

// ======================================================
// CLOSE TICKET
// PATCH /api/tickets/:id/close
// ======================================================

router.patch(
  "/:id/close",
  authMiddleware,
  closeTicket
);

// ======================================================
// UPDATE STATUS
// PATCH /api/tickets/:id/status
// ======================================================

router.patch(
  "/:id/status",
  authMiddleware,
  updateTicketStatus
);

// ======================================================
// UPDATE PRIORITY
// PATCH /api/tickets/:id/priority
// ======================================================

router.patch(
  "/:id/priority",
  authMiddleware,
  updateTicketPriority
);

// ======================================================
// ASSIGN TICKET
// PATCH /api/tickets/:id/assign
// ======================================================

router.patch(
  "/:id/assign",
  authMiddleware,
  assignTicket
);

// ======================================================
// EXPORT
// ======================================================

module.exports = router;
