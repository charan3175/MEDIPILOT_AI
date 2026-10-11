const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  submitFeedback,
  getMyFeedback,
  getAllFeedback,
  reviewFeedback,
} = require("../controllers/feedbackController");

// All feedback routes require authentication
router.use(protect);

// Submit feedback
router.post("/", submitFeedback);

// Get the logged-in user's feedback
router.get("/my", getMyFeedback);

// Hospital administrators: view all feedback
router.get("/", getAllFeedback);

// Hospital administrators: review feedback
router.patch("/:id/review", reviewFeedback);

module.exports = router;
