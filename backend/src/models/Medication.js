const mongoose = require("mongoose");

const medicationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    medicineName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    prescribedFor: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    dosage: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    strength: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    dosageForm: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    route: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    frequency: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    prescribedBy: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    instructions: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    duration: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    foodInstructions: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    prescriptionDate: {
      type: Date,
      default: null,
    },

    sourceDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
      index: true,
    },

    verificationStatus: {
      type: String,
      enum: ["USER_ENTERED", "USER_CONFIRMED", "CLINICIAN_DOCUMENTED"],
      default: "USER_ENTERED",
    },

    source: {
      type: String,
      enum: ["USER_ENTERED", "PRESCRIPTION_REPORT"],
      default: "USER_ENTERED",
    },

    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "STOPPED"],
      default: "ACTIVE",
    },

    reminderEnabled: {
      type: Boolean,
      default: false,
    },

    reminderTimes: {
      type: [String],
      default: [],
      validate: {
        validator: (times) =>
          times.every((time) =>
            /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
          ),
        message: "Reminder times must use HH:mm format.",
      },
    },
  },
  { timestamps: true }
);

medicationSchema.index({ patientId: 1, status: 1 });

module.exports = mongoose.model("Medication", medicationSchema);