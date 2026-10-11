const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    hospitalId: {
      type: String,
      default: null,
    },

    doctorName: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    specialization: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    hospitalName: {
      type: String,
      trim: true,
      maxlength: 180,
      default: "",
    },

    location: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    meetingLink: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    appointmentDate: {
      type: Date,
      required: true,
    },

    timeProvided: {
      type: Boolean,
      default: true,
    },

    timeZone: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "UTC",
    },

    appointmentType: {
      type: String,
      enum: ["IN_PERSON", "ONLINE", "PHONE", "OTHER"],
      default: "IN_PERSON",
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "REQUESTED",
        "CONFIRMED",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "REQUESTED",
    },

    confirmationStatus: {
      type: String,
      enum: ["USER_MANAGED", "CLINIC_PENDING", "CLINIC_CONFIRMED"],
      default: "CLINIC_PENDING",
    },

    sourceDocumentIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
    }],

    relatedMedicationIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medication",
    }],

    followUpDate: {
      type: Date,
      default: null,
    },

    reminderPreference: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Appointment",
  appointmentSchema
);