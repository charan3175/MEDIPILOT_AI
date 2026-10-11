const AuditLog = require("../models/AuditLog");

// View audit logs — restricted to hospital administrators
const getAuditLogs = async (req, res) => {
  try {
    if (req.user.role !== "HOSPITAL_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only hospital administrators can view audit logs.",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

    const filter = {};

    if (req.query.resourceType) {
      const allowedTypes = [
        "USER",
        "DOCUMENT",
        "HEALTH_RECORD",
        "APPOINTMENT",
        "PRESCRIPTION",
        "LAB_REPORT",
        "LAB_TEST",
        "MEDICATION",
        "REMINDER",
        "ABHA_PROFILE",
        "PAYMENT",
        "HOSPITAL",
        "DOCTOR_PROFILE",
        "OTHER",
      ];

      if (!allowedTypes.includes(req.query.resourceType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid resource type.",
        });
      }

      filter.resourceType = req.query.resourceType;
    }

    if (req.query.status) {
      if (!["SUCCESS", "FAILURE"].includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status filter.",
        });
      }

      filter.status = req.query.status;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .select("-details -ipAddress -userAgent")
        .populate("userId", "name email role")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get audit logs error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve audit logs.",
    });
  }
};

module.exports = {
  getAuditLogs,
};
