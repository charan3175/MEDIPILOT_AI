const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["USER", "ASSISTANT"],
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    answerType: {
      type: String,
      enum: [
        "EMERGENCY",
        "SAFETY_REDIRECT",
        "PATIENT_RECORD",
        "ASSISTANT_GUIDANCE",
        "INSUFFICIENT_EVIDENCE",
        "MEDICAL_KNOWLEDGE",
      ],
      default: null,
    },

    grounded: {
      type: Boolean,
      default: null,
    },

    retrievalCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    retrievalLimited: {
      type: Boolean,
      default: false,
    },

    sources: {
      type: [
        {
          id: { type: String, required: true },
          type: { type: String, required: true },
          kind: {
            type: String,
            enum: ["PATIENT_RECORD", "TRUSTED_MEDICAL_KNOWLEDGE"],
            required: true,
          },
          title: { type: String, required: true },
          date: { type: Date, default: null },
          url: { type: String, default: null },
          excerpt: { type: String, maxlength: 420, default: "" },
        },
      ],
      default: [],
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  }
);

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "Health Assistant Chat",
    },

    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Conversation",
  conversationSchema
);