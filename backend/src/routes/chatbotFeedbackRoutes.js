const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  submitChatbotFeedback,
  getChatbotFeedback,
} = require("../controllers/chatbotFeedbackController");

router.use(protect);

router.post("/", submitChatbotFeedback);
router.get("/", getChatbotFeedback);

module.exports = router;