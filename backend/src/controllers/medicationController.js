const mongoose = require("mongoose");
const Medication = require("../models/Medication");
const MedicationSuggestion = require("../models/MedicationSuggestion");
const Document = require("../models/Document");
const Reminder = require("../models/Reminder");

const MEDICATION_TEXT_LIMITS = {
  medicineName: 200,
  prescribedFor: 500,
  dosage: 100,
  strength: 100,
  dosageForm: 100,
  route: 100,
  frequency: 200,
  prescribedBy: 150,
  duration: 100,
  foodInstructions: 300,
  instructions: 1000,
};

function validateMedicationBody(body, { requireName = false } = {}) {
  const fields = {};
  for (const [field, limit] of Object.entries(MEDICATION_TEXT_LIMITS)) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== "string" || body[field].length > limit) {
      return { error: `${field} must be text no longer than ${limit} characters.` };
    }
    fields[field] = body[field].trim();
  }
  if (requireName && !fields.medicineName) {
    return { error: "Medicine name is required." };
  }
  for (const field of ["startDate", "endDate", "prescriptionDate"]) {
    if (body[field] === undefined) continue;
    if (body[field] === null || body[field] === "") {
      fields[field] = null;
      continue;
    }
    if (
      !(typeof body[field] === "string" || body[field] instanceof Date) ||
      Number.isNaN(new Date(body[field]).getTime())
    ) {
      return { error: `Invalid ${field}.` };
    }
    fields[field] = new Date(body[field]);
  }
  if (
    fields.startDate && fields.endDate &&
    fields.endDate < fields.startDate
  ) {
    return { error: "End date cannot be before start date." };
  }
  if (body.reminderTimes !== undefined && (
    !Array.isArray(body.reminderTimes) ||
    body.reminderTimes.length > 12 ||
    !body.reminderTimes.every((time) => typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time))
  )) {
    return { error: "Reminder times must use HH:mm format." };
  }
  if (body.reminderEnabled !== undefined && typeof body.reminderEnabled !== "boolean") {
    return { error: "Reminder preference must be true or false." };
  }
  return { fields };
}

const createMedication = async (req, res) => {
  try {
    const body = req.body || {};
    const { fields, error } = validateMedicationBody(body, { requireName: true });
    if (error) return res.status(400).json({ success: false, message: error });
    let sourceDocumentId = null;
    if (body.sourceDocumentId) {
      if (!mongoose.isValidObjectId(body.sourceDocumentId)) {
        return res.status(400).json({ success: false, message: "Invalid source prescription ID." });
      }
      const source = await Document.findOne({
        _id: body.sourceDocumentId,
        patientId: req.user.userId,
      }).select("_id");
      if (!source) return res.status(400).json({ success: false, message: "The selected prescription is unavailable." });
      sourceDocumentId = source._id;
    }

    const medication = await Medication.create({
      patientId: req.user.userId,
      ...fields,
      sourceDocumentId,
      source: "USER_ENTERED",
      verificationStatus: "USER_ENTERED",
    });

    return res.status(201).json({
      success: true,
      message: "Medication added successfully.",
      medication,
    });
  } catch (error) {
    console.error("Create medication failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to add medication.",
    });
  }
};

const getMyMedications = async (req, res) => {
  try {
    const filter = { patientId: req.user.userId };

    if (
      ["ACTIVE", "COMPLETED", "STOPPED"].includes(req.query.status)
    ) {
      filter.status = req.query.status;
    }

    const medications = await Medication.find(filter)
      .populate("sourceDocumentId", "originalName documentType reportDate createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: medications.length,
      medications,
    });
  } catch (error) {
    console.error("Fetch medications failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load medications.",
    });
  }
};

const getMyMedicationSuggestions = async (req, res) => {
  try {
    const suggestions = await MedicationSuggestion.find({
      patientId: req.user.userId,
      reviewStatus: "PENDING",
    })
      .populate("sourceDocumentId", "originalName documentType reportDate createdAt")
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, count: suggestions.length, suggestions });
  } catch (error) {
    console.error("Fetch medication suggestions failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load possible medicines." });
  }
};

const confirmMedicationSuggestion = async (req, res) => {
  try {
    const suggestion = await MedicationSuggestion.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
      reviewStatus: "PENDING",
    });
    if (!suggestion) {
      return res.status(404).json({ success: false, message: "Medicine suggestion not found." });
    }
    const { fields, error } = validateMedicationBody({
      ...suggestion.toObject(),
      ...req.body,
      medicineName: req.body?.medicineName ?? suggestion.medicineName,
      startDate: req.body?.startDate ?? suggestion.startDate,
      endDate: req.body?.endDate ?? suggestion.endDate,
      prescriptionDate: req.body?.prescriptionDate ?? suggestion.prescriptionDate,
    }, { requireName: true });
    if (error) return res.status(400).json({ success: false, message: error });
    if (!fields.medicineName) {
      return res.status(400).json({ success: false, message: "Medicine name is required." });
    }
    const source = await Document.findOne({
      _id: suggestion.sourceDocumentId,
      patientId: req.user.userId,
    }).select("_id");
    if (!source) {
      return res.status(400).json({ success: false, message: "The source prescription is no longer available." });
    }
    const medication = await Medication.create({
      ...fields,
      patientId: req.user.userId,
      source: "PRESCRIPTION_REPORT",
      sourceDocumentId: source._id,
      verificationStatus: "USER_CONFIRMED",
      status: "ACTIVE",
    });
    try {
      suggestion.reviewStatus = "CONFIRMED";
      suggestion.linkedMedicationId = medication._id;
      await suggestion.save();
    } catch (error) {
      await Medication.deleteOne({ _id: medication._id, patientId: req.user.userId });
      throw error;
    }
    return res.status(200).json({
      success: true,
      message: "Medicine details reviewed and added to your medication list.",
      medication,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid medicine suggestion ID." });
    }
    console.error("Confirm medication suggestion failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to confirm medicine details." });
  }
};

