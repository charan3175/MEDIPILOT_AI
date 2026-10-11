const mongoose = require("mongoose");

const healthRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    recordType: {
      type: String,
      enum: [
        "ALLERGY",
        "CONDITION",
        "VITAL",
        "MEDICATION",
        "NOTE",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    details: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    value: {
      type: Number,
      default: null,
    },

    unit: {
      type: String,
      default: null,
    },

    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "HealthRecord",
  healthRecordSchema
);