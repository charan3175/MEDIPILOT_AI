
const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  registerHospital,
  searchHospitals,
  getHospitalById,
} = require("../controllers/hospitalController");

const router = express.Router();

// All hospital endpoints require authentication.
router.use(protect);

// POST /api/hospitals — register a hospital
router.post("/", registerHospital);

// GET /api/hospitals — search verified hospitals
router.get("/", searchHospitals);

// GET /api/hospitals/:id — view verified hospital details
router.get("/:id", getHospitalById);

module.exports = router;
