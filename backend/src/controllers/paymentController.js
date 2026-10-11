
const Payment = require("../models/Payment");
const Appointment = require("../models/Appointment");

// Get the logged-in user's payment history
const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({
      patientId: req.user.userId,
    })
      .sort({ createdAt: -1 })
      .populate("doctorId", "name")
      .populate("appointmentId", "appointmentDate status")
      .lean();

    return res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    console.error("Get payments error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve payment history.",
    });
  }
};

// Create a pending payment record for an eligible appointment
const createPayment = async (req, res) => {
  try {
    const { appointmentId, paymentMethod } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required.",
      });
    }

    const allowedMethods = [
      "UPI",
      "CARD",
      "NET_BANKING",
      "CASH",
      "OTHER",
    ];

    if (
      paymentMethod !== undefined &&
      !allowedMethods.includes(paymentMethod)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method.",
      });
    }

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patientId: req.user.userId,
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found.",
      });
    }

    if (!appointment.doctorId) {
      return res.status(400).json({
        success: false,
        message: "This appointment has no assigned doctor.",
      });
    }

    if (
      !["PENDING", "CONFIRMED"].includes(appointment.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment cannot be created for this appointment.",
      });
    }

    const existingPayment = await Payment.findOne({ appointmentId });

    if (existingPayment) {
      return res.status(409).json({
        success: false,
        message: "A payment record already exists for this appointment.",
        data: {
          paymentId: existingPayment._id,
          paymentStatus: existingPayment.paymentStatus,
        },
      });
    }

    // This amount is a placeholder until verified doctor pricing is integrated.
    const amount = 0;

    const payment = await Payment.create({
      patientId: req.user.userId,
      doctorId: appointment.doctorId,
      appointmentId,
      amount,
      paymentMethod: paymentMethod || "OTHER",
      paymentStatus: "PENDING",
    });

    return res.status(201).json({
      success: true,
      message: "Pending payment record created. No money has been collected.",
      data: payment,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A payment record already exists for this appointment.",
      });
    }

    console.error("Create payment error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create payment record.",
    });
  }
};

module.exports = {
  getMyPayments,
  createPayment,
};
