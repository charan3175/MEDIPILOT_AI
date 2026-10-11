const HealthRecord = require("../models/HealthRecord");

const allowedTypes = [
  "ALLERGY",
  "CONDITION",
  "VITAL",
  "MEDICATION",
  "NOTE",
];

// Create a health record
const createHealthRecord = async (req, res) => {
  try {
    const { recordType, title, details, value, unit, recordedAt } =
      req.body;

    if (!allowedTypes.includes(recordType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid health record type.",
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Record title is required.",
      });
    }

    const record = await HealthRecord.create({
      patientId: req.user.userId,
      recordedBy: req.user.userId,
      recordType,
      title: title.trim(),
      details: details || "",
      value: value === "" || value === undefined ? null : value,
      unit: unit || null,
      recordedAt: recordedAt || new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Health record created successfully.",
      record,
    });
  } catch (error) {
    console.error("Create health record failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create health record.",
    });
  }
};

// Get the logged-in user's health records
const getMyHealthRecords = async (req, res) => {
  try {
    const records = await HealthRecord.find({
      patientId: req.user.userId,
    }).sort({ recordedAt: -1 });

    return res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error("Fetch health records failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve health records.",
    });
  }
};

// Delete one of the logged-in user's health records
const deleteHealthRecord = async (req, res) => {
  try {
    const record = await HealthRecord.findOneAndDelete({
      _id: req.params.id,
      patientId: req.user.userId,
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Health record not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Health record deleted successfully.",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid health record ID.",
      });
    }

    console.error("Delete health record failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete health record.",
    });
  }
};

module.exports = {
  createHealthRecord,
  getMyHealthRecords,
  deleteHealthRecord,
};