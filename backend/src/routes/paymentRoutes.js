const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  getMyPayments,
  createPayment,
} = require("../controllers/paymentController");

// All payment routes require authentication
router.use(protect);

// Get the logged-in patient's payment history
router.get("/my", getMyPayments);

// Create a pending payment record
router.post("/", createPayment);

module.exports = router;
