const test = require("node:test");
const assert = require("node:assert/strict");
const Reminder = require("../models/Reminder");
const Medication = require("../models/Medication");
const Appointment = require("../models/Appointment");
const {
  cancelReminder,
  createReminder,
  dismissReminder,
  updateReminder,
} = require("./reminderController");

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

test("creates a user-scoped in-app reminder with an honest delivery state", async (t) => {
  const originalFindOne = Reminder.findOne;
  const originalCreate = Reminder.create;
  t.after(() => {
    Reminder.findOne = originalFindOne;
    Reminder.create = originalCreate;
  });
  Reminder.findOne = () => ({ select: async () => null });
  let saved;
  Reminder.create = async (body) => {
    saved = body;
    return body;
  };
  const response = responseStub();

  await createReminder({
    user: { userId: "patient-id" },
    body: {
      title: "Review health report",
      reminderType: "GENERAL",
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
      timeZone: "Asia/Kolkata",
      repeat: "ONCE",
    },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(saved.userId, "patient-id");
  assert.equal(saved.timeZone, "Asia/Kolkata");
  assert.equal(Reminder.schema.path("deliveryStatus").defaultValue, "NOT_CONFIGURED");
  assert.equal(response.body.reminder.title, "Review health report");
});

test("rejects a duplicate active reminder with the matching saved reminder ID", async (t) => {
  const originalFindOne = Reminder.findOne;
  const originalCreate = Reminder.create;
  t.after(() => {
    Reminder.findOne = originalFindOne;
    Reminder.create = originalCreate;
  });
  Reminder.findOne = () => ({ select: async () => ({ _id: "existing-reminder" }) });
  let creates = 0;
  Reminder.create = async () => { creates += 1; };
  const response = responseStub();

  await createReminder({
    user: { userId: "patient-id" },
    body: {
      title: "Review health report",
      reminderType: "GENERAL",
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
      timeZone: "Asia/Kolkata",
      repeat: "ONCE",
    },
  }, response);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.reminderId, "existing-reminder");
  assert.equal(creates, 0);
});

test("rejects medication reminders unless they link to an owned active medicine", async (t) => {
  const originalMedicationFindOne = Medication.findOne;
  const originalReminderFindOne = Reminder.findOne;
  const originalReminderCreate = Reminder.create;
  t.after(() => {
    Medication.findOne = originalMedicationFindOne;
    Reminder.findOne = originalReminderFindOne;
    Reminder.create = originalReminderCreate;
  });
  Medication.findOne = async () => null;
  Reminder.findOne = () => ({ select: async () => null });
  let creates = 0;
  Reminder.create = async () => { creates += 1; };
  const response = responseStub();

  await createReminder({
    user: { userId: "patient-id" },
    body: {
      title: "Medication reminder",
      reminderType: "MEDICATION",
      medicationId: "507f1f77bcf86cd799439011",
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  }, response);

  assert.equal(response.statusCode, 404);
  assert.equal(creates, 0);
});

test("requires a confirmed patient appointment for appointment reminders", async (t) => {
  const originalAppointmentFindOne = Appointment.findOne;
  const originalReminderFindOne = Reminder.findOne;
  const originalReminderCreate = Reminder.create;
  t.after(() => {
    Appointment.findOne = originalAppointmentFindOne;
    Reminder.findOne = originalReminderFindOne;
    Reminder.create = originalReminderCreate;
  });
  Appointment.findOne = async () => null;
  Reminder.findOne = () => ({ select: async () => null });
  let creates = 0;
  Reminder.create = async () => { creates += 1; };
  const response = responseStub();

  await createReminder({
    user: { userId: "patient-id" },
    body: {
      title: "Appointment reminder",
      reminderType: "APPOINTMENT",
      appointmentId: "507f1f77bcf86cd799439011",
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  }, response);

  assert.equal(response.statusCode, 404);
  assert.equal(creates, 0);
});

test("dismisses a reminder only in the authenticated user's account", async (t) => {
  const originalFindOneAndUpdate = Reminder.findOneAndUpdate;
  t.after(() => {
    Reminder.findOneAndUpdate = originalFindOneAndUpdate;
  });
  let query;
  let update;
  Reminder.findOneAndUpdate = async (filter, change) => {
    query = filter;
    update = change;
    return { _id: "reminder-id", ...change.$set };
  };
  const response = responseStub();

  await dismissReminder({
    params: { id: "reminder-id" },
    user: { userId: "patient-id" },
  }, response);

  assert.deepEqual(query, { _id: "reminder-id", userId: "patient-id", isActive: true });
  assert.equal(update.$set.isActive, false);
  assert.ok(update.$set.dismissedAt instanceof Date);
  assert.equal(response.statusCode, 200);
});

test("cancels a reminder without deleting its saved history", async (t) => {
  const originalFindOneAndUpdate = Reminder.findOneAndUpdate;
  t.after(() => {
    Reminder.findOneAndUpdate = originalFindOneAndUpdate;
  });
  let query;
  let update;
  Reminder.findOneAndUpdate = async (filter, change) => {
    query = filter;
    update = change;
    return { _id: "reminder-id", ...change.$set };
  };
  const response = responseStub();

  await cancelReminder({
    params: { id: "reminder-id" },
    user: { userId: "patient-id" },
  }, response);

  assert.deepEqual(query, { _id: "reminder-id", userId: "patient-id", isActive: true });
  assert.equal(update.$set.isActive, false);
  assert.ok(update.$set.cancelledAt instanceof Date);
  assert.equal(response.statusCode, 200);
});

test("marks a due reminder complete only after an explicit user action", async (t) => {
  const originalFindOne = Reminder.findOne;
  const originalFindOneAndUpdate = Reminder.findOneAndUpdate;
  t.after(() => {
    Reminder.findOne = originalFindOne;
    Reminder.findOneAndUpdate = originalFindOneAndUpdate;
  });
  const existing = {
    _id: "reminder-id",
    userId: "patient-id",
    reminderType: "MEDICATION",
    medicationId: "medicine-id",
    appointmentId: null,
    sourceDocumentId: null,
    scheduledAt: new Date(Date.now() - 60_000),
    repeat: "ONCE",
    isActive: true,
    isCompleted: false,
    dismissedAt: null,
  };
  let savedUpdate;
  Reminder.findOne = (query) => typeof query._id === "string"
    ? Promise.resolve(existing)
    : { select: async () => null };
  Reminder.findOneAndUpdate = async (query, update) => {
    savedUpdate = { query, update };
    return { ...existing, ...update.$set };
  };
  const response = responseStub();

  await updateReminder({
    params: { id: "reminder-id" },
    user: { userId: "patient-id" },
    body: { isCompleted: true },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(savedUpdate.query.userId, "patient-id");
  assert.equal(savedUpdate.update.$set.isCompleted, true);
  assert.equal(savedUpdate.update.$set.isActive, false);
  assert.ok(savedUpdate.update.$set.completedAt instanceof Date);
});