const ignoreMedicationSuggestion = async (req, res) => {
  try {
    const suggestion = await MedicationSuggestion.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
      reviewStatus: "PENDING",
    });
    if (!suggestion) return res.status(404).json({ success: false, message: "Medicine suggestion not found." });
    suggestion.reviewStatus = "IGNORED";
    await suggestion.save();
    return res.status(200).json({ success: true, message: "Medicine suggestion dismissed." });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid medicine suggestion ID." });
    console.error("Ignore medication suggestion failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to dismiss medicine suggestion." });
  }
};

const getMyMedicationById = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
    })
      .populate("sourceDocumentId", "originalName documentType reportDate createdAt")
      .lean();
    if (!medication) return res.status(404).json({ success: false, message: "Medication not found." });
    return res.status(200).json({ success: true, medication });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid medication ID." });
    console.error("Fetch medication failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load medication details." });
  }
};

const updateMedication = async (req, res) => {
  try {
    const allowedFields = [
      "medicineName",
      "prescribedFor",
      "dosage",
      "strength",
      "dosageForm",
      "route",
      "frequency",
      "prescribedBy",
      "duration",
      "foodInstructions",
      "startDate",
      "endDate",
      "prescriptionDate",
      "instructions",
      "reminderEnabled",
      "reminderTimes",
      "status",
      "sourceDocumentId",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
      const { error: fieldError } = validateMedicationBody(updates);
      if (fieldError) return res.status(400).json({ success: false, message: fieldError });
      if (updates.sourceDocumentId !== undefined && updates.sourceDocumentId !== null && updates.sourceDocumentId !== "") {
        if (!mongoose.isValidObjectId(updates.sourceDocumentId)) {
          return res.status(400).json({ success: false, message: "Invalid source prescription ID." });
        }
        const source = await Document.findOne({
          _id: updates.sourceDocumentId,
          patientId: req.user.userId,
        }).select("_id");
        if (!source) return res.status(400).json({ success: false, message: "The selected prescription is unavailable." });
        updates.sourceDocumentId = source._id;
      } else if (updates.sourceDocumentId === "") {
        updates.sourceDocumentId = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    if (
      updates.medicineName !== undefined &&
      (typeof updates.medicineName !== "string" ||
        !updates.medicineName.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Medicine name cannot be empty.",
      });
    }

    if (
      updates.status !== undefined &&
      !["ACTIVE", "COMPLETED", "STOPPED"].includes(updates.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid medication status.",
      });
    }

    if (updates.reminderTimes !== undefined) {
      if (
        !Array.isArray(updates.reminderTimes) ||
        !updates.reminderTimes.every(
          (time) =>
            typeof time === "string" &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Reminder times must use HH:mm format.",
        });
      }
    }

    for (const field of ["startDate", "endDate", "prescriptionDate"]) {
      if (
        updates[field] !== undefined &&
        updates[field] !== null &&
        (Number.isNaN(Date.parse(updates[field])) ||
          typeof updates[field] !== "string")
      ) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${field}.`,
        });
      }

      if (updates[field] === "") {
        updates[field] = null;
      }
    }

    const existing = await Medication.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Medication not found.",
      });
    }

    const startDate =
      updates.startDate !== undefined
        ? updates.startDate
        : existing.startDate;

    const endDate =
      updates.endDate !== undefined
        ? updates.endDate
        : existing.endDate;

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be before start date.",
      });
    }

    if (updates.medicineName) {
      updates.medicineName = updates.medicineName.trim();
    }

    const medication = await Medication.findOneAndUpdate(
      {
        _id: req.params.id,
        patientId: req.user.userId,
      },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (["COMPLETED", "STOPPED"].includes(updates.status)) {
      try {
        await Reminder.updateMany(
          {
            userId: req.user.userId,
            medicationId: medication._id,
            isActive: true,
            isCompleted: false,
          },
          { $set: { isActive: false, isPaused: false, cancelledAt: new Date() } }
        );
      } catch (error) {
        console.error("Medication status saved but linked reminders could not be cancelled:", error.message);
        return res.status(503).json({
          success: false,
          code: "REMINDER_SYNC_FAILED",
          message: "Medication status updated, but its future reminders could not be cancelled. Please review those reminders.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Medication updated successfully.",
      medication,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid medication ID.",
      });
    }

    console.error("Update medication failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update medication.",
    });
  }
};

const deleteMedication = async (req, res) => {
  try {
    const medication = await Medication.findOneAndDelete({
      _id: req.params.id,
      patientId: req.user.userId,
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: "Medication not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Medication deleted successfully.",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid medication ID.",
      });
    }

    console.error("Delete medication failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete medication.",
    });
  }
};

module.exports = {
  createMedication,
  getMyMedications,
  getMyMedicationById,
  updateMedication,
  deleteMedication,
  getMyMedicationSuggestions,
  confirmMedicationSuggestion,
  ignoreMedicationSuggestion,
};