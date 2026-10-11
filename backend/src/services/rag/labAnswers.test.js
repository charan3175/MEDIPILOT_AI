const test = require("node:test");
const assert = require("node:assert/strict");
const { formatLabAnswer } = require("../ollamaRagService");

function report(id, date, value, unit) {
  return {
    _id: id,
    testName: "Glucose panel",
    testDate: new Date(date),
    results: [{
      parameter: "Glucose",
      value,
      unit,
      referenceRange: "70-100",
      flag: "UNKNOWN",
    }],
  };
}

test("returns latest lab result from matching reports", () => {
  const result = formatLabAnswer(
    [report("new", "2025-03-10", "95", "mg/dL"), report("old", "2024-03-10", "88", "mg/dL")],
    "What is my latest glucose result?"
  );
  assert.match(result.answer, /95 mg\/dL/);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].id, "new");
});

test("compares the last two results only when the reported units agree", () => {
  const result = formatLabAnswer(
    [report("new", "2025-03-10", "95", "mg/dL"), report("old", "2024-03-10", "88", "mg/dL")],
    "Compare my last two glucose results"
  );
  assert.match(result.answer, /numeric difference is 7 mg\/dL/);
  assert.equal(result.sources.length, 2);

  const incompatible = formatLabAnswer(
    [report("new", "2025-03-10", "95", "mg/dL"), report("old", "2024-03-10", "5.3", "mmol/L")],
    "Compare my last two glucose results"
  );
  assert.match(incompatible.answer, /cannot calculate a numeric difference/);
  assert.equal(incompatible.sources.length, 2);
});
