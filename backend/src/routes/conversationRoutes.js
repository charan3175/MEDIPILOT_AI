const express = require("express");
const { protect } = require("../middleware/authMiddleware");

const {
  getLocalAIStatus,
  getPatientHealthOverview,
  ingestMedicalKnowledge,
  getMyConversations,
  createConversation,
  getConversationById,
  sendMessage,
  deleteConversation,
} = require("../controllers/conversationController");

const router = express.Router();

router.use(protect);

router.get("/status", getLocalAIStatus);
router.post("/health-overview", getPatientHealthOverview);
router.post("/medical-knowledge", ingestMedicalKnowledge);
router.get("/my", getMyConversations);
router.post("/", createConversation);
router.get("/:id", getConversationById);
router.post("/:id/messages", sendMessage);
router.delete("/:id", deleteConversation);

module.exports = router;