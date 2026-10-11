const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  createSupportTicket,
  getMySupportTickets,
  getAllSupportTickets,
  updateSupportTicket,
} = require("../controllers/supportTicketController");

// All support-ticket routes require authentication
router.use(protect);

// Create a support ticket
router.post("/", createSupportTicket);

// Get the logged-in user's tickets
router.get("/my", getMySupportTickets);

// Hospital administrators: view all tickets
router.get("/", getAllSupportTickets);

// Hospital administrators: update a ticket
router.patch("/:id", updateSupportTicket);

module.exports = router;
