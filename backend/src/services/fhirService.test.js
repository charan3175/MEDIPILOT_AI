const assert = require("node:assert/strict");
const test = require("node:test");
const { buildFhirBundle } = require("./fhirService");

test("keeps upload dates separate from missing clinical report dates", () => {
  const { bundle, validation } = buildFhirBundle({
    user: { _id: "patient-1", name: "Test Patient" },
    documents: [
      {
        _id: "document-1",
        originalName: "blood-panel.pdf",
        documentType: "LAB_REPORT",
        processingStatus: "COMPLETED",
        reviewStatus: "REVIEW_REQUIRED",
        createdAt: "2026-10-10T00:00:00.000Z",
        extractedData: [
          {
            testName: "TSH",
            value: 2.4,
            unit: "mIU/L",
            verificationStatus: "REVIEW_REQUIRED",
          },
        ],
      },
    ],
  });

  const resources = bundle.entry.map(({ resource }) => resource);
  const observation = resources.find((resource) => resource.resourceType === "Observation");
  const report = resources.find((resource) => resource.resourceType === "DiagnosticReport");
  const source = resources.find((resource) => resource.resourceType === "DocumentReference");

  assert.equal(validation.valid, true);
  assert.equal(observation.status, "preliminary");
  assert.equal("effectiveDateTime" in observation, false);
  assert.equal(report.status, "preliminary");
  assert.equal("effectiveDateTime" in report, false);
  assert.equal(source.date, "2026-10-10T00:00:00.000Z");
});

test("marks source-reviewed findings final and uses only the recorded report date", () => {
  const { bundle } = buildFhirBundle({
    user: { _id: "patient-2", name: "Test Patient" },
    documents: [
      {
        _id: "document-2",
        originalName: "thyroid-report.pdf",
        documentType: "LAB_REPORT",
        reviewStatus: "CONFIRMED",
        reportDate: "2026-10-09T00:00:00.000Z",
        createdAt: "2026-10-10T00:00:00.000Z",
        extractedData: [
          {
            testName: "TSH",
            value: 2.4,
            verificationStatus: "CONFIRMED",
          },
        ],
      },
    ],
  });

  const resources = bundle.entry.map(({ resource }) => resource);
  const observation = resources.find((resource) => resource.resourceType === "Observation");
  const report = resources.find((resource) => resource.resourceType === "DiagnosticReport");

  assert.equal(observation.status, "final");
  assert.equal(observation.effectiveDateTime, "2026-10-09T00:00:00.000Z");
  assert.equal(report.status, "final");
  assert.equal(report.effectiveDateTime, "2026-10-09T00:00:00.000Z");
});

test("exports only patient-confirmed documented diagnoses as FHIR Conditions", () => {
  const { bundle, validation } = buildFhirBundle({
    user: { _id: "patient-3", name: "Test Patient" },
    documents: [
      {
        _id: "document-3",
        originalName: "discharge-summary.pdf",
        reviewStatus: "CONFIRMED",
        extractedClinicalData: [
          { fieldType: "DIAGNOSIS", label: "Diagnosis", value: "Bronchitis", verificationStatus: "CONFIRMED", sourceLine: "Diagnosis: Bronchitis" },
          { fieldType: "DIAGNOSIS", label: "Diagnosis", value: "Unverified term", verificationStatus: "UNVERIFIED" },
        ],
      },
      {
        _id: "document-4",
        reviewStatus: "REVIEW_REQUIRED",
        extractedClinicalData: [
          { fieldType: "DIAGNOSIS", label: "Diagnosis", value: "Unreviewed condition", verificationStatus: "CONFIRMED" },
        ],
      },
    ],
  });
  const conditions = bundle.entry
    .map(({ resource }) => resource)
    .filter((resource) => resource.resourceType === "Condition");

  assert.equal(validation.valid, true);
  assert.equal(conditions.length, 1);
  assert.equal(conditions[0].code.text, "Bronchitis");
  assert.equal(conditions[0].verificationStatus.coding[0].code, "unconfirmed");
  assert.match(conditions[0].note[0].text, /not clinician-verified/i);
});
