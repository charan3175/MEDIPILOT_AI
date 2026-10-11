const mongoose = require("mongoose");

const appointmentSuggestionSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sourceDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    suggestionType: {
      type: String,
      enum: ["CONSULTATION", "FOLLOW_UP"],
      required: true,
    },
    doctorName: { type: String, trim: true, maxlength: 150, default: "" },
    hospitalName: { type: String, trim: true, maxlength: 180, default: "" },
    appointmentDate: { type: Date, required: true },
    followUpDate: { type: Date, default: null },
    sourceEvidence: { type: [String], default: [] },
    reviewStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "IGNORED"],
      default: "PENDING",
      index: true,
    },
    linkedAppointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
  },
  { timestamps: true }
);

appointmentSuggestionSchema.index(
  { patientId: 1, sourceDocumentId: 1, suggestionType: 1, appointmentDate: 1 },
  { unique: true }
);

module.exports = mongoose.model("AppointmentSuggestion", appointmentSuggestionSchema);
