const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const AppointmentSuggestion = require("../models/AppointmentSuggestion");
const Document = require("../models/Document");
const Medication = require("../models/Medication");
const User = require("../models/User");
const Reminder = require("../models/Reminder");

const APPOINTMENT_TYPES = ["IN_PERSON", "ONLINE", "PHONE", "OTHER"];
const APPOINTMENT_STATUSES = ["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED"];
const TEXT_LIMITS = {
  doctorName: 150,
  specialization: 120,
  hospitalName: 180,
  location: 500,
  meetingLink: 1000,
  reason: 1000,
  notes: 3000,
};

function validDate(value) {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validTimeZone(value) {
  if (typeof value !== "string" || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function cleanTextFields(body, { requiredDoctor = false } = {}) {
  const fields = {};
  for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== "string" || body[field].length > limit) {
      return { error: `${field} must be text no longer than ${limit} characters.` };
    }
    fields[field] = body[field].trim();
  }
  if (requiredDoctor && !fields.doctorName) {
    return { error: "Doctor or provider name is required." };
  }
  return { fields };
}

async function validateRelatedRecords(patientId, body) {
  const sourceDocumentIds = body.sourceDocumentIds;
  const relatedMedicationIds = body.relatedMedicationIds;
  if (sourceDocumentIds !== undefined && (!Array.isArray(sourceDocumentIds) || sourceDocumentIds.length > 30)) {
    return { error: "Select no more than 30 related documents." };
  }
  if (relatedMedicationIds !== undefined && (!Array.isArray(relatedMedicationIds) || relatedMedicationIds.length > 30)) {
    return { error: "Select no more than 30 related medications." };
  }

  for (const id of [...(sourceDocumentIds || []), ...(relatedMedicationIds || [])]) {
    if (!mongoose.isValidObjectId(id)) return { error: "A related record ID is invalid." };
  }
  const [documents, medications] = await Promise.all([
    sourceDocumentIds?.length
      ? Document.find({ _id: { $in: sourceDocumentIds }, patientId }).select("_id").lean()
      : [],
    relatedMedicationIds?.length
      ? Medication.find({ _id: { $in: relatedMedicationIds }, patientId }).select("_id").lean()
      : [],
  ]);
  if (documents.length !== (sourceDocumentIds || []).length) {
    return { error: "One or more selected documents are unavailable." };
  }
  if (medications.length !== (relatedMedicationIds || []).length) {
    return { error: "One or more selected medications are unavailable." };
  }
  return {
    fields: {
      ...(sourceDocumentIds === undefined ? {} : { sourceDocumentIds }),
      ...(relatedMedicationIds === undefined ? {} : { relatedMedicationIds }),
    },
  };
}

function validateAppointmentFields(body, { creating = false } = {}) {
  const fields = {};
  const appointmentDate = body.appointmentDate === undefined
    ? null
    : validDate(body.appointmentDate);
  if (creating && !appointmentDate) return { error: "A valid appointment date and time are required." };
  if (body.appointmentDate !== undefined && !appointmentDate) return { error: "A valid appointment date and time are required." };
  if (appointmentDate) fields.appointmentDate = appointmentDate;

  if (body.followUpDate !== undefined) {
    if (body.followUpDate === null || body.followUpDate === "") {
      fields.followUpDate = null;
    } else {
      const followUpDate = validDate(body.followUpDate);
      if (!followUpDate) return { error: "Follow-up date must be valid." };
      fields.followUpDate = followUpDate;
    }
  }
  if (body.timeZone !== undefined) {
    if (!validTimeZone(body.timeZone)) return { error: "Select a valid time zone." };
    fields.timeZone = body.timeZone;
  }
  if (body.appointmentType !== undefined) {
    if (!APPOINTMENT_TYPES.includes(body.appointmentType)) return { error: "Select a supported appointment type." };
    fields.appointmentType = body.appointmentType;
  }
  if (body.status !== undefined) {
    if (!APPOINTMENT_STATUSES.includes(body.status)) return { error: "Select a supported appointment status." };
    fields.status = body.status;
  }
  if (body.reminderPreference !== undefined) {
    if (typeof body.reminderPreference !== "boolean") return { error: "Reminder preference must be true or false." };
    fields.reminderPreference = body.reminderPreference;
  }
  if (body.timeProvided !== undefined) {
    if (typeof body.timeProvided !== "boolean") return { error: "Time-provided value must be true or false." };
    fields.timeProvided = body.timeProvided;
  }
  return { fields };
}

function validateDateStatus(appointmentDate, status, timeProvided = true) {
  const now = new Date();
  const appointmentDay = appointmentDate.toISOString().slice(0, 10);
  const currentDay = now.toISOString().slice(0, 10);
  const isFuture = timeProvided ? appointmentDate > now : appointmentDay > currentDay;
  const isPast = timeProvided ? appointmentDate <= now : appointmentDay < currentDay;
  if (status === "COMPLETED" && isFuture) {
    return "A future appointment cannot be marked completed.";
  }
  if (status !== "COMPLETED" && isPast && status !== "CANCELLED") {
    return "Past visits must be recorded with completed status.";
  }
  return null;
}

const createAppointment = async (req, res) => {
  try {
    const { fields: textFields, error: textError } = cleanTextFields(req.body, { requiredDoctor: !req.body.doctorId });
    if (textError) return res.status(400).json({ success: false, message: textError });
    const { fields, error } = validateAppointmentFields(req.body, { creating: true });
    if (error) return res.status(400).json({ success: false, message: error });
    if (!fields.timeZone) fields.timeZone = "UTC";

    let assignedDoctor = null;
    if (req.body.doctorId) {
      if (!mongoose.isValidObjectId(req.body.doctorId)) {
        return res.status(400).json({ success: false, message: "Invalid doctor ID." });
      }
      assignedDoctor = await User.findOne({
        _id: req.body.doctorId,
        role: "DOCTOR",
        isActive: true,
      }).select("_id");
      if (!assignedDoctor) return res.status(404).json({ success: false, message: "Active doctor not found." });
    }

    const appointmentTypeStatus = req.body.status || (assignedDoctor ? "REQUESTED" : "CONFIRMED");
    if (!["REQUESTED", "CONFIRMED", "COMPLETED"].includes(appointmentTypeStatus)) {
      return res.status(400).json({ success: false, message: "An appointment cannot be created as cancelled." });
    }
    const dateError = validateDateStatus(fields.appointmentDate, appointmentTypeStatus, fields.timeProvided !== false);
    if (dateError) return res.status(400).json({ success: false, message: dateError });
    const related = await validateRelatedRecords(req.user.userId, req.body);
    if (related.error) return res.status(400).json({ success: false, message: related.error });

    const appointment = await Appointment.create({
      ...textFields,
      ...fields,
      ...related.fields,
      patientId: req.user.userId,
      doctorId: assignedDoctor?._id || null,
      status: appointmentTypeStatus,
      confirmationStatus: assignedDoctor ? "CLINIC_PENDING" : "USER_MANAGED",
    });
    return res.status(201).json({
      success: true,
      message: assignedDoctor ? "Appointment request created." : "User-managed appointment saved.",
      appointment,
    });
  } catch (error) {
    console.error("Create appointment failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to create appointment." });
  }
};

const getMyAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user.userId })
      .populate("doctorId", "name")
      .populate("sourceDocumentIds", "originalName documentType reportDate createdAt extractedData reviewStatus aiSummary aiSummaryLanguage")
      .populate("relatedMedicationIds", "medicineName dosage frequency startDate endDate")
      .sort({ appointmentDate: 1, createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, count: appointments.length, appointments });
  } catch (error) {
    console.error("Fetch appointments failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve appointments." });
  }
};

const getMyAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
    })
      .populate("doctorId", "name")
      .populate("sourceDocumentIds", "originalName documentType reportDate createdAt extractedData reviewStatus aiSummary aiSummaryLanguage")
      .populate("relatedMedicationIds", "medicineName dosage frequency startDate endDate")
      .lean();
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found." });
    return res.status(200).json({ success: true, appointment });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid appointment ID." });
    console.error("Fetch appointment failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve appointment." });
  }
};

const getMyAppointmentSuggestions = async (req, res) => {
  try {
    const suggestions = await AppointmentSuggestion.find({
      patientId: req.user.userId,
      reviewStatus: "PENDING",
    })
      .populate("sourceDocumentId", "originalName documentType createdAt")
      .sort({ createdAt: -1 })
      .lean();
    const existingAppointments = await Appointment.find({
      patientId: req.user.userId,
      status: { $in: ["CONFIRMED", "COMPLETED"] },
    })
      .select("_id appointmentDate doctorName hospitalName status timeProvided timeZone")
      .lean();
    const withDuplicateHints = suggestions.map((suggestion) => {
      const day = new Date(suggestion.appointmentDate).toISOString().slice(0, 10);
      const doctor = suggestion.doctorName.trim().toLowerCase();
      const hospital = suggestion.hospitalName.trim().toLowerCase();
      const potentialDuplicateAppointments = doctor
        ? existingAppointments.filter((appointment) =>
          appointment.appointmentDate.toISOString().slice(0, 10) === day &&
          appointment.doctorName.trim().toLowerCase() === doctor &&
          (appointment.hospitalName || "").trim().toLowerCase() === hospital
        )
        : [];
      return {
        ...suggestion,
        potentialDuplicate: potentialDuplicateAppointments.length > 0,
        potentialDuplicateAppointments,
      };
    });
    return res.status(200).json({
      success: true,
      count: suggestions.length,
      suggestions: withDuplicateHints,
    });
  } catch (error) {
    console.error("Fetch appointment suggestions failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to retrieve possible appointment details." });
  }
};

