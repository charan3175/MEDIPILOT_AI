const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyQuestion,
  detectEmergency,
  extractTestTerms,
  matchTestName,
} = require("./queryUnderstanding");

test("classifies personal lab and medication questions", () => {
  assert.equal(classifyQuestion("What was my latest glucose result?").intent, "PATIENT_LAB_RESULT");
  assert.equal(classifyQuestion("List my active medications").intent, "PATIENT_MEDICATION");
  assert.equal(classifyQuestion("Compare my last two A1c results").intent, "COMPARISON");
  assert.equal(classifyQuestion("When is my next appointment?").intent, "PATIENT_APPOINTMENTS");
  assert.equal(classifyQuestion("What follow-up date is in my discharge summary?").needsPatientRecords, true);
});

test("routes personal reminder questions to saved reminder records", () => {
  const result = classifyQuestion("What reminders do I have today?");
  assert.equal(result.intent, "PATIENT_REMINDERS");
  assert.equal(result.needsPatientRecords, true);
});

test("routes broad report-review requests to patient-scoped RAG", () => {
  for (const question of [
    "Analyze all my reports",
    "Summarize every uploaded medical document",
    "Review all records for patterns",
    "What does my report say?",
  ]) {
    const result = classifyQuestion(question);
    assert.equal(result.intent, "PATIENT_RECORD_REVIEW");
    assert.equal(result.needsPatientRecords, true);
  }
});

test("routes general medical questions to reviewed knowledge, not patient records", () => {
  const result = classifyQuestion("What is a normal glucose result?");
  assert.equal(result.needsMedicalKnowledge, true);
  assert.equal(result.needsPatientRecords, false);
});

test("detects emergency language and normalizes common lab test aliases", () => {
  assert.equal(detectEmergency("I have chest pain and can't breathe"), true);
  assert.equal(detectEmergency("What causes a seizure?"), false);
  assert.deepEqual(extractTestTerms("What is my HbA1c?"), ["hemoglobin", "a1c"]);
  assert.equal(matchTestName("HbA1c", ["hemoglobin", "a1c"]), true);
  assert.equal(matchTestName("fasting glucose", ["glucose"]), true);
  assert.equal(matchTestName("cholesterol", ["glucose"]), false);
});
