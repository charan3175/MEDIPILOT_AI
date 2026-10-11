
const mongoose = require("mongoose");

const prescriptionItemSchema = new mongoose.Schema(
  {
    medicineName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    dosage: {
      type: String,
      trim: true,
      required: true,
      maxlength: 100,
    },

    frequency: {
      type: String,
      trim: true,
      required: true,
      maxlength: 100,
    },

    duration: {
      type: String,
      trim: true,
      required: true,
      maxlength: 100,
    },

    instructions: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
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
      required: true,
    },

    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },

    diagnosisNotes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    medicines: {
      type: [prescriptionItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "A prescription must contain at least one medicine.",
      },
    },

    generalInstructions: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    followUpDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "CANCELLED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ doctorId: 1, createdAt: -1 });

module.exports = mongoose.model("Prescription", prescriptionSchema);
