import assert from "node:assert/strict";
import test from "node:test";
import { buildBodyFindings, getAbnormalAnatomicalFindings } from "./healthInsights.js";

test("does not classify unconfirmed extracted values as normal or abnormal", () => {
  const [finding] = buildBodyFindings(
    [
      {
        _id: "document-1",
        originalName: "lab-report.pdf",
        createdAt: "2026-10-10T00:00:00.000Z",
        reviewStatus: "REVIEW_REQUIRED",
        extractedData: [
          {
            testName: "Glucose",
            value: 110,
            referenceRange: "70-100",
            verificationStatus: "REVIEW_REQUIRED",
          },
        ],
      },
    ],
    []
  );

  assert.equal(finding.status, "needs_review");
  assert.equal(finding.documentId, "document-1");
  assert.equal(finding.sourceTitle, "lab-report.pdf");
});

test("uses only reported flags or a supplied reference range for confirmed findings", () => {
  const findings = buildBodyFindings(
    [
      {
        _id: "document-2",
        reportDate: "2026-10-09T00:00:00.000Z",
        createdAt: "2026-10-10T00:00:00.000Z",
        reviewStatus: "CONFIRMED",
        extractedData: [
          {
            testName: "Potassium",
            value: 5.6,
            reportedFlag: "HIGH",
            verificationStatus: "CONFIRMED",
          },
          {
            testName: "Creatinine",
            value: 0.9,
            verificationStatus: "CONFIRMED",
          },
        ],
      },
    ],
    []
  );

  assert.equal(findings[0].status, "above");
  assert.equal(findings[0].date, "2026-10-09T00:00:00.000Z");
  assert.equal(findings[0].uploadDate, "2026-10-10T00:00:00.000Z");
  assert.equal(findings[1].status, "unknown");
});

test("only verified findings with supported anatomy mappings can be highlighted", () => {
  const findings = buildBodyFindings(
    [
      {
        _id: "document-3",
        originalName: "reviewed-report.pdf",
        reviewStatus: "CONFIRMED",
        createdAt: "2026-10-10T00:00:00.000Z",
        extractedData: [
          {
            testName: "TSH",
            value: 2.1,
            verificationStatus: "CONFIRMED",
          },
          {
            testName: "Glucose",
            value: 98,
            verificationStatus: "CONFIRMED",
          },
        ],
      },
    ],
    []
  );

  assert.equal(findings[0].regionId, "thyroid");
  assert.equal(findings[0].mappingStatus, "verified");
  assert.equal(findings[1].regionId, null);
  assert.equal(findings[1].mappingStatus, "needs_review");
});

test("unreviewed values do not receive a verified anatomy mapping", () => {
  const [finding] = buildBodyFindings(
    [
      {
        _id: "document-4",
        reviewStatus: "REVIEW_REQUIRED",
        extractedData: [
          {
            testName: "Creatinine",
            value: 1,
            verificationStatus: "REVIEW_REQUIRED",
          },
        ],
      },
    ],
    []
  );

  assert.equal(finding.regionId, "kidneys");
  assert.equal(finding.mappingStatus, "needs_review");
});

test("only explicit patient-reviewed diagnosis text maps to a red report mention", () => {
  const findings = buildBodyFindings(
    [
      {
        _id: "diagnosis-document",
        originalName: "discharge-summary.pdf",
        reviewStatus: "CONFIRMED",
        extractedClinicalData: [
          {
            fieldType: "DIAGNOSIS",
            label: "Discharge diagnosis",
            value: "Coronary artery disease",
            sourceLine: "Discharge diagnosis: Coronary artery disease",
            verificationStatus: "CONFIRMED",
          },
          {
            fieldType: "DIAGNOSIS",
            label: "Diagnosis",
            value: "No evidence of liver disease",
            verificationStatus: "CONFIRMED",
          },
          {
            fieldType: "DIAGNOSIS",
            label: "Diagnosis",
            value: "Chronic kidney disease",
            verificationStatus: "UNVERIFIED",
          },
        ],
      },
    ],
    [],
  );

  assert.equal(findings[0].regionId, "heart");
  assert.equal(findings[0].status, "mentioned");
  assert.equal(findings[0].mappingStatus, "verified");
  assert.equal(findings[1].mappingStatus, "needs_review");
  assert.equal(findings[2].mappingStatus, "needs_review");
  assert.deepEqual(
    getAbnormalAnatomicalFindings(findings).map(({ id }) => id),
    ["diagnosis-document:diagnosis:0"],
  );
});

test("maps explicit patient-entered condition notes without treating other notes as diagnoses", () => {
  const findings = buildBodyFindings(
    [],
    [],
    [
      { _id: "condition-1", recordType: "CONDITION", title: "Asthma", details: "Recorded by patient" },
      { _id: "condition-2", recordType: "CONDITION", title: "No kidney disease" },
      { _id: "note-1", recordType: "NOTE", title: "Heartburn after dinner" },
    ],
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].regionId, "lungs");
  assert.equal(findings[0].findingType, "PATIENT_CONDITION_MENTION");
  assert.deepEqual(
    getAbnormalAnatomicalFindings(findings).map(({ id }) => id),
    ["condition-1:condition:0"],
  );
});

test("only confirmed, mapped out-of-range findings are marked on the anatomy", () => {
  const findings = [
    { id: "high", regionId: "heart", mappingStatus: "verified", status: "above" },
    { id: "critical", regionId: "kidneys", mappingStatus: "confirmed", status: "critical" },
    { id: "normal", regionId: "thyroid", mappingStatus: "verified", status: "within" },
    { id: "unreviewed", regionId: "liver", mappingStatus: "needs_review", status: "above" },
    { id: "unknown-region", regionId: "whole-body", mappingStatus: "verified", status: "critical" },
  ];

  assert.deepEqual(
    getAbnormalAnatomicalFindings(findings).map(({ id }) => id),
    ["high", "critical"],
  );
});
