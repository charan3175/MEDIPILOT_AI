const mongoose = require("mongoose");

const shareEventSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: ["created", "accessed", "brief-generated", "revoked"],
      required: true,
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false }
);

const recordReferenceSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["document", "record", "medication"],
      required: true,
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  { _id: false }
);

const shareGrantSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    records: {
      type: [recordReferenceSchema],
      required: true,
      validate: {
        validator: (records) => records.length > 0 && records.length <= 50,
        message: "A share must include between 1 and 50 records.",
      },
    },
    source: {
      type: String,
      enum: ["direct", "health-id"],
      default: "direct",
    },
    organization: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    requesterName: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    requesterRole: {
      type: String,
      enum: ["physician", "nurse", "technician", "administrator", "other"],
    },
    purpose: {
      type: String,
      enum: ["care", "diagnostic-review", "follow-up", "other"],
    },
    healthAccessRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthAccessRequest",
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    accessEvents: {
      type: [shareEventSchema],
      default: [],
    },
  },
  { timestamps: true }
);

shareGrantSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model("ShareGrant", shareGrantSchema);
