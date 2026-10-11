
const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    originalName: {
      type: String,
      required: true,
      trim: true,
    },

    storedName: {
      type: String,
      required: true,
      unique: true,
    },

    mimeType: {
      type: String,
      required: true,
      enum: ["application/pdf", "image/jpeg", "image/png"],
    },

    size: {
      type: Number,
      required: true,
    },

    uploadHash: {
      type: String,
      match: /^[a-f0-9]{64}$/,
    },

    documentType: {
      type: String,
      enum: [
        "LAB_REPORT",
        "PRESCRIPTION",
        "DIAGNOSTIC_REPORT",
        "DISCHARGE_SUMMARY",
        "OTHER",
      ],
      default: "OTHER",
    },

    processingStatus: {
      type: String,
      enum: ["UPLOADED", "PROCESSING", "REVIEW_REQUIRED", "COMPLETED", "FAILED"],
      default: "UPLOADED",
    },

    ocrStatus: {
      type: String,
      enum: ["NOT_REQUIRED", "COMPLETED", "UNAVAILABLE", "FAILED"],
      default: "NOT_REQUIRED",
    },

    ocrLanguage: {
      type: String,
      enum: ["eng", "eng+hin", "eng+tel", "eng+tam"],
      default: "eng",
    },

    extractionStatus: {
      type: String,
      enum: ["PENDING", "COMPLETED", "REVIEW_REQUIRED", "FAILED"],
      default: "PENDING",
    },

    reviewStatus: {
      type: String,
      enum: ["NOT_REQUIRED", "REVIEW_REQUIRED", "CONFIRMED"],
      default: "REVIEW_REQUIRED",
    },

    processingMessage: {
      type: String,
      maxlength: 300,
      default: "",
    },

    reportDate: {
      type: Date,
      default: null,
    },

    pageCount: {
      type: Number,
      min: 0,
      default: null,
    },

    extractedText: {
      type: String,
      default: "",
    },

    extractedData: {
      type: [
        {
          testName: { type: String, required: true },
          value: { type: Number, required: true },
          originalValue: { type: String, default: "" },
          unit: { type: String, default: null },
          referenceRange: { type: String, default: null },
          reportedFlag: {
            type: String,
            enum: ["LOW", "NORMAL", "HIGH", "CRITICAL", "UNKNOWN"],
            default: "UNKNOWN",
          },
          confidence: { type: Number, min: 0, max: 1, default: null },
          verificationStatus: {
            type: String,
            enum: ["UNVERIFIED", "REVIEW_REQUIRED", "CONFIRMED"],
            default: "UNVERIFIED",
          },
          sourceLine: { type: String, default: "" },
        },
      ],
      default: [],
    },

    extractedClinicalData: {
      type: [
        {
          fieldType: { type: String, enum: ["DIAGNOSIS", "DATE"], required: true },
          label: { type: String, required: true, maxlength: 80 },
          value: { type: String, required: true, maxlength: 300 },
          sourceLine: { type: String, default: "", maxlength: 500 },
          confidence: { type: Number, min: 0, max: 1, default: null },
          verificationStatus: {
            type: String,
            enum: ["UNVERIFIED", "REVIEW_REQUIRED", "CONFIRMED", "REJECTED"],
            default: "UNVERIFIED",
          },
        },
      ],
      default: [],
    },

    aiSummary: {
      type: String,
      default: "",
    },

    aiSummaryLanguage: {
      type: String,
      enum: ["en", "te", "hi", "ta"],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

documentSchema.index(
  { patientId: 1, uploadHash: 1 },
  { unique: true, partialFilterExpression: { uploadHash: { $type: "string" } } }
);

const Document = mongoose.model("Document", documentSchema);

module.exports = Document;
