const mongoose = require("mongoose");

const medicalKnowledgeSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
    },
    publishedDate: {
      type: Date,
      default: null,
    },
    updatedDate: {
      type: Date,
      default: null,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    content: {
      type: String,
      required: true,
      maxlength: 100000,
    },
    trustLevel: {
      type: String,
      enum: ["high"],
      default: "high",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

medicalKnowledgeSchema.index({ url: 1, title: 1 }, { unique: true });

module.exports = mongoose.model("MedicalKnowledge", medicalKnowledgeSchema);
