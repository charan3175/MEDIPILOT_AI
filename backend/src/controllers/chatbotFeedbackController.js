const ChatbotFeedback = require("../models/ChatbotFeedback");
const Conversation = require("../models/Conversation");

// Submit feedback for an AI chatbot response
const submitChatbotFeedback = async (req, res) => {
  try {
    const {
      conversationId,
      messageId,
      rating,
      category,
      comment,
    } = req.body;

    const allowedRatings = [
      "HELPFUL",
      "PARTIALLY_HELPFUL",
      "NOT_HELPFUL",
    ];

    const allowedCategories = [
      "ACCURACY",
      "CLARITY",
      "RELEVANCE",
      "MISSING_INFORMATION",
      "OTHER",
    ];

    if (!allowedRatings.includes(rating)) {
      return res.status(400).json({
        success: false,
        message: "Select a valid feedback rating.",
      });
    }

    if (
      category !== undefined &&
      !allowedCategories.includes(category)
    ) {
      return res.status(400).json({
        success: false,
        message: "Select a valid feedback category.",
      });
    }

    if (
      comment !== undefined &&
      (typeof comment !== "string" || comment.length > 1000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Feedback comment must be 1000 characters or fewer.",
      });
    }

    if (conversationId) {
      const conversation = await Conversation.findOne({
        _id: conversationId,
        userId: req.user.userId,
      }).select("_id");

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found.",
        });
      }
    }

    const feedback = await ChatbotFeedback.create({
      userId: req.user.userId,
      conversationId: conversationId || null,
      messageId: messageId || undefined,
      rating,
      category: category || "OTHER",
      comment: comment ? comment.trim() : "",
    });

    return res.status(201).json({
      success: true,
      message: "Feedback submitted successfully.",
      data: {
        id: feedback._id,
        rating: feedback.rating,
        category: feedback.category,
        createdAt: feedback.createdAt,
      },
    });
  } catch (error) {
    console.error("Submit chatbot feedback error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to submit feedback.",
    });
  }
};

// View feedback — restricted to hospital administrators
const getChatbotFeedback = async (req, res) => {
  try {
    if (req.user.role !== "HOSPITAL_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only hospital administrators can view feedback.",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

    const filter = {};

    if (req.query.rating) {
      if (
        !["HELPFUL", "PARTIALLY_HELPFUL", "NOT_HELPFUL"].includes(
          req.query.rating
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid rating filter.",
        });
      }

      filter.rating = req.query.rating;
    }

    const [feedback, total] = await Promise.all([
      ChatbotFeedback.find(filter)
        .select("-comment")
        .populate("userId", "name role")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      ChatbotFeedback.countDocuments(filter),
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
    console.error("Get chatbot feedback error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve chatbot feedback.",
    });
  }
};

module.exports = {
  submitChatbotFeedback,
  getChatbotFeedback,
};
