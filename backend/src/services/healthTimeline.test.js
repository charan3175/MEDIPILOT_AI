const assert = require("node:assert/strict");
const test = require("node:test");
const { buildHealthTimeline } = require("./healthTimeline");

test("groups linked lab reports under their source document without duplicate events", () => {
  const timeline = buildHealthTimeline({
    documents: [
      {
        _id: "document-1",
        originalName: "panel.pdf",
        documentType: "LAB_REPORT",
        reportDate: "2026-10-09T00:00:00.000Z",
        createdAt: "2026-10-10T00:00:00.000Z",
        extractedData: [
          {
            testName: "Glucose",
            value: 98,
            originalValue: "98",
            unit: "mg/dL",
            verificationStatus: "CONFIRMED",
          },
        ],
      },
    ],
    labReports: [
      {
        _id: "lab-1",
        reportFileId: "document-1",
        testName: "Chemistry panel",
        testDate: "2026-10-09T00:00:00.000Z",
        results: [
          { parameter: "Glucose", value: 98, unit: "mg/dL" },
          { parameter: "Potassium", value: 4.2, unit: "mmol/L" },
        ],
      },
      {
        _id: "lab-2",
        reportFileId: "document-1",
        testName: "Chemistry panel duplicate",
        results: [
          { parameter: "Potassium", value: 4.2, unit: "mmol/L" },
        ],
      },
      {
        _id: "lab-3",
        testName: "Independent panel",
        testDate: "2026-10-08T00:00:00.000Z",
        results: [],
      },
    ],
  });

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].id, "document:document-1");
  assert.equal(timeline[0].dateSource, "clinical");
  assert.equal(timeline[0].labValues.length, 2);
  assert.equal(timeline[1].id, "lab-report:lab-3");
});

test("shows patient-confirmed diagnoses on the source document timeline event", () => {
  const [event] = buildHealthTimeline({
    documents: [{
      _id: "document-2",
      originalName: "discharge.pdf",
      createdAt: "2026-10-10T00:00:00.000Z",
      reviewStatus: "CONFIRMED",
      extractedClinicalData: [
        { fieldType: "DIAGNOSIS", label: "Discharge diagnosis", value: "Bronchitis", verificationStatus: "CONFIRMED" },
        { fieldType: "DIAGNOSIS", label: "Diagnosis", value: "Unreviewed", verificationStatus: "UNVERIFIED" },
      ],
    }],
  });

  assert.equal(event.details, "Patient-reviewed report text - Discharge diagnosis: Bronchitis");
  assert.equal(event.dateSource, "upload");
});
