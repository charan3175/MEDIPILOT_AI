const test = require("node:test");
const assert = require("node:assert/strict");
const Appointment = require("../models/Appointment");
const Reminder = require("../models/Reminder");
const {
  confirmAppointmentSuggestion,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
} = require("./appointmentController");
const AppointmentSuggestion = require("../models/AppointmentSuggestion");

function responseStub() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("creates an authenticated user-managed appointment without claiming an external booking", async (t) => {
  const originalCreate = Appointment.create;
  t.after(() => {
    Appointment.create = originalCreate;
  });

  let saved;
  Appointment.create = async (body) => {
    saved = body;
    return { ...body, _id: "appointment-id" };
  };
  const response = responseStub();

  await createAppointment(
    {
      user: { userId: "patient-id" },
      body: {
        doctorName: "Dr Example",
        appointmentDate: new Date(Date.now() + 86_400_000).toISOString(),
        timeZone: "Asia/Kolkata",
        appointmentType: "IN_PERSON",
        reason: "Annual check-up",
      },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(saved.patientId, "patient-id");
  assert.equal(saved.doctorName, "Dr Example");
  assert.equal(saved.status, "CONFIRMED");
  assert.equal(saved.confirmationStatus, "USER_MANAGED");
  assert.match(response.body.message, /saved/i);
});

test("rejects an unconfirmed past appointment and invalid date without persistence", async (t) => {
  const originalCreate = Appointment.create;
  t.after(() => {
    Appointment.create = originalCreate;
  });

  let saves = 0;
  Appointment.create = async () => {
    saves += 1;
  };
  const pastAppointmentResponse = responseStub();
  await createAppointment(
    {
      user: { userId: "patient-id" },
      body: {
        doctorName: "Dr Example",
        appointmentDate: new Date(Date.now() - 86_400_000).toISOString(),
        timeZone: "UTC",
      },
    },
    pastAppointmentResponse
  );
  const invalidDateResponse = responseStub();
  await createAppointment(
    {
      user: { userId: "patient-id" },
      body: { doctorName: "Dr Example", appointmentDate: "not-a-date" },
    },
    invalidDateResponse
  );

  assert.equal(pastAppointmentResponse.statusCode, 400);
  assert.equal(invalidDateResponse.statusCode, 400);
  assert.equal(saves, 0);
});

test("reschedules only the authenticated patient's appointment", async (t) => {
  const originalFindOne = Appointment.findOne;
  const originalReminderFind = Reminder.find;
  const originalReminderUpdateOne = Reminder.updateOne;
  t.after(() => {
    Appointment.findOne = originalFindOne;
    Reminder.find = originalReminderFind;
    Reminder.updateOne = originalReminderUpdateOne;
  });

  const appointment = {
    _id: "appointment-id",
    patientId: "patient-id",
    status: "CONFIRMED",
    appointmentDate: new Date(Date.now() + 86_400_000),
    save: async () => {},
  };
  const linkedReminder = { _id: "reminder-id", appointmentLeadMinutes: 30 };
  let reminderScheduleUpdate;
  Reminder.find = () => ({ select: async () => [linkedReminder] });
  Reminder.updateOne = async (query, update) => {
    reminderScheduleUpdate = { query, update };
  };
  let ownershipQuery;
  Appointment.findOne = async (query) => {
    ownershipQuery = query;
    return appointment;
  };
  const response = responseStub();
  const nextDate = new Date(Date.now() + 172_800_000);

  await updateAppointment(
    {
      params: { id: "appointment-id" },
      user: { userId: "patient-id" },
      body: { appointmentDate: nextDate.toISOString(), timeZone: "UTC" },
    },
    response
  );

  assert.deepEqual(ownershipQuery, { _id: "appointment-id", patientId: "patient-id" });
  assert.equal(response.statusCode, 200);
  assert.equal(appointment.appointmentDate.toISOString(), nextDate.toISOString());
  assert.equal(reminderScheduleUpdate.query._id, "reminder-id");
  assert.equal(
    reminderScheduleUpdate.update.$set.scheduledAt.toISOString(),
    new Date(nextDate.getTime() - 30 * 60_000).toISOString()
  );
});

test("cancels an appointment without deleting the saved record", async (t) => {
  const originalFindOne = Appointment.findOne;
  const originalReminderUpdateMany = Reminder.updateMany;
  t.after(() => {
    Appointment.findOne = originalFindOne;
    Reminder.updateMany = originalReminderUpdateMany;
  });

  const appointment = {
    _id: "appointment-id",
    patientId: "patient-id",
    status: "CONFIRMED",
    appointmentDate: new Date(Date.now() + 86_400_000),
    save: async () => {},
  };
  let ownershipQuery;
  let reminderCancellationQuery;
  Appointment.findOne = async (query) => {
    ownershipQuery = query;
    return appointment;
  };
  const response = responseStub();
  Reminder.updateMany = async (query) => {
    reminderCancellationQuery = query;
    return { modifiedCount: 0 };
  };

  await updateAppointmentStatus(
    {
      params: { id: "appointment-id" },
      user: { userId: "patient-id" },
      body: { status: "CANCELLED" },
    },
    response
  );

  assert.deepEqual(ownershipQuery, { _id: "appointment-id", patientId: "patient-id" });
  assert.equal(appointment.status, "CANCELLED");
  assert.deepEqual(reminderCancellationQuery, {
    userId: "patient-id",
    appointmentId: appointment._id,
    isActive: true,
    isCompleted: false,
  });
  assert.equal(response.statusCode, 200);
});

test("links a source suggestion only to an existing visit explicitly selected by the patient", async (t) => {
  const originalFindSuggestion = AppointmentSuggestion.findOne;
  const originalFindAppointment = Appointment.findOne;
  const originalCreate = Appointment.create;
  t.after(() => {
    AppointmentSuggestion.findOne = originalFindSuggestion;
    Appointment.findOne = originalFindAppointment;
    Appointment.create = originalCreate;
  });

  const suggestion = {
    sourceDocumentId: "document-id",
    suggestionType: "CONSULTATION",
    appointmentDate: new Date(Date.now() - 86_400_000),
    doctorName: "Maya Rao",
    hospitalName: "City Clinic",
    sourceEvidence: ["Consultation Date: 2026-10-10"],
    save: async () => {},
  };
  const existing = {
    _id: "existing-appointment",
    sourceDocumentIds: [],
    save: async () => {},
  };
  let suggestionQuery;
  let appointmentQuery;
  let creates = 0;
  AppointmentSuggestion.findOne = async (query) => {
    suggestionQuery = query;
    return suggestion;
  };
  Appointment.findOne = async (query) => {
    appointmentQuery = query;
    return existing;
  };
  Appointment.create = async () => {
    creates += 1;
  };
  const response = responseStub();

  await confirmAppointmentSuggestion(
    {
      params: { id: "suggestion-id" },
      user: { userId: "patient-id" },
      body: {
        doctorName: "Maya Rao",
        hospitalName: "City Clinic",
        linkToAppointmentId: "existing-appointment",
      },
    },
    response
  );

  assert.deepEqual(suggestionQuery, {
    _id: "suggestion-id",
    patientId: "patient-id",
    reviewStatus: "PENDING",
  });
  assert.equal(appointmentQuery._id, "existing-appointment");
  assert.equal(appointmentQuery.patientId, "patient-id");
  assert.equal(appointmentQuery.doctorName.test("Maya Rao"), true);
  assert.equal(appointmentQuery.hospitalName.test("City Clinic"), true);
  assert.equal(existing.sourceDocumentIds[0], "document-id");
  assert.equal(suggestion.reviewStatus, "CONFIRMED");
  assert.equal(suggestion.linkedAppointmentId, "existing-appointment");
  assert.equal(response.body.duplicateLinked, true);
  assert.equal(creates, 0);
});
