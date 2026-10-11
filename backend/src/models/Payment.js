const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
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
      index: true,
    },

    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
    },

    paymentMethod: {
      type: String,
      enum: [
        "UPI",
        "CARD",
        "NET_BANKING",
        "CASH",
        "OTHER",
      ],
      default: "OTHER",
    },

    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "SUCCESS",
        "FAILED",
        "REFUNDED",
      ],
      default: "PENDING",
      index: true,
    },

    transactionReference: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    refundReference: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    refundedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ patientId: 1, createdAt: -1 });
paymentSchema.index({ doctorId: 1, createdAt: -1 });

module.exports =
  mongoose.models.Payment ||
  mongoose.model("Payment", paymentSchema);
