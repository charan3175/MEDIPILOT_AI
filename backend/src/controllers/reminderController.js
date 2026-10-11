const Reminder = require("../models/Reminder");
const Medication = require("../models/Medication");
const Appointment = require("../models/Appointment");
const Document = require("../models/Document");

const REMINDER_TYPES = ["MEDICATION", "APPOINTMENT", "FOLLOW_UP", "WATER", "GENERAL"];
const REPEAT_TYPES = ["ONCE", "DAILY", "WEEKLY"];

function validTimeZone(value) {
  if (typeof value !== "string" || value.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const createReminder = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      title,
      message,
      reminderType,
      scheduledAt,
      repeat,
      medicationId,
      appointmentId,
      sourceDocumentId,
      timeZone,
      appointmentLeadMinutes,
    } = body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reminder title is required.",
      });
    }
    if (title.length > 150 || (message !== undefined && (typeof message !== "string" || message.length > 500))) {
      return res.status(400).json({ success: false, message: "Reminder title or note exceeds the supported length." });
    }

    if (
      typeof scheduledAt !== "string" ||
      !scheduledAt.trim() ||
      Number.isNaN(Date.parse(scheduledAt))
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid scheduled date and time are required.",
      });
    }

    if (repeat !== undefined && repeat !== "ONCE") {
      return res.status(400).json({
        success: false,
        message: "Recurring reminders are unavailable until a background scheduler is configured. Choose a one-time reminder.",
      });
    }

    if (
      reminderType !== undefined &&
      !REMINDER_TYPES.includes(reminderType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid reminder type.",
      });
    }

    const parsedTime = new Date(scheduledAt);
    if (parsedTime < new Date(Date.now() - 60_000)) {
      return res.status(400).json({ success: false, message: "Reminder time must be now or in the future." });
    }
    const selectedTimeZone = timeZone || "UTC";
    if (!validTimeZone(selectedTimeZone)) {
      return res.status(400).json({ success: false, message: "Select a valid time zone." });
    }
    let medication = null;
    if (medicationId) {
      if (
        typeof medicationId !== "string" ||
        !/^[a-f\d]{24}$/i.test(medicationId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid medication ID.",
        });
      }

      medication = await Medication.findOne({
        _id: medicationId,
        patientId: req.user.userId,
        status: "ACTIVE",
      });

      if (!medication) {
        return res.status(404).json({
          success: false,
          message: "Active medication not found.",
        });
      }
    }

    if (reminderType === "MEDICATION" && !medication) {
      return res.status(400).json({ success: false, message: "Select an active medication record for this reminder." });
    }
    if (appointmentId && (
      typeof appointmentId !== "string" ||
      !/^[a-f\d]{24}$/i.test(appointmentId)
    )) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID." });
    }
    let appointment = null;
    if (appointmentId) {
      appointment = await Appointment.findOne({
        _id: appointmentId,
        patientId: req.user.userId,
        status: "CONFIRMED",
      });
      if (!appointment) return res.status(404).json({ success: false, message: "Confirmed appointment not found." });
    }
    if (reminderType === "APPOINTMENT" && !appointment) {
      return res.status(400).json({ success: false, message: "Select a confirmed appointment for this reminder." });
    }
    if (sourceDocumentId && (
      typeof sourceDocumentId !== "string" ||
      !/^[a-f\d]{24}$/i.test(sourceDocumentId)
    )) {
      return res.status(400).json({ success: false, message: "Invalid source document ID." });
    }
    if (sourceDocumentId) {
      const sourceDocument = await Document.findOne({
        _id: sourceDocumentId,
        patientId: req.user.userId,
      }).select("_id");
      if (!sourceDocument) return res.status(404).json({ success: false, message: "Source document not found." });
    }
    if (appointmentLeadMinutes !== undefined && (
      !Number.isInteger(appointmentLeadMinutes) ||
      appointmentLeadMinutes < 0 ||
      appointmentLeadMinutes > 10080
    )) {
      return res.status(400).json({ success: false, message: "Appointment lead time must be between 0 and 10080 minutes." });
    }
    const finalScheduledAt = appointment
      ? new Date(appointment.appointmentDate.getTime() - (appointmentLeadMinutes || 0) * 60_000)
      : parsedTime;
    if (finalScheduledAt < new Date(Date.now() - 60_000)) {
      return res.status(400).json({ success: false, message: "The resulting reminder time must be now or in the future." });
    }
    const duplicate = await Reminder.findOne({
      userId: req.user.userId,
      reminderType: reminderType || "GENERAL",
      medicationId: medication?._id || null,
      appointmentId: appointment?._id || null,
      sourceDocumentId: sourceDocumentId || null,
      scheduledAt: finalScheduledAt,
      repeat: repeat || "ONCE",
      isActive: true,
      isCompleted: false,
      dismissedAt: null,
    }).select("_id");
    if (duplicate) {
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_REMINDER",
        message: "An active reminder with the same source, time, and repeat pattern already exists.",
        reminderId: duplicate._id,
      });
    }

    const reminder = await Reminder.create({
      userId: req.user.userId,
      medicationId: medicationId || null,
      appointmentId: appointment?._id || null,
      sourceDocumentId: sourceDocumentId || null,
      title: title.trim(),
      message:
        typeof message === "string" ? message.trim() : "",
      reminderType: reminderType || "GENERAL",
      scheduledAt: finalScheduledAt,
      timeZone: appointment?.timeZone || selectedTimeZone,
      appointmentLeadMinutes: appointment ? appointmentLeadMinutes || 0 : null,
      repeat: repeat || "ONCE",
    });

    return res.status(201).json({
      success: true,
      message: "Reminder created successfully.",
      reminder,
    });
  } catch (error) {
    console.error("Create reminder failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create reminder.",
    });
  }
};

