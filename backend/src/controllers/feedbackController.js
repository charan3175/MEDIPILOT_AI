const Feedback = require("../models/Feedback");

// Submit general app feedback
const submitFeedback = async (req, res) => {
  try {
    const { category, rating, message } = req.body;

    const allowedCategories = [
      "APP_EXPERIENCE",
      "FEATURE_REQUEST",
      "BUG_REPORT",
      "PERFORMANCE",
      "ACCESSIBILITY",
      "OTHER",
    ];

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be a whole number from 1 to 5.",
      });
    }

    if (
      category !== undefined &&
      !allowedCategories.includes(category)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid feedback category.",
      });
    }

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.trim().length > 2000
    ) {
      return res.status(400).json({
        success: false,
        message: "Message is required and must be 2000 characters or fewer.",
      });
    }

    const feedback = await Feedback.create({
      userId: req.user.userId,
      category: category || "OTHER",
      rating,
      message: message.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Feedback submitted successfully.",
      data: {
        id: feedback._id,
        category: feedback.category,
        rating: feedback.rating,
        status: feedback.status,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    console.error("Submit feedback error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to submit feedback.",
    });
  }
};

// Get the logged-in user's feedback
const getMyFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.find({
      userId: req.user.userId,
    })
      .select("-adminResponse -reviewedBy")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: feedback.length,
      data: feedback,
    });
  } catch (error) {
    console.error("Get my feedback error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve feedback.",
    });
  }
};

// View all feedback — hospital administrators only
const getAllFeedback = async (req, res) => {
  try {
    if (req.user.role !== "HOSPITAL_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only hospital administrators can view all feedback.",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

    const filter = {};

    if (req.query.status) {
      const allowedStatuses = ["NEW", "REVIEWING", "RESOLVED"];

      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid feedback status.",
        });
      }

      filter.status = req.query.status;
    }

    const [feedback, total] = await Promise.all([
      Feedback.find(filter)
        .populate("userId", "name email role")
        .populate("reviewedBy", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Feedback.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: feedback,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all feedback error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve feedback.",
    });
  }
};

// Review feedback — hospital administrators only
const reviewFeedback = async (req, res) => {
  try {
    if (req.user.role !== "HOSPITAL_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only hospital administrators can review feedback.",
      });
    }

    const { status, adminResponse } = req.body;
    const updates = {};

    if (status !== undefined) {
      if (!["NEW", "REVIEWING", "RESOLVED"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid feedback status.",
        });
      }

      updates.status = status;
      updates.reviewedBy = req.user.userId;
      updates.reviewedAt = new Date();
    }

    if (adminResponse !== undefined) {
      if (
        typeof adminResponse !== "string" ||
        adminResponse.length > 1000
      ) {
        return res.status(400).json({
          success: false,
          message: "Admin response must be 1000 characters or fewer.",
        });
      }

      updates.adminResponse = adminResponse.trim();
      updates.reviewedBy = req.user.userId;
      updates.reviewedAt = new Date();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide a status or admin response.",
      });
    }

    const feedback = await Feedback.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Feedback reviewed successfully.",
      data: feedback,
    });
  } catch (error) {
    console.error("Review feedback error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to review feedback.",
    });
  }
};

module.exports = {
  submitFeedback,
  getMyFeedback,
  getAllFeedback,
  reviewFeedback,
};
