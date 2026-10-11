
const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  createLabReport,
  getMyLabReports,
  getLabStaffReports,
  reviewLabReport,
} = require("../controllers/labReportController");

const router = express.Router();

router.use(protect);

// Patient: view their own lab reports
router.get("/my", getMyLabReports);

// Lab staff/admin: view laboratory reports
router.get("/staff", getLabStaffReports);

// Lab staff/admin: create a report
router.post("/", createLabReport);

// Hospital admin: record a report review
router.patch("/:id/review", reviewLabReport);

module.exports = router;
