
const mongoose = require("mongoose");
const LabReport = require("../models/LabReport");
const User = require("../models/User");
const Document = require("../models/Document");

const LAB_ROLES = ["LAB_TECHNICIAN", "HOSPITAL_ADMIN"];

// Create a lab report for a patient
const createLabReport = async (req, res) => {
  try {
    if (!LAB_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only laboratory staff or hospital administrators can create lab reports.",
      });
    }

    const {
      patientId,
      laboratoryName,
      testName,
      testDate,
      results,
      labNotes,
      reportFileId,
    } = req.body;

    if (
      !patientId ||
      !mongoose.isValidObjectId(patientId) ||
      !laboratoryName?.trim() ||
      !testName?.trim() ||
      !testDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid patientId, laboratoryName, testName, and testDate.",
      });
    }

    const parsedDate = new Date(testDate);

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid testDate.",
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

    if (reportFileId) {
      if (!mongoose.isValidObjectId(reportFileId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid reportFileId.",
        });
      }

      const reportDocument = await Document.findOne({
        _id: reportFileId,
        patientId,
      }).select("_id");

      if (!reportDocument) {
        return res.status(404).json({
          success: false,
          message: "The report document was not found for this patient.",
        });
      }
    }

    const report = await LabReport.create({
      patientId,
      uploadedBy: req.user.userId,
      laboratoryName: laboratoryName.trim(),
      testName: testName.trim(),
      testDate: parsedDate,
      results: Array.isArray(results) ? results : [],
      labNotes: labNotes || "",
      reportFileId: reportFileId || null,
      reportStatus: "COMPLETED",
    });

    return res.status(201).json({
      success: true,
      message: "Lab report created successfully.",
      report,
    });
  } catch (error) {
    console.error("Create lab report error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create lab report.",
    });
  }
};

// Get reports belonging to the logged-in patient
const getMyLabReports = async (req, res) => {
  try {
    if (req.user.role !== "PATIENT") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is for patients.",
      });
    }

    const reports = await LabReport.find({
      patientId: req.user.userId,
    })
      .sort({ testDate: -1 })
      .populate("uploadedBy", "name")
      .lean();

    return res.status(200).json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error("Get patient lab reports error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve lab reports.",
    });
  }
};

// Get reports uploaded by the logged-in laboratory staff member
const getLabStaffReports = async (req, res) => {
  try {
    if (!LAB_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access is restricted to laboratory staff and hospital administrators.",
      });
    }

    const filter = {};

    // Lab technicians see only reports they created.
    // Hospital admins can review all reports.
    if (req.user.role === "LAB_TECHNICIAN") {
      filter.uploadedBy = req.user.userId;
    }

    const reports = await LabReport.find(filter)
      .sort({ createdAt: -1 })
      .populate("patientId", "name email")
      .lean();

    return res.status(200).json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (error) {
    console.error("Get lab staff reports error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve laboratory reports.",
    });
  }
};

// Record an administrative review of a report
const reviewLabReport = async (req, res) => {
  try {
    if (req.user.role !== "HOSPITAL_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only hospital administrators can review reports.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report ID.",
      });
    }

    const report = await LabReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Lab report not found.",
      });
    }

    report.reviewedBy = req.user.userId;
    report.reviewedAt = new Date();

    await report.save();

    return res.status(200).json({
      success: true,
      message: "Report review recorded successfully.",
      report,
    });
  } catch (error) {
    console.error("Review lab report error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to review lab report.",
    });
  }
};

module.exports = {
  createLabReport,
  getMyLabReports,
  getLabStaffReports,
  reviewLabReport,
};
