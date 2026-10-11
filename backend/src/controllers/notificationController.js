const Notification = require("../models/Notification");

const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user.userId,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount: notifications.filter((item) => !item.isRead).length,
      notifications,
    });
  } catch (error) {
    console.error("Fetch notifications failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load notifications.",
    });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.userId,
      },
      { $set: { isRead: true } },
      { new: true, runValidators: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      notification,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    console.error("Mark notification read failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update notification.",
    });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification deleted successfully.",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    console.error("Delete notification failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete notification.",
    });
  }
};

module.exports = {
  getMyNotifications,
  markNotificationRead,
  deleteNotification,
};