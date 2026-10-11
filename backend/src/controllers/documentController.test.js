const test = require("node:test");
const assert = require("node:assert/strict");
const Document = require("../models/Document");
const {
  reviewMyDocument,
  summarizeMyDocument,
} = require("./documentController");

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

test("document review saves patient-confirmed corrections only for the owner", async (t) => {
  const originalFindOne = Document.findOne;
  t.after(() => {
    Document.findOne = originalFindOne;
  });

  const document = {
    extractedData: [
      {
        testName: "Glucose",
        value: 99,
        originalValue: "99",
        unit: "mg/dL",
        referenceRange: "70-100",
        reportedFlag: "UNKNOWN",
        confidence: 0.9,
        sourceLine: "Glucose: 99 mg/dL",
      },
    ],
    save: async () => {},
  };
  let query;
  Document.findOne = async (criteria) => {
    query = criteria;
    return document;
  };
  const response = responseStub();

  await reviewMyDocument(
    {
      params: { id: "document-id" },
      user: { userId: "patient-id" },
      body: {
        extractedData: [
          {
            testName: "Fasting glucose",
            value: "101",
            unit: "mg/dL",
            referenceRange: "70-100",
          },
        ],
        documentType: "DIAGNOSTIC_REPORT",
      },
    },
    response
  );

  assert.deepEqual(query, { _id: "document-id", patientId: "patient-id" });
  assert.equal(response.statusCode, 200);
  assert.equal(document.reviewStatus, "CONFIRMED");
  assert.equal(document.extractedData[0].value, 101);
  assert.equal(document.extractedData[0].testName, "Fasting glucose");
  assert.equal(document.extractedData[0].verificationStatus, "CONFIRMED");
  assert.equal(document.extractedData[0].sourceLine, "Glucose: 99 mg/dL");
  assert.equal(document.documentType, "DIAGNOSTIC_REPORT");
  assert.equal(response.body.document.documentType, "DIAGNOSTIC_REPORT");
});

test("document review rejects incomplete and non-numeric corrections", async (t) => {
  const originalFindOne = Document.findOne;
  t.after(() => {
    Document.findOne = originalFindOne;
  });

  let saves = 0;
  Document.findOne = async () => ({
    extractedData: [{ testName: "Glucose", value: 99 }],
    save: async () => {
      saves += 1;
    },
  });

  for (const extractedData of [[], [{ testName: "Glucose", value: "not a number" }]]) {
    const response = responseStub();
    await reviewMyDocument(
      {
        params: { id: "document-id" },
        user: { userId: "patient-id" },
        body: { extractedData },
      },
      response
    );
    assert.equal(response.statusCode, 400);
  }
  assert.equal(saves, 0);
});

test("document review rejects unsupported categories without saving", async (t) => {
  const originalFindOne = Document.findOne;
  t.after(() => {
    Document.findOne = originalFindOne;
  });

  let saves = 0;
  Document.findOne = async () => ({
    extractedData: [],
    save: async () => {
      saves += 1;
    },
  });
  const response = responseStub();

  await reviewMyDocument(
    {
      params: { id: "document-id" },
      user: { userId: "patient-id" },
      body: { extractedData: [], documentType: "UNKNOWN" },
    },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(saves, 0);
});

test("document review confirms supported diagnosis and clinical-date candidates", async (t) => {
  const originalFindOne = Document.findOne;
  t.after(() => { Document.findOne = originalFindOne; });
  const document = {
    extractedData: [],
    extractedClinicalData: [
      { fieldType: "DIAGNOSIS", label: "Discharge diagnosis", value: "Bronchitis", sourceLine: "Discharge diagnosis: Bronchitis", confidence: 0.9 },
      { fieldType: "DATE", label: "Report date", value: "2026-10-09", sourceLine: "Report date: 2026-10-09", confidence: 0.9 },
    ],
    save: async () => {},
  };
  Document.findOne = async () => document;
  const response = responseStub();

  await reviewMyDocument({
    params: { id: "document-id" },
    user: { userId: "patient-id" },
    body: {
      extractedData: [],
      extractedClinicalData: [
        { fieldType: "DIAGNOSIS", label: "Discharge diagnosis", value: "Bronchitis" },
        { fieldType: "DATE", label: "Report date", value: "2026-10-09" },
      ],
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(document.extractedClinicalData[0].verificationStatus, "CONFIRMED");
  assert.equal(document.extractedClinicalData[1].verificationStatus, "CONFIRMED");
  assert.equal(document.reportDate.toISOString(), "2026-10-09T12:00:00.000Z");
});

test("document review rejects impossible clinical dates", async (t) => {
  const originalFindOne = Document.findOne;
  t.after(() => { Document.findOne = originalFindOne; });
  let saves = 0;
  Document.findOne = async () => ({
    extractedData: [],
    extractedClinicalData: [{ fieldType: "DATE", label: "Report date", value: "2026-10-09" }],
    save: async () => { saves += 1; },
  });
  const response = responseStub();

  await reviewMyDocument({
    params: { id: "document-id" },
    user: { userId: "patient-id" },
    body: {
      extractedData: [],
      extractedClinicalData: [{ fieldType: "DATE", label: "Report date", value: "2026-02-30" }],
    },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(saves, 0);
});

test("summary generation is blocked until the document has been reviewed", async (t) => {
  const originalFindOne = Document.findOne;
  t.after(() => {
    Document.findOne = originalFindOne;
  });

  Document.findOne = async () => ({
    reviewStatus: "REVIEW_REQUIRED",
    extractedText: "Glucose: 99 mg/dL",
  });
  const response = responseStub();

  await summarizeMyDocument(
    {
      params: { id: "document-id" },
      user: { userId: "patient-id" },
      body: { language: "en" },
    },
    response
  );

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, "DOCUMENT_REVIEW_REQUIRED");
});
