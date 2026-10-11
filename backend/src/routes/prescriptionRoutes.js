
const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  createPrescription,
  getMyPrescriptions,
  getMyIssuedPrescriptions,
  updatePrescriptionStatus,
} = require("../controllers/prescriptionController");

const router = express.Router();

router.use(protect);

// Patient: view personal prescription history
router.get("/my", getMyPrescriptions);

// Doctor: view prescriptions they issued
router.get("/issued", getMyIssuedPrescriptions);

// Doctor: create a prescription
router.post("/", createPrescription);

// Doctor: update an issued prescription's status
router.patch("/:id/status", updatePrescriptionStatus);

module.exports = router;
