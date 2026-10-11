
const mongoose = require("mongoose");
const LabTest = require("../models/LabTest");
const User = require("../models/User");
const Hospital = require("../models/Hospital");

const LAB_ROLES = ["LAB_TECHNICIAN", "HOSPITAL_ADMIN"];

const VALID_TRANSITIONS = {
  REQUESTED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["SAMPLE_COLLECTED", "CANCELLED"],
  SAMPLE_COLLECTED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

// Patient requests a lab test
const requestLabTest = async (req, res) => {
  try {
    if (req.user.role !== "PATIENT") {
      return res.status(403).json({
        success: false,
        message: "Only patients can request a lab test.",
      });
    }

    const { testName, hospitalId, laboratoryName, instructions, scheduledAt } =
      req.body;

    if (!testName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Test name is required.",
      });
    }

    let hospital = null;

    if (hospitalId) {
      if (!mongoose.isValidObjectId(hospitalId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid hospital ID.",
        });
      }

      hospital = await Hospital.findOne({
        _id: hospitalId,
        isActive: true,
        isVerified: true,
      }).select("_id name");

      if (!hospital) {
        return res.status(404).json({
          success: false,
          message: "Verified hospital not found.",
        });
      }
    }

    let parsedSchedule = null;

    if (scheduledAt) {
      parsedSchedule = new Date(scheduledAt);

      if (Number.isNaN(parsedSchedule.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid scheduled date.",
        });
      }

      if (parsedSchedule < new Date()) {
        return res.status(400).json({
          success: false,
          message: "The scheduled date must be in the future.",
        });
      }
    }

    const test = await LabTest.create({
      patientId: req.user.userId,
      requestedBy: req.user.userId,
      hospitalId: hospital?._id || null,
      laboratoryName: hospital?.name || laboratoryName?.trim() || "",
      testName: testName.trim(),
      instructions: instructions || "",
      scheduledAt: parsedSchedule,
      status: "REQUESTED",
      statusHistory: [
        {
          status: "REQUESTED",
          changedBy: req.user.userId,
          note: "Test requested by patient.",
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Lab test requested successfully.",
      test,
    });
  } catch (error) {
    console.error("Request lab test error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to request lab test.",
    });
  }
};

// Patient views their own requests
const getMyLabTests = async (req, res) => {
  try {
    if (req.user.role !== "PATIENT") {
      return res.status(403).json({
        success: false,
        message: "This endpoint is for patients.",
      });
    }

    const filter = { patientId: req.user.userId };

    if (req.query.status) {
      if (!LabTest.schema.path("status").enumValues.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid test status.",
        });
      }

      filter.status = req.query.status;
    }

    const tests = await LabTest.find(filter)
      .sort({ createdAt: -1 })
      .populate("hospitalId", "name city state phone")
      .populate("assignedTechnician", "name")
      .lean();

    return res.status(200).json({
      success: true,
      count: tests.length,
      tests,
    });
  } catch (error) {
    console.error("Get patient lab tests error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve lab test requests.",
    });
  }
};

// Laboratory staff view requests assigned to their hospital or themselves
const getLabQueue = async (req, res) => {
  try {
    if (!LAB_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Laboratory staff access required.",
      });
    }

    const filter = {};

    if (req.query.status) {
      if (!LabTest.schema.path("status").enumValues.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid test status.",
        });
      }

      filter.status = req.query.status;
    }

    if (req.user.role === "LAB_TECHNICIAN") {
      filter.assignedTechnician = req.user.userId;
    }

    const tests = await LabTest.find(filter)
      .sort({ scheduledAt: 1, createdAt: 1 })
      .populate("patientId", "name email phone")
      .populate("hospitalId", "name city")
      .lean();

    return res.status(200).json({
      success: true,
      count: tests.length,
      tests,
    });
  } catch (error) {
    console.error("Get lab queue error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve laboratory queue.",
    });
  }
};

// Update status with transition validation
const updateLabTestStatus = async (req, res) => {
  try {
    if (!LAB_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Laboratory staff access required.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lab test ID.",
      });
    }

    const { status, note } = req.body;

    if (!Object.prototype.hasOwnProperty.call(VALID_TRANSITIONS, status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status.",
      });
    }

    const test = await LabTest.findById(req.params.id);

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Lab test request not found.",
      });
    }

    // Technicians may only update tests assigned to them.
    if (
      req.user.role === "LAB_TECHNICIAN" &&
      String(test.assignedTechnician) !== String(req.user.userId)
    ) {
      return res.status(403).json({
        success: false,
        message: "This test is not assigned to you.",
      });
    }

    if (!VALID_TRANSITIONS[test.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${test.status} to ${status}.`,
      });
    }

    test.status = status;

    test.statusHistory.push({
      status,
      changedBy: req.user.userId,
      note: typeof note === "string" ? note.trim().slice(0, 500) : "",
    });

    await test.save();

    return res.status(200).json({
      success: true,
      message: "Lab test status updated successfully.",
      test,
    });
  } catch (error) {
    console.error("Update lab test status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update lab test status.",
    });
  }
};

// Patient cancels their own request when allowed
const cancelMyLabTest = async (req, res) => {
  try {
    if (req.user.role !== "PATIENT") {
      return res.status(403).json({
        success: false,
        message: "Only patients can cancel their own requests.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lab test ID.",
      });
    }

    const test = await LabTest.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
    });

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Lab test request not found.",
      });
    }

    if (!VALID_TRANSITIONS[test.status].includes("CANCELLED")) {
      return res.status(400).json({
        success: false,
        message: "This lab test can no longer be cancelled.",
      });
    }

    test.status = "CANCELLED";

    test.statusHistory.push({
      status: "CANCELLED",
      changedBy: req.user.userId,
      note: "Cancelled by patient.",
    });

    await test.save();

    return res.status(200).json({
      success: true,
      message: "Lab test request cancelled.",
      test,
    });
  } catch (error) {
    console.error("Cancel lab test error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to cancel lab test.",
    });
  }
};

module.exports = {
  requestLabTest,
  getMyLabTests,
  getLabQueue,
  updateLabTestStatus,
  cancelMyLabTest,
};
