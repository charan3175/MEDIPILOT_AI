
const mongoose = require("mongoose");
const Prescription = require("../models/Prescription");
const User = require("../models/User");
const Appointment = require("../models/Appointment");

// Doctor creates a prescription
const createPrescription = async (req, res) => {
  try {
    if (req.user.role !== "DOCTOR") {
      return res.status(403).json({
        success: false,
        message: "Only doctors can create prescriptions.",
      });
    }

    const {
      patientId,
      appointmentId,
      diagnosisNotes,
      medicines,
      generalInstructions,
      followUpDate,
    } = req.body;

    if (!mongoose.isValidObjectId(patientId)) {
      return res.status(400).json({
        success: false,
        message: "A valid patient ID is required.",
      });
    }

    if (!Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Add at least one medicine to the prescription.",
      });
    }

    if (
      medicines.length > 30 ||
      medicines.some(
        (medicine) =>
          !medicine ||
          typeof medicine.medicineName !== "string" ||
          !medicine.medicineName.trim() ||
          typeof medicine.dosage !== "string" ||
          !medicine.dosage.trim() ||
          typeof medicine.frequency !== "string" ||
          !medicine.frequency.trim() ||
          typeof medicine.duration !== "string" ||
          !medicine.duration.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Each medicine must have a name, dosage, frequency, and duration. Maximum 30 medicines.",
      });
    }

    const patient = await User.findOne({
      _id: patientId,
      role: "PATIENT",
      isActive: true,
    }).select("_id");

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Active patient account not found.",
      });
    }

    let linkedAppointmentId = null;

    if (appointmentId) {
      if (!mongoose.isValidObjectId(appointmentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment ID.",
        });
      }

      const appointment = await Appointment.findOne({
        _id: appointmentId,
        patientId,
        doctorId: req.user.userId,
        status: { $in: ["CONFIRMED", "COMPLETED"] },
      }).select("_id");

      if (!appointment) {
        return res.status(400).json({
          success: false,
          message:
            "The appointment must belong to this doctor and patient.",
        });
      }

      linkedAppointmentId = appointment._id;
    }

    let parsedFollowUpDate = null;

    if (followUpDate) {
      parsedFollowUpDate = new Date(followUpDate);

      if (
        Number.isNaN(parsedFollowUpDate.getTime()) ||
        parsedFollowUpDate < new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: "Follow-up date must be valid and in the future.",
        });
      }
    }

    const prescription = await Prescription.create({
      patientId,
      doctorId: req.user.userId,
      appointmentId: linkedAppointmentId,
      diagnosisNotes: diagnosisNotes || "",
      medicines: medicines.map((medicine) => ({
        medicineName: medicine.medicineName.trim(),
        dosage: medicine.dosage.trim(),
        frequency: medicine.frequency.trim(),
        duration: medicine.duration.trim(),
        instructions: medicine.instructions || "",
      })),
      generalInstructions: generalInstructions || "",
      followUpDate: parsedFollowUpDate,
      status: "ACTIVE",
    });

    return res.status(201).json({
      success: true,
      message: "Prescription created successfully.",
      prescription,
    });
  } catch (error) {
    console.error("Create prescription error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create prescription.",
    });
  }
};

// Patient views their own prescription history
const getMyPrescriptions = async (req, res) => {
  try {
    if (req.user.role !== "PATIENT") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is for patients.",
      });
    }

    const prescriptions = await Prescription.find({
      patientId: req.user.userId,
    })
      .sort({ createdAt: -1 })
      .populate("doctorId", "name email")
      .populate("appointmentId", "appointmentDate status")
      .lean();

    return res.status(200).json({
      success: true,
      count: prescriptions.length,
      prescriptions,
    });
  } catch (error) {
    console.error("Get patient prescriptions error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve prescriptions.",
    });
  }
};

// Doctor views prescriptions they created
const getMyIssuedPrescriptions = async (req, res) => {
  try {
    if (req.user.role !== "DOCTOR") {
      return res.status(403).json({
        success: false,
        message: "Only doctors can view their issued prescriptions.",
      });
    }

    const prescriptions = await Prescription.find({
      doctorId: req.user.userId,
    })
      .sort({ createdAt: -1 })
      .populate("patientId", "name email")
      .lean();

    return res.status(200).json({
      success: true,
      count: prescriptions.length,
      prescriptions,
    });
  } catch (error) {
    console.error("Get issued prescriptions error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve issued prescriptions.",
    });
  }
};

// Doctor updates the status of a prescription they created
const updatePrescriptionStatus = async (req, res) => {
  try {
    if (req.user.role !== "DOCTOR") {
      return res.status(403).json({
        success: false,
        message: "Only doctors can update prescription status.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid prescription ID.",
      });
    }

    const { status } = req.body;

    if (!["COMPLETED", "CANCELLED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be COMPLETED or CANCELLED.",
      });
    }

    const prescription = await Prescription.findOne({
      _id: req.params.id,
      doctorId: req.user.userId,
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found or not issued by you.",
      });
    }

    if (prescription.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Only active prescriptions can change status.",
      });
    }

    prescription.status = status;
    await prescription.save();

    return res.status(200).json({
      success: true,
      message: "Prescription status updated successfully.",
      prescription,
    });
  } catch (error) {
    console.error("Update prescription status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update prescription status.",
    });
  }
};

module.exports = {
  createPrescription,
  getMyPrescriptions,
  getMyIssuedPrescriptions,
  updatePrescriptionStatus,
};
