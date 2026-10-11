
const mongoose = require("mongoose");

const labTestSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
    },

    laboratoryName: {
      type: String,
      trim: true,
      default: "",
    },

    testName: {
      type: String,
      trim: true,
      required: true,
    },

    instructions: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    scheduledAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "REQUESTED",
        "ACCEPTED",
        "SAMPLE_COLLECTED",
        "PROCESSING",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "REQUESTED",
      index: true,
    },

    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabReport",
      default: null,
    },

    assignedTechnician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "REQUESTED",
            "ACCEPTED",
            "SAMPLE_COLLECTED",
            "PROCESSING",
            "COMPLETED",
            "CANCELLED",
          ],
          required: true,
        },

        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },

        note: {
          type: String,
          trim: true,
          maxlength: 500,
          default: "",
        },

        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

labTestSchema.index({ patientId: 1, createdAt: -1 });
labTestSchema.index({ hospitalId: 1, status: 1 });

module.exports = mongoose.model("LabTest", labTestSchema);