const getMyReminders = async (req, res) => {
  try {
    const filter = {
      userId: req.user.userId,
    };

    if (req.query.active === "true") {
      filter.isActive = true;
    } else if (req.query.active === "false") {
      filter.isActive = false;
    }

    const reminders = await Reminder.find(filter)
      .populate("medicationId", "medicineName dosage frequency")
      .populate("appointmentId", "doctorName hospitalName reason appointmentDate timeZone status")
      .populate("sourceDocumentId", "originalName documentType reportDate createdAt")
      .sort({ scheduledAt: 1 })
      .limit(200)
      .lean();

    return res.status(200).json({
      success: true,
      count: reminders.length,
      reminders,
    });
  } catch (error) {
    console.error("Fetch reminders failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load reminders.",
    });
  }
};

const updateReminder = async (req, res) => {
  try {
    const allowedFields = [
      "title",
      "message",
      "reminderType",
      "scheduledAt",
      "repeat",
      "isCompleted",
      "isActive",
    ];
    allowedFields.push(
      "medicationId",
      "appointmentId",
      "sourceDocumentId",
      "timeZone",
      "appointmentLeadMinutes",
      "isPaused"
    );

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    if (
      updates.title !== undefined &&
      (typeof updates.title !== "string" || !updates.title.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Reminder title cannot be empty.",
      });
    }

    if (updates.title !== undefined) {
      updates.title = updates.title.trim();
    }
    if (updates.message !== undefined && (
      typeof updates.message !== "string" || updates.message.length > 500
    )) {
      return res.status(400).json({ success: false, message: "Reminder note must be text no longer than 500 characters." });
    }

    if (
      updates.scheduledAt !== undefined &&
      (typeof updates.scheduledAt !== "string" ||
        Number.isNaN(Date.parse(updates.scheduledAt)))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid scheduled date and time.",
      });
    }

    if (updates.scheduledAt !== undefined) {
      updates.scheduledAt = new Date(updates.scheduledAt);
      if (updates.scheduledAt < new Date(Date.now() - 60_000)) {
        return res.status(400).json({ success: false, message: "Reminder time must be now or in the future." });
      }
    }

    if (updates.timeZone !== undefined && !validTimeZone(updates.timeZone)) {
      return res.status(400).json({ success: false, message: "Select a valid time zone." });
    }
    if (
      updates.appointmentLeadMinutes !== undefined &&
      (!Number.isInteger(updates.appointmentLeadMinutes) || updates.appointmentLeadMinutes < 0 || updates.appointmentLeadMinutes > 10080)
    ) {
      return res.status(400).json({ success: false, message: "Appointment lead time must be between 0 and 10080 minutes." });
    }

    const userId = req.user.userId;
    if (updates.medicationId !== undefined && updates.medicationId !== null && updates.medicationId !== "") {
      if (typeof updates.medicationId !== "string" || !/^[a-f\d]{24}$/i.test(updates.medicationId)) {
        return res.status(400).json({ success: false, message: "Invalid medication ID." });
      }
      const medication = await Medication.findOne({
        _id: updates.medicationId,
        patientId: userId,
        status: "ACTIVE",
      }).select("_id");
      if (!medication) return res.status(404).json({ success: false, message: "Active medication not found." });
      updates.medicationId = medication._id;
    } else if (updates.medicationId === "") {
      updates.medicationId = null;
    }
    if (updates.appointmentId !== undefined && updates.appointmentId !== null && updates.appointmentId !== "") {
      if (typeof updates.appointmentId !== "string" || !/^[a-f\d]{24}$/i.test(updates.appointmentId)) {
        return res.status(400).json({ success: false, message: "Invalid appointment ID." });
      }
      const appointment = await Appointment.findOne({
        _id: updates.appointmentId,
        patientId: userId,
        status: "CONFIRMED",
      }).select("_id appointmentDate timeZone");
      if (!appointment) return res.status(404).json({ success: false, message: "Confirmed appointment not found." });
      updates.appointmentId = appointment._id;
      const leadMinutes = updates.appointmentLeadMinutes ?? 0;
      updates.scheduledAt = new Date(appointment.appointmentDate.getTime() - leadMinutes * 60_000);
      updates.timeZone = appointment.timeZone || "UTC";
    } else if (updates.appointmentId === "") {
      updates.appointmentId = null;
    }
    if (updates.sourceDocumentId !== undefined && updates.sourceDocumentId !== null && updates.sourceDocumentId !== "") {
      if (typeof updates.sourceDocumentId !== "string" || !/^[a-f\d]{24}$/i.test(updates.sourceDocumentId)) {
        return res.status(400).json({ success: false, message: "Invalid source document ID." });
      }
      const source = await Document.findOne({ _id: updates.sourceDocumentId, patientId: userId }).select("_id");
      if (!source) return res.status(404).json({ success: false, message: "Source document not found." });
      updates.sourceDocumentId = source._id;
    } else if (updates.sourceDocumentId === "") {
      updates.sourceDocumentId = null;
    }
    if (
      updates.repeat !== undefined &&
      !REPEAT_TYPES.includes(updates.repeat)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid repeat option.",
      });
    }

    if (
      updates.reminderType !== undefined &&
      !REMINDER_TYPES.includes(updates.reminderType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid reminder type.",
      });
    }

    for (const field of ["isCompleted", "isActive", "isPaused"]) {
      if (
        updates[field] !== undefined &&
        typeof updates[field] !== "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message: `${field} must be true or false.`,
        });
      }
    }

    const existing = await Reminder.findOne({ _id: req.params.id, userId });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Reminder not found." });
    }
    const nextScheduledAt = updates.scheduledAt || existing.scheduledAt;
    const nextType = updates.reminderType || existing.reminderType;
    const nextRepeat = updates.repeat || existing.repeat;
    const nextMedication = updates.medicationId === undefined ? existing.medicationId : updates.medicationId;
    const nextAppointment = updates.appointmentId === undefined ? existing.appointmentId : updates.appointmentId;
    const nextSource = updates.sourceDocumentId === undefined ? existing.sourceDocumentId : updates.sourceDocumentId;
    if (
      (nextType === "MEDICATION" && !nextMedication) ||
      (nextType === "APPOINTMENT" && !nextAppointment)
    ) {
      return res.status(400).json({ success: false, message: "Select the related medication or confirmed appointment for this reminder type." });
    }
    if (updates.isCompleted === true && existing.scheduledAt > new Date()) {
      return res.status(400).json({ success: false, message: "A future reminder cannot be marked complete." });
    }
    if (updates.isCompleted === true && existing.reminderType === "MEDICATION") {
      updates.completedAt = new Date();
    }
    if (updates.isActive === false) updates.cancelledAt = new Date();
    if (updates.isActive === true) updates.cancelledAt = null;
    if (updates.isCompleted === true) updates.isActive = false;

    const duplicate = await Reminder.findOne({
      _id: { $ne: req.params.id },
      userId,
      reminderType: nextType,
      medicationId: nextMedication || null,
      appointmentId: nextAppointment || null,
      sourceDocumentId: nextSource || null,
      scheduledAt: nextScheduledAt,
      repeat: nextRepeat,
      isActive: updates.isActive ?? existing.isActive,
      isCompleted: false,
      dismissedAt: null,
    }).select("_id");
    if (duplicate && (updates.isActive ?? existing.isActive)) {
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_REMINDER",
        message: "An active reminder with the same source, time, and repeat pattern already exists.",
        reminderId: duplicate._id,
      });
    }

    const reminder = await Reminder.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.userId,
      },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reminder updated successfully.",
      reminder,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid reminder ID.",
      });
    }

    console.error("Update reminder failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update reminder.",
    });
  }
};

const deleteReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reminder deleted successfully.",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid reminder ID.",
      });
    }

    console.error("Delete reminder failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to delete reminder.",
    });
  }
};

const dismissReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId, isActive: true },
      { $set: { dismissedAt: new Date(), isActive: false } },
      { new: true, runValidators: true }
    );
    if (!reminder) return res.status(404).json({ success: false, message: "Active reminder not found." });
    return res.status(200).json({ success: true, message: "Reminder dismissed.", reminder });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid reminder ID." });
    console.error("Dismiss reminder failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to dismiss reminder." });
  }
};

const pauseReminder = async (req, res) => setReminderPause(req, res, true);
const resumeReminder = async (req, res) => setReminderPause(req, res, false);

async function setReminderPause(req, res, isPaused) {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.userId,
        isActive: true,
        isCompleted: false,
        dismissedAt: null,
      },
      { $set: { isPaused } },
      { new: true, runValidators: true }
    );
    if (!reminder) return res.status(404).json({ success: false, message: "Active reminder not found." });
    return res.status(200).json({
      success: true,
      message: isPaused ? "Reminder paused." : "Reminder resumed.",
      reminder,
    });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid reminder ID." });
    console.error("Update reminder pause state failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update reminder." });
  }
}

const cancelReminder = async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId, isActive: true },
      { $set: { isActive: false, isPaused: false, cancelledAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!reminder) return res.status(404).json({ success: false, message: "Active reminder not found." });
    return res.status(200).json({ success: true, message: "Reminder cancelled.", reminder });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid reminder ID." });
    console.error("Cancel reminder failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to cancel reminder." });
  }
};

module.exports = {
  createReminder,
  getMyReminders,
  updateReminder,
  deleteReminder,
  dismissReminder,
  pauseReminder,
  resumeReminder,
  cancelReminder,
};