const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: [
        "PATIENT",
        "DOCTOR",
        "NURSE",
        "LAB_TECHNICIAN",
        "PHARMACIST",
        "HOSPITAL_ADMIN",
      ],
      required: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    hospitalId: {
      type: String,
      default: null,
    },

    preferredLanguage: {
      type: String,
      enum: ["en", "te", "hi", "ta"],
      default: null,
    },

    resetPasswordTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    resetPasswordExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    resetPasswordRequestedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
