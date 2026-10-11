
const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  getDoctorAppointments,
  updateDoctorAppointmentStatus,
} = require("../controllers/doctorAppointmentController");

const router = express.Router();

// All doctor appointment routes require authentication.
router.use(protect);

// GET /api/doctor-appointments/my
router.get("/my", getDoctorAppointments);

// PATCH /api/doctor-appointments/:id/status
router.patch("/:id/status", updateDoctorAppointmentStatus);

module.exports = router;
