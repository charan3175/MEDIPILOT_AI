const mongoose = require("mongoose");

const identityEventSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: ["created", "link-regenerated"],
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

const healthIdentitySchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    healthId: {
      type: String,
      required: true,
      unique: true,
    },
    generation: {
      type: Number,
      required: true,
      default: 1,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    requestWindowStartedAt: {
      type: Date,
      default: null,
    },
    requestCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    accessEvents: {
      type: [identityEventSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HealthIdentity", healthIdentitySchema);
