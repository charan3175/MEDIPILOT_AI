const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  createAppointment,
  getMyAppointments,
  getMyAppointmentById,
  updateAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  getMyAppointmentSuggestions,
  confirmAppointmentSuggestion,
  ignoreAppointmentSuggestion,
} = require("../controllers/appointmentController");

const router = express.Router();

router.use(protect);

router.post("/", createAppointment);

router.get("/my", getMyAppointments);

router.get("/suggestions/my", getMyAppointmentSuggestions);

router.post("/suggestions/:id/confirm", confirmAppointmentSuggestion);

router.patch("/suggestions/:id/ignore", ignoreAppointmentSuggestion);

router.get("/:id", getMyAppointmentById);

router.patch("/:id", updateAppointment);

router.patch("/:id/status", updateAppointmentStatus);

router.patch("/:id/cancel", cancelAppointment);

module.exports = router;