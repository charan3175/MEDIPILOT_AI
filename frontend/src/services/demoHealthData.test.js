import assert from "node:assert/strict";
import test from "node:test";
import { buildBodyFindings, getAbnormalAnatomicalFindings } from "./healthInsights.js";
import {
  createDemoHealthData,
  demoReportSummary,
} from "./demoHealthData.js";

test("demo records are identified as synthetic and show the source intervals", () => {
  const data = createDemoHealthData();

  assert.equal(data.documents.length, 2);
  assert.ok(data.documents.every((document) => document.demoSample));
  assert.ok(data.documents.every((document) =>
    document.extractedText.includes("synthetic sample data")
  ));

  const tsh = data.documents[0].extractedData.find((finding) => finding.testName === "TSH");
  assert.equal(tsh.value, 6.2);
  assert.equal(tsh.referenceRange, "0.40-4.00 mIU/L");
  assert.equal(tsh.verificationStatus, "CONFIRMED");
});

test("only the sample out-of-range TSH finding marks its supported anatomy region", () => {
  const data = createDemoHealthData();
  const findings = buildBodyFindings(data.documents);
  const abnormalFindings = getAbnormalAnatomicalFindings(findings);

  assert.equal(abnormalFindings.length, 1);
  assert.equal(abnormalFindings[0].testName, "TSH");
  assert.equal(abnormalFindings[0].regionId, "thyroid");
  assert.equal(abnormalFindings[0].status, "above");
  assert.equal(abnormalFindings[0].sourceTitle, "[DEMO SAMPLE] Thyroid panel.pdf");
});

test("demo report explanation states the sample-only clinical limitation", () => {
  assert.match(demoReportSummary, /Demo report only/);
  assert.match(demoReportSummary, /does not establish a diagnosis/i);
  assert.match(demoReportSummary, /qualified clinician/i);
});
