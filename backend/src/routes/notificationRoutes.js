const express = require("express");
const { protect } = require("../middleware/authMiddleware");

const {
  getMyNotifications,
  markNotificationRead,
  deleteNotification,
} = require("../controllers/notificationController");

const router = express.Router();

router.use(protect);

router.get("/my", getMyNotifications);
router.patch("/:id/read", markNotificationRead);
router.delete("/:id", deleteNotification);

module.exports = router;