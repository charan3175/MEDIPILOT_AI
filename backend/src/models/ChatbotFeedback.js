const mongoose = require("mongoose");

const chatbotFeedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },

    messageId: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    rating: {
      type: String,
      enum: ["HELPFUL", "PARTIALLY_HELPFUL", "NOT_HELPFUL"],
      required: true,
    },

    category: {
      type: String,
      enum: [
        "ACCURACY",
        "CLARITY",
        "RELEVANCE",
        "MISSING_INFORMATION",
        "OTHER",
      ],
      default: "OTHER",
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    reviewStatus: {
      type: String,
      enum: ["NEW", "REVIEWED", "RESOLVED"],
      default: "NEW",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

chatbotFeedbackSchema.index({ userId: 1, createdAt: -1 });
chatbotFeedbackSchema.index({ rating: 1, createdAt: -1 });

module.exports =
  mongoose.models.ChatbotFeedback ||
  mongoose.model("ChatbotFeedback", chatbotFeedbackSchema);
