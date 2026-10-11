
const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  getPendingDoctors,
  verifyDoctor,
  revokeDoctorVerification,
} = require("../controllers/adminDoctorController");

const router = express.Router();

// All admin doctor-management routes require authentication.
router.use(protect);

// GET /api/admin/doctors/pending
router.get("/pending", getPendingDoctors);

// PATCH /api/admin/doctors/:id/verify
router.patch("/:id/verify", verifyDoctor);

// PATCH /api/admin/doctors/:id/revoke-verification
router.patch("/:id/revoke-verification", revokeDoctorVerification);

module.exports = router;
