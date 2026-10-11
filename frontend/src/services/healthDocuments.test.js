import assert from "node:assert/strict";
import test from "node:test";
import { filterHealthDocuments } from "./healthDocuments.js";

const documents = [
  {
    _id: "older",
    originalName: "older.pdf",
    documentType: "LAB_REPORT",
    processingStatus: "COMPLETED",
    reviewStatus: "CONFIRMED",
    createdAt: "2025-01-01T00:00:00.000Z",
    reportDate: "2024-12-20T00:00:00.000Z",
    extractedData: [{ testName: "Glucose", originalValue: "98", sourceLine: "Glucose 98 mg/dL" }],
    extractedClinicalData: [],
  },
  {
    _id: "newer",
    originalName: "prescription.pdf",
    documentType: "PRESCRIPTION",
    processingStatus: "REVIEW_REQUIRED",
    reviewStatus: "REVIEW_REQUIRED",
    createdAt: "2025-02-01T00:00:00.000Z",
    reportDate: "2025-01-29T00:00:00.000Z",
    extractedData: [],
    extractedClinicalData: [{ fieldType: "DIAGNOSIS", label: "Discharge diagnosis", value: "Bronchitis", sourceLine: "Discharge diagnosis: Bronchitis" }],
  },
];

const noFilters = {
  search: "",
  category: "ALL",
  processing: "ALL",
  review: "ALL",
  dateFrom: "",
  dateTo: "",
  sort: "newest",
};

test("filters by extracted result, category, status, review state, and clinical date", () => {
  const matching = filterHealthDocuments(documents, {
    ...noFilters,
    search: "glucose",
    category: "LAB_REPORT",
    processing: "COMPLETED",
    review: "CONFIRMED",
    dateFrom: "2024-12-01",
    dateTo: "2024-12-31",
  });

  assert.deepEqual(matching.map((document) => document._id), ["older"]);
});

test("sorts by upload date or report date and leaves the input array unchanged", () => {
  const originalOrder = documents.map((document) => document._id);
  const oldestUploads = filterHealthDocuments(documents, { ...noFilters, sort: "oldest" });
  const newestReports = filterHealthDocuments(documents, { ...noFilters, sort: "report-date" });

  assert.deepEqual(oldestUploads.map((document) => document._id), ["older", "newer"]);
  assert.deepEqual(newestReports.map((document) => document._id), ["newer", "older"]);
  assert.deepEqual(documents.map((document) => document._id), originalOrder);
});

test("searches explicitly extracted diagnosis and date details", () => {
  const matching = filterHealthDocuments(documents, { ...noFilters, search: "bronchitis" });
  assert.deepEqual(matching.map((document) => document._id), ["newer"]);
});
