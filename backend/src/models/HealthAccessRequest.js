const mongoose = require("mongoose");

const accessEventSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: ["requested", "approved", "denied", "revoked", "expired", "brief-generated"],
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

const healthAccessRequestSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    identityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthIdentity",
      required: true,
      index: true,
    },
    identityGeneration: {
      type: Number,
      required: true,
    },
    requestTokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    organization: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
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
      required: true,
    },
    purpose: {
      type: String,
      enum: ["care", "diagnostic-review", "follow-up", "other"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVING", "APPROVED", "DENIED", "REVOKED", "EXPIRED"],
      default: "PENDING",
      index: true,
    },
    requestExpiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    statusPollWindowStartedAt: {
      type: Date,
      default: null,
    },
    statusPollCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    grantedExpiresAt: {
      type: Date,
      default: null,
    },
    shareGrantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ShareGrant",
      default: null,
    },
    recordCount: {
      type: Number,
      default: 0,
    },
    accessEvents: {
      type: [accessEventSchema],
      default: [],
    },
  },
  { timestamps: true }
);

healthAccessRequestSchema.index({ patientId: 1, createdAt: -1 });

module.exports = mongoose.model("HealthAccessRequest", healthAccessRequestSchema);
