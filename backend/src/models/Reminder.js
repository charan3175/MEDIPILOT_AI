const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    medicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medication",
      default: null,
    },

    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },

    sourceDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    reminderType: {
      type: String,
      enum: ["MEDICATION", "APPOINTMENT", "FOLLOW_UP", "WATER", "GENERAL"],
      default: "GENERAL",
    },

    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },

    timeZone: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "UTC",
    },

    appointmentLeadMinutes: {
      type: Number,
      min: 0,
      max: 10080,
      default: null,
    },

    repeat: {
      type: String,
      enum: ["ONCE", "DAILY", "WEEKLY"],
      default: "ONCE",
    },

    isCompleted: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isPaused: {
      type: Boolean,
      default: false,
    },

    dismissedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    deliveryStatus: {
      type: String,
      enum: ["NOT_CONFIGURED"],
      default: "NOT_CONFIGURED",
    },

    lastTriggeredAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

reminderSchema.index({ userId: 1, scheduledAt: 1, isActive: 1 });

module.exports = mongoose.model("Reminder", reminderSchema);