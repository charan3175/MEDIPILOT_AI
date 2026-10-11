const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { exportMyFhirRecords } = require("../controllers/fhirController");

const router = express.Router();

router.get("/export", protect, exportMyFhirRecords);

module.exports = router;
