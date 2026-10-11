
const mongoose = require("mongoose");

const abhaProfileSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    abhaAddress: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },

    abhaNumberLastFour: {
      type: String,
      trim: true,
      match: /^\d{4}$/,
    },

    verificationStatus: {
      type: String,
      enum: ["NOT_VERIFIED", "PENDING", "VERIFIED", "REJECTED"],
      default: "NOT_VERIFIED",
    },

    consent: {
      shareHealthRecords: {
        type: Boolean,
        default: false,
      },

      shareLabReports: {
        type: Boolean,
        default: false,
      },

      sharePrescriptions: {
        type: Boolean,
        default: false,
      },

      consentGrantedAt: {
        type: Date,
        default: null,
      },

      consentExpiresAt: {
        type: Date,
        default: null,
      },

      consentRevokedAt: {
        type: Date,
        default: null,
      },
    },

    linkedAt: {
      type: Date,
      default: null,
    },

    lastSyncedAt: {
      type: Date,
      default: null,
    },

    integrationStatus: {
      type: String,
      enum: ["NOT_CONNECTED", "CONNECTED", "SYNC_PENDING", "SYNC_FAILED"],
      default: "NOT_CONNECTED",
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.ABHAProfile ||
  mongoose.model("ABHAProfile", abhaProfileSchema);