const confirmAppointmentSuggestion = async (req, res) => {
  try {
    const suggestion = await AppointmentSuggestion.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
      reviewStatus: "PENDING",
    });
    if (!suggestion) return res.status(404).json({ success: false, message: "Possible appointment details not found." });

    const body = req.body || {};
    const { fields: textFields, error: textError } = cleanTextFields({
      ...body,
      doctorName: body.doctorName || suggestion.doctorName,
      hospitalName: body.hospitalName ?? suggestion.hospitalName,
    }, { requiredDoctor: true });
    if (textError) return res.status(400).json({ success: false, message: textError });
    const rawDate = body.appointmentDate || suggestion.appointmentDate;
    const appointmentDate = validDate(rawDate);
    if (!appointmentDate) return res.status(400).json({ success: false, message: "Review and enter a valid appointment date." });
    const followUpDate = body.followUpDate !== undefined
      ? body.followUpDate === null || body.followUpDate === ""
        ? null
        : validDate(body.followUpDate)
      : suggestion.followUpDate;
    if (body.followUpDate && !followUpDate) {
      return res.status(400).json({ success: false, message: "Follow-up date must be valid." });
    }
    const reminderPreference = body.reminderPreference === undefined ? false : body.reminderPreference;
    if (typeof reminderPreference !== "boolean") {
      return res.status(400).json({ success: false, message: "Reminder preference must be true or false." });
    }
    const appointmentType = body.appointmentType || "IN_PERSON";
    if (!APPOINTMENT_TYPES.includes(appointmentType)) {
      return res.status(400).json({ success: false, message: "Select a supported appointment type." });
    }

    const isFollowUp = suggestion.suggestionType === "FOLLOW_UP";
    const timeProvided = body.timeProvided === true;
    const appointmentDateIsPast = timeProvided
      ? appointmentDate <= new Date()
      : appointmentDate.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);
    const status = isFollowUp ? "CONFIRMED" : appointmentDateIsPast ? "COMPLETED" : "CONFIRMED";
    if (isFollowUp && appointmentDateIsPast) {
      return res.status(400).json({
        success: false,
        message: "This recorded follow-up date has passed. Choose a future date if you want to schedule a visit.",
      });
    }
    const timeZone = body.timeZone || "UTC";
    if (!validTimeZone(timeZone)) return res.status(400).json({ success: false, message: "Select a valid time zone." });

    const matchingAppointment = body.linkToAppointmentId
      ? await Appointment.findOne({
        _id: body.linkToAppointmentId,
        patientId: req.user.userId,
        status: { $in: ["CONFIRMED", "COMPLETED"] },
        doctorName: new RegExp(`^${textFields.doctorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        hospitalName: new RegExp(`^${(textFields.hospitalName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        appointmentDate: {
          $gte: new Date(Date.UTC(
            appointmentDate.getUTCFullYear(),
            appointmentDate.getUTCMonth(),
            appointmentDate.getUTCDate()
          )),
          $lt: new Date(Date.UTC(
            appointmentDate.getUTCFullYear(),
            appointmentDate.getUTCMonth(),
            appointmentDate.getUTCDate() + 1
          )),
        },
      })
      : null;

    if (body.linkToAppointmentId && !matchingAppointment) {
      return res.status(400).json({
        success: false,
        message: "The selected saved appointment no longer matches these reviewed details. Choose a different action.",
      });
    }
    if (matchingAppointment) {
      const sourceId = String(suggestion.sourceDocumentId);
      const alreadyLinked = (matchingAppointment.sourceDocumentIds || [])
        .some((id) => String(id) === sourceId);
      if (!alreadyLinked) matchingAppointment.sourceDocumentIds.push(suggestion.sourceDocumentId);
      if (!matchingAppointment.followUpDate && followUpDate) {
        matchingAppointment.followUpDate = followUpDate;
      }
      await matchingAppointment.save();
      try {
        suggestion.reviewStatus = "CONFIRMED";
        suggestion.linkedAppointmentId = matchingAppointment._id;
        await suggestion.save();
      } catch (error) {
        if (!alreadyLinked) {
          matchingAppointment.sourceDocumentIds = matchingAppointment.sourceDocumentIds
            .filter((id) => String(id) !== sourceId);
          await matchingAppointment.save();
        }
        throw error;
      }
      return res.status(200).json({
        success: true,
        message: "This source was linked to a matching saved appointment after your confirmation; no duplicate appointment was created.",
        appointment: matchingAppointment,
        duplicateLinked: true,
      });
    }

    const appointment = await Appointment.create({
      ...textFields,
      patientId: req.user.userId,
      appointmentDate,
      timeProvided,
      timeZone,
      appointmentType,
      status,
      confirmationStatus: "USER_MANAGED",
      sourceDocumentIds: [suggestion.sourceDocumentId],
      reason: isFollowUp ? "Follow-up noted in a medical record" : body.reason || "",
      followUpDate: isFollowUp ? appointmentDate : followUpDate,
      reminderPreference,
    });
    try {
      suggestion.reviewStatus = "CONFIRMED";
      suggestion.linkedAppointmentId = appointment._id;
      await suggestion.save();
    } catch (error) {
      await Appointment.deleteOne({ _id: appointment._id, patientId: req.user.userId });
      throw error;
    }
    return res.status(200).json({
      success: true,
      message: "The possible appointment details were confirmed and saved to your personal schedule.",
      appointment,
    });
  } catch (error) {
    if (error.name === "CastError" && req.body?.linkToAppointmentId) {
      return res.status(400).json({ success: false, message: "The selected saved appointment ID is invalid." });
    }
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid suggestion ID." });
    console.error("Confirm appointment suggestion failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to confirm possible appointment details." });
  }
};

