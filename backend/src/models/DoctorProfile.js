const mongoose = require("mongoose");

const doctorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    specialization: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    qualification: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    experienceYears: {
      type: Number,
      min: 0,
      max: 80,
      default: 0,
    },

    registrationNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    hospitalName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    hospitalId: {
      type: String,
      trim: true,
      default: null,
    },

    consultationFee: {
      type: Number,
      min: 0,
      default: 0,
    },

    languages: {
      type: [String],
      default: ["English"],
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    availability: {
      type: [
        {
          day: {
            type: String,
            enum: [
              "MONDAY",
              "TUESDAY",
              "WEDNESDAY",
              "THURSDAY",
              "FRIDAY",
              "SATURDAY",
              "SUNDAY",
            ],
            required: true,
          },
          startTime: {
            type: String,
            match: /^([01]\d|2[0-3]):[0-5]\d$/,
            required: true,
          },
          endTime: {
            type: String,
            match: /^([01]\d|2[0-3]):[0-5]\d$/,
            required: true,
          },
        },
      ],
      default: [],
    },

    acceptsAppointments: {
      type: Boolean,
      default: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DoctorProfile", doctorProfileSchema);