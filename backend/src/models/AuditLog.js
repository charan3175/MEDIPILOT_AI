const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    resourceType: {
      type: String,
      required: true,
      enum: [
        "USER",
        "DOCUMENT",
        "HEALTH_RECORD",
        "APPOINTMENT",
        "PRESCRIPTION",
        "LAB_REPORT",
        "LAB_TEST",
        "MEDICATION",
        "REMINDER",
        "ABHA_PROFILE",
        "PAYMENT",
        "HOSPITAL",
        "DOCTOR_PROFILE",
        "OTHER",
      ],
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE"],
      default: "SUCCESS",
    },

    ipAddress: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

module.exports =
  mongoose.models.AuditLog ||
  mongoose.model("AuditLog", auditLogSchema);
