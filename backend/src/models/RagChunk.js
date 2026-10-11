const mongoose = require("mongoose");

const ragChunkSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    scope: {
      type: String,
      enum: ["PATIENT", "MEDICAL"],
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      required: true,
      trim: true,
    },
    sourceId: {
      type: String,
      required: true,
      trim: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    model: {
      type: String,
      required: true,
    },
    contentHash: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 4000,
    },
    embedding: {
      type: [Number],
      required: true,
      select: false,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    sourceUrl: {
      type: String,
      default: null,
    },
    category: {
      type: String,
      default: null,
    },
    recordDate: {
      type: Date,
      default: null,
    },
    documentType: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

ragChunkSchema.index(
  { ownerId: 1, scope: 1, sourceType: 1, sourceId: 1, chunkIndex: 1 },
  { unique: true }
);
ragChunkSchema.index({ scope: 1, sourceId: 1, model: 1 });

module.exports = mongoose.model("RagChunk", ragChunkSchema);
