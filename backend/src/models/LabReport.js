
const mongoose = require("mongoose");

const labReportSchema = new mongoose.Schema(
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

    laboratoryName: {
      type: String,
      trim: true,
      required: true,
    },

    testName: {
      type: String,
      trim: true,
      required: true,
    },

    testDate: {
      type: Date,
      required: true,
    },

    reportFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },

    reportStatus: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },

    results: [
      {
        parameter: {
          type: String,
          trim: true,
          required: true,
        },

        value: {
          type: String,
          trim: true,
          required: true,
        },

        unit: {
          type: String,
          trim: true,
          default: "",
        },

        referenceRange: {
          type: String,
          trim: true,
          default: "",
        },

        flag: {
          type: String,
          enum: ["LOW", "NORMAL", "HIGH", "UNKNOWN"],
          default: "UNKNOWN",
        },
      },
    ],

    labNotes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

labReportSchema.index({ patientId: 1, testDate: -1 });
labReportSchema.index({ uploadedBy: 1, createdAt: -1 });

module.exports = mongoose.model("LabReport", labReportSchema);
