
const Appointment = require("../models/Appointment");

const VALID_STATUSES = ["CONFIRMED", "COMPLETED", "CANCELLED"];

// Get appointments assigned to the logged-in doctor
const getDoctorAppointments = async (req, res) => {
  try {
    if (req.user.role !== "DOCTOR") {
      return res.status(403).json({
        success: false,
        message: "Only doctors can access this endpoint.",
      });
    }

    const appointments = await Appointment.find({
      doctorId: req.user.userId,
    })
      .sort({ appointmentDate: 1, createdAt: -1 })
      .populate("patientId", "name email phone")
      .lean();

    return res.status(200).json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    console.error("Get doctor appointments error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve appointments.",
    });
  }
};

// Update the status of an appointment assigned to the doctor
const updateDoctorAppointmentStatus = async (req, res) => {
  try {
    if (req.user.role !== "DOCTOR") {
      return res.status(403).json({
        success: false,
        message: "Only doctors can update appointment status.",
      });
    }

    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${VALID_STATUSES.join(", ")}.`,
      });
    }

    const appointment = await Appointment.findOne({
      _id: req.params.id,
      doctorId: req.user.userId,
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found or not assigned to you.",
      });
    }

    if (appointment.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "A cancelled appointment cannot be changed.",
      });
    }

    if (appointment.status === "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "A completed appointment cannot be changed.",
      });
    }

    appointment.status = status;
    await appointment.save();

    return res.status(200).json({
      success: true,
      message: "Appointment status updated successfully.",
      appointment,
    });
  } catch (error) {
    console.error("Update doctor appointment error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update appointment status.",
    });
  }
};

module.exports = {
  getDoctorAppointments,
  updateDoctorAppointmentStatus,
};
