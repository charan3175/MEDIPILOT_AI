const express = require("express");
const { protect } = require("../middleware/authMiddleware");

const {
  createReminder,
  getMyReminders,
  updateReminder,
  deleteReminder,
  dismissReminder,
  pauseReminder,
  resumeReminder,
  cancelReminder,
} = require("../controllers/reminderController");

const router = express.Router();

router.use(protect);

router.post("/", createReminder);
router.get("/my", getMyReminders);
router.patch("/:id", updateReminder);
router.patch("/:id/dismiss", dismissReminder);
router.patch("/:id/pause", pauseReminder);
router.patch("/:id/resume", resumeReminder);
router.patch("/:id/cancel", cancelReminder);
router.delete("/:id", deleteReminder);

module.exports = router;