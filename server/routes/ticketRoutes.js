const express = require("express");
const {
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
} = require("../controllers/ticketController");
const { authenticate, authorizeAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Specific routes before :id
router.get("/admin/counts", authenticate, authorizeAdmin, getTicketCounts);
router.get("/counts", authenticate, getTicketCounts);
router.get("/admin/all", authenticate, authorizeAdmin, getAllAdminTickets);

// Base Collection Routes
router.get("/", authenticate, getTickets);
router.post("/", authenticate, createTicket);

// Single Item Routes
router.get("/:id", authenticate, getTicketById);
router.post("/:id/reply", authenticate, replyTicket);
router.patch("/:id/reply", authenticate, replyTicket);
router.patch("/:id/status", authenticate, updateTicketStatus);
router.patch("/:id/close", authenticate, closeTicket);
router.patch("/:id/priority", authenticate, authorizeAdmin, updateTicketPriority);
router.patch("/:id/assign", authenticate, authorizeAdmin, assignTicket);
router.delete("/:id", authenticate, authorizeAdmin, deleteTicket);

module.exports = router;