const ignoreAppointmentSuggestion = async (req, res) => {
  try {
    const suggestion = await AppointmentSuggestion.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
      reviewStatus: "PENDING",
    });
    if (!suggestion) return res.status(404).json({ success: false, message: "Possible appointment details not found." });
    suggestion.reviewStatus = "IGNORED";
    await suggestion.save();
    return res.status(200).json({ success: true, message: "Possible appointment details dismissed." });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid suggestion ID." });
    console.error("Ignore appointment suggestion failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to dismiss possible appointment details." });
  }
};

const updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ _id: req.params.id, patientId: req.user.userId });
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found." });
    if (["COMPLETED", "CANCELLED"].includes(appointment.status)) {
      return res.status(400).json({ success: false, message: "Completed or cancelled appointments cannot be edited." });
    }
    if (req.body?.status !== undefined) {
      return res.status(400).json({ success: false, message: "Use the status action to complete or cancel an appointment." });
    }

    const { fields: textFields, error: textError } = cleanTextFields(req.body);
    if (textError) return res.status(400).json({ success: false, message: textError });
    const { fields, error } = validateAppointmentFields(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    if (fields.appointmentDate) {
      const dateError = validateDateStatus(fields.appointmentDate, appointment.status);
      if (dateError) return res.status(400).json({ success: false, message: dateError });
    }
    const related = await validateRelatedRecords(req.user.userId, req.body);
    if (related.error) return res.status(400).json({ success: false, message: related.error });
    const nextDate = fields.appointmentDate || appointment.appointmentDate;
    const nextStatus = appointment.status;
    const dateError = validateDateStatus(nextDate, nextStatus, fields.timeProvided ?? appointment.timeProvided !== false);
    if (dateError) return res.status(400).json({ success: false, message: dateError });
    Object.assign(appointment, textFields, fields, related.fields);
    await appointment.save();
    try {
      await syncAppointmentReminders(appointment);
    } catch (error) {
      console.error("Appointment saved but linked reminders could not be rescheduled:", error.message);
      return res.status(503).json({
        success: false,
        code: "REMINDER_SYNC_FAILED",
        message: "Appointment updated, but linked reminders could not be rescheduled. Please review those reminders.",
      });
    }
    return res.status(200).json({ success: true, message: "Appointment updated.", appointment });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid appointment ID." });
    console.error("Update appointment failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update appointment." });
  }
};

const updateAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["COMPLETED", "CANCELLED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be COMPLETED or CANCELLED." });
    }
    const appointment = await Appointment.findOne({ _id: req.params.id, patientId: req.user.userId });
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found." });
    if (["COMPLETED", "CANCELLED"].includes(appointment.status)) {
      return res.status(400).json({ success: false, message: "This appointment is already closed." });
    }
    const dateError = validateDateStatus(
      appointment.appointmentDate,
      status,
      appointment.timeProvided !== false
    );
    if (dateError) return res.status(400).json({ success: false, message: dateError });
    appointment.status = status;
    await appointment.save();
    if (["CANCELLED", "COMPLETED"].includes(status)) {
      try {
        await Reminder.updateMany(
          {
            userId: req.user.userId,
            appointmentId: appointment._id,
            isActive: true,
            isCompleted: false,
          },
          { $set: { isActive: false, cancelledAt: new Date() } }
        );
      } catch (error) {
        console.error("Appointment status saved but linked reminders could not be cancelled:", error.message);
        return res.status(503).json({
          success: false,
          code: "REMINDER_SYNC_FAILED",
          message: `Appointment ${status.toLowerCase()}, but linked reminders could not be cancelled. Please review those reminders.`,
        });
      }
    }
    return res.status(200).json({
      success: true,
      message: status === "CANCELLED" ? "Appointment cancelled." : "Visit marked completed.",
      appointment,
    });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid appointment ID." });
    console.error("Update appointment status failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update appointment status." });
  }
};

async function syncAppointmentReminders(appointment) {
  const reminders = await Reminder.find({
    userId: appointment.patientId,
    appointmentId: appointment._id,
    isActive: true,
    isCompleted: false,
    dismissedAt: null,
  }).select("_id appointmentLeadMinutes");
  await Promise.all(reminders.map((reminder) => {
    const leadMinutes = reminder.appointmentLeadMinutes || 0;
    return Reminder.updateOne(
      { _id: reminder._id, userId: appointment.patientId },
      {
        $set: {
          scheduledAt: new Date(appointment.appointmentDate.getTime() - leadMinutes * 60_000),
          timeZone: appointment.timeZone || "UTC",
        },
      }
    );
  }));
}

const cancelAppointment = (req, res) => {
  req.body = { status: "CANCELLED" };
  return updateAppointmentStatus(req, res);
};

module.exports = {
  createAppointment,
  getMyAppointments,
  getMyAppointmentById,
  updateAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  getMyAppointmentSuggestions,
  confirmAppointmentSuggestion,
  ignoreAppointmentSuggestion,
  validateDateStatus,
};
