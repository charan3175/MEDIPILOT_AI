const test = require("node:test");
const assert = require("node:assert/strict");
const {
  detectDocumentMime,
  extractAppointmentSuggestions,
  extractClinicalFacts,
  extractLabValues,
  extractMedicationSuggestions,
  hashUpload,
  isSupportedOcrLanguage,
  parseExplicitMedicalDate,
  sanitizeOriginalFilename,
} = require("./medicalDocument");

test("detects supported medical file types from their signatures", () => {
  assert.equal(
    detectDocumentMime(Buffer.from("%PDF-1.7\n", "ascii")),
    "application/pdf"
  );
  assert.equal(
    detectDocumentMime(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png"
  );
  assert.equal(
    detectDocumentMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
    "image/jpeg"
  );
  assert.equal(detectDocumentMime(Buffer.from("not a medical file")), null);
});

test("sanitizes filenames and creates stable SHA-256 upload hashes", () => {
  assert.equal(sanitizeOriginalFilename("../../private/../report?.pdf"), "report_.pdf");
  assert.equal(sanitizeOriginalFilename(""), "medical-document");
  const buffer = Buffer.from("fixture document");
  assert.equal(hashUpload(buffer), hashUpload(buffer));
  assert.match(hashUpload(buffer), /^[a-f0-9]{64}$/);
});

test("allows only supported English and regional-language OCR combinations", () => {
  assert.equal(isSupportedOcrLanguage("eng"), true);
  assert.equal(isSupportedOcrLanguage("eng+hin"), true);
  assert.equal(isSupportedOcrLanguage("eng+tel"), true);
  assert.equal(isSupportedOcrLanguage("eng+tam"), true);
  assert.equal(isSupportedOcrLanguage("eng+fra"), false);
});

test("extracts literal lab values and flags without inventing ranges", () => {
  const [withRange, withoutRange] = extractLabValues(
    "Glucose: 96 mg/dL (Reference Range 70-100)\nHemoglobin: 11.8 g/dL LOW",
    91
  );
  assert.deepEqual(
    {
      testName: withRange.testName,
      value: withRange.value,
      originalValue: withRange.originalValue,
      unit: withRange.unit,
      referenceRange: withRange.referenceRange,
      reportedFlag: withRange.reportedFlag,
      confidence: withRange.confidence,
    },
    {
      testName: "Glucose",
      value: 96,
      originalValue: "96",
      unit: "mg/dL",
      referenceRange: "70-100",
      reportedFlag: "UNKNOWN",
      confidence: 0.91,
    }
  );
  assert.equal(withoutRange.referenceRange, null);
  assert.equal(withoutRange.reportedFlag, "LOW");
  assert.equal(withoutRange.verificationStatus, "UNVERIFIED");
});

test("marks lower-confidence OCR results for review", () => {
  const [result] = extractLabValues("Glucose: 96 mg/dL", 45);
  assert.equal(result.verificationStatus, "REVIEW_REQUIRED");
});

test("suggests only explicitly labelled consultation or follow-up dates", () => {
  const suggestions = extractAppointmentSuggestions(
    "Doctor: Dr. Maya Rao\nClinic: City Health Centre\nConsultation Date: 2026-10-05\nFollow-up Date: 2026-11-05"
  );

  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0].suggestionType, "CONSULTATION");
  assert.equal(suggestions[0].doctorName, "Maya Rao");
  assert.equal(suggestions[0].hospitalName, "City Health Centre");
  assert.equal(suggestions[0].appointmentDate.toISOString(), "2026-10-05T12:00:00.000Z");
  assert.equal(suggestions[1].suggestionType, "FOLLOW_UP");
  assert.equal(suggestions[1].followUpDate.toISOString(), "2026-11-05T12:00:00.000Z");
  assert.deepEqual(suggestions[0].sourceEvidence, [
    "Consultation Date: 2026-10-05",
    "Doctor: Dr. Maya Rao",
    "Clinic: City Health Centre",
  ]);
});

test("does not turn a prescription date into an appointment suggestion", () => {
  assert.deepEqual(
    extractAppointmentSuggestions("Doctor: Dr. Maya Rao\nPrescription date: 2026-10-05"),
    []
  );
});

test("extracts only explicitly labelled diagnosis and clinical date lines", () => {
  const facts = extractClinicalFacts([
    "Discharge diagnosis: Acute bronchitis",
    "Impression: Acute bronchitis",
    "Admission date: 2026-10-05",
    "Discharge date: 2026-10-08",
    "Possible diagnosis could be listed here",
    "Procedure date: 2026-02-30",
  ].join("\n"), 92);

  assert.deepEqual(facts.map(({ fieldType, label, value, verificationStatus }) => ({
    fieldType, label, value, verificationStatus,
  })), [
    { fieldType: "DIAGNOSIS", label: "Discharge diagnosis", value: "Acute bronchitis", verificationStatus: "UNVERIFIED" },
    { fieldType: "DATE", label: "Admission date", value: "2026-10-05", verificationStatus: "UNVERIFIED" },
    { fieldType: "DATE", label: "Discharge date", value: "2026-10-08", verificationStatus: "UNVERIFIED" },
  ]);
  assert.equal(facts[0].sourceLine, "Discharge diagnosis: Acute bronchitis");
});

test("extracts Hindi diagnosis labels and keeps low-confidence facts in review", () => {
  const facts = extractClinicalFacts("निदान: बुखार", 40);
  assert.equal(facts[0].value, "बुखार");
  assert.equal(facts[0].verificationStatus, "REVIEW_REQUIRED");
});

test("deduplicates repeated exact consultation and follow-up date lines", () => {
  const suggestions = extractAppointmentSuggestions(
    "Consultation Date: 2026-10-05\nConsultation Date: 2026-10-05\nFollow-up Date: 2026-11-05\nFollow-up Date: 2026-11-05"
  );
  assert.equal(suggestions.length, 2);
});

test("rejects impossible or unsupported explicit dates", () => {
  assert.equal(parseExplicitMedicalDate("2026-02-30"), null);
  assert.equal(parseExplicitMedicalDate("03/12/2026").toISOString(), "2026-12-03T12:00:00.000Z");
  assert.equal(parseExplicitMedicalDate("12 March 2026"), null);
});

test("extracts only explicitly labelled prescription medicine fields", () => {
  const suggestions = extractMedicationSuggestions([
    "Medicine: Example medicine",
    "Strength: 250 mg",
    "Dose: 1 tablet",
    "Frequency: Twice daily",
    "Duration: 5 days",
    "Route: Oral",
    "Start date: 2026-10-11",
    "Doctor: Dr Example",
    "Medicine: Second medicine",
    "Frequency: As written",
  ].join("\n"));

  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0].medicineName, "Example medicine");
  assert.equal(suggestions[0].strength, "250 mg");
  assert.equal(suggestions[0].dosage, "1 tablet");
  assert.equal(suggestions[0].frequency, "Twice daily");
  assert.equal(suggestions[0].duration, "5 days");
  assert.equal(suggestions[0].route, "Oral");
  assert.equal(suggestions[0].startDate.toISOString(), "2026-10-11T12:00:00.000Z");
  assert.equal(suggestions[0].prescribedBy, "Dr Example");
  assert.equal(suggestions[1].medicineName, "Second medicine");
  assert.equal(suggestions[1].strength, "");
  assert.equal(suggestions[1].duration, "");
});

test("does not infer medicines from unlabeled prescription text", () => {
  assert.deepEqual(
    extractMedicationSuggestions("Amoxicillin 500 mg twice daily for 5 days"),
    []
  );
});
