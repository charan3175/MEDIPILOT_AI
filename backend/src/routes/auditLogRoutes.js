const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { getAuditLogs } = require("../controllers/auditLogController");

// Require authentication for all audit-log routes
router.use(protect);

// GET /api/audit-logs
// Only HOSPITAL_ADMIN users can view logs
router.get("/", getAuditLogs);

module.exports = router;
