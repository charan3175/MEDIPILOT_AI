const test = require("node:test");
const assert = require("node:assert/strict");
const Medication = require("../models/Medication");
const MedicationSuggestion = require("../models/MedicationSuggestion");
const Document = require("../models/Document");
const Reminder = require("../models/Reminder");
const {
  confirmMedicationSuggestion,
  createMedication,
  updateMedication,
} = require("./medicationController");

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

test("creates a user-entered medication without inventing prescription details", async (t) => {
  const originalCreate = Medication.create;
  t.after(() => {
    Medication.create = originalCreate;
  });
  let saved;
  Medication.create = async (body) => {
    saved = body;
    return { ...body, _id: "medication-id" };
  };
  const response = responseStub();

  await createMedication({
    user: { userId: "patient-id" },
    body: { medicineName: "Example medicine" },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(saved.patientId, "patient-id");
  assert.equal(saved.medicineName, "Example medicine");
  assert.equal(saved.frequency, undefined);
  assert.equal(saved.duration, undefined);
  assert.equal(saved.verificationStatus, "USER_ENTERED");
});

test("confirms an OCR suggestion only after source ownership is verified", async (t) => {
  const originalSuggestionFindOne = MedicationSuggestion.findOne;
  const originalMedicationCreate = Medication.create;
  const originalMedicationDeleteOne = Medication.deleteOne;
  const originalDocumentFindOne = Document.findOne;
  t.after(() => {
    MedicationSuggestion.findOne = originalSuggestionFindOne;
    Medication.create = originalMedicationCreate;
    Medication.deleteOne = originalMedicationDeleteOne;
    Document.findOne = originalDocumentFindOne;
  });

  const suggestion = {
    sourceDocumentId: "source-document",
    medicineName: "Example medicine",
    strength: "",
    dosage: "1 tablet",
    dosageForm: "",
    route: "",
    frequency: "Daily",
    duration: "",
    foodInstructions: "",
    startDate: null,
    endDate: null,
    prescribedBy: "",
    prescriptionDate: null,
    instructions: "",
    toObject() {
      return { ...this };
    },
    async save() {},
  };
  let suggestionQuery;
  let documentQuery;
  let savedMedication;
  MedicationSuggestion.findOne = async (query) => {
    suggestionQuery = query;
    return suggestion;
  };
  Document.findOne = (query) => {
    documentQuery = query;
    return { select: async () => ({ _id: "source-document" }) };
  };
  Medication.create = async (body) => {
    savedMedication = { ...body, _id: "medication-id" };
    return savedMedication;
  };
  Medication.deleteOne = async () => {};
  const response = responseStub();

  await confirmMedicationSuggestion({
    params: { id: "suggestion-id" },
    user: { userId: "patient-id" },
    body: {},
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(suggestionQuery, {
    _id: "suggestion-id",
    patientId: "patient-id",
    reviewStatus: "PENDING",
  });
  assert.deepEqual(documentQuery, {
    _id: "source-document",
    patientId: "patient-id",
  });
  assert.equal(savedMedication.sourceDocumentId, "source-document");
  assert.equal(savedMedication.verificationStatus, "USER_CONFIRMED");
  assert.equal(savedMedication.duration, "");
  assert.equal(suggestion.reviewStatus, "CONFIRMED");
  assert.equal(suggestion.linkedMedicationId, "medication-id");
});

test("rejects invalid medication date ranges before saving", async (t) => {
  const originalCreate = Medication.create;
  t.after(() => {
    Medication.create = originalCreate;
  });
  let saves = 0;
  Medication.create = async () => { saves += 1; };
  const response = responseStub();

  await createMedication({
    user: { userId: "patient-id" },
    body: {
      medicineName: "Example medicine",
      startDate: "2026-10-12",
      endDate: "2026-10-10",
    },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(saves, 0);
});

test("cancels linked active reminders when the user completes a medication", async (t) => {
  const originalFindOne = Medication.findOne;
  const originalFindOneAndUpdate = Medication.findOneAndUpdate;
  const originalReminderUpdateMany = Reminder.updateMany;
  t.after(() => {
    Medication.findOne = originalFindOne;
    Medication.findOneAndUpdate = originalFindOneAndUpdate;
    Reminder.updateMany = originalReminderUpdateMany;
  });
  Medication.findOne = async () => ({ _id: "medication-id", status: "ACTIVE" });
  Medication.findOneAndUpdate = async () => ({ _id: "medication-id", status: "COMPLETED" });
  let reminderQuery;
  Reminder.updateMany = async (query) => {
    reminderQuery = query;
    return { modifiedCount: 1 };
  };
  const response = responseStub();

  await updateMedication({
    params: { id: "medication-id" },
    user: { userId: "patient-id" },
    body: { status: "COMPLETED" },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(reminderQuery, {
    userId: "patient-id",
    medicationId: "medication-id",
    isActive: true,
    isCompleted: false,
  });
});
