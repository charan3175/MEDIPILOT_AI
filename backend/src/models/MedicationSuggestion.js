const mongoose = require("mongoose");

const medicationSuggestionSchema = new mongoose.Schema(
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
    sourceKey: { type: String, required: true },
    medicineName: { type: String, trim: true, maxlength: 200, required: true },
    strength: { type: String, trim: true, maxlength: 100, default: "" },
    dosage: { type: String, trim: true, maxlength: 100, default: "" },
    dosageForm: { type: String, trim: true, maxlength: 100, default: "" },
    route: { type: String, trim: true, maxlength: 100, default: "" },
    frequency: { type: String, trim: true, maxlength: 200, default: "" },
    duration: { type: String, trim: true, maxlength: 100, default: "" },
    foodInstructions: { type: String, trim: true, maxlength: 300, default: "" },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    prescribedBy: { type: String, trim: true, maxlength: 150, default: "" },
    prescriptionDate: { type: Date, default: null },
    instructions: { type: String, trim: true, maxlength: 1000, default: "" },
    sourceEvidence: { type: [String], default: [] },
    reviewStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "IGNORED"],
      default: "PENDING",
      index: true,
    },
    linkedMedicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medication",
      default: null,
    },
  },
  { timestamps: true }
);

medicationSuggestionSchema.index(
  { patientId: 1, sourceDocumentId: 1, sourceKey: 1 },
  { unique: true }
);

module.exports = mongoose.model("MedicationSuggestion", medicationSuggestionSchema);
