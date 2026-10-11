const test = require("node:test");
const assert = require("node:assert/strict");
const { ingestMedicalKnowledge } = require("./conversationController");

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

const validBody = {
  source: "Medical reference",
  title: "Reviewed reference",
  url: "https://example.com/reference",
  category: "general",
  content: "A".repeat(100),
};

test("medical knowledge ingestion is restricted to hospital administrators", async () => {
  const response = responseStub();
  await ingestMedicalKnowledge(
    { user: { role: "PATIENT" }, body: validBody },
    response
  );
  assert.equal(response.statusCode, 403);
});

test("medical knowledge ingestion rejects unapproved or deceptive domains", async () => {
  const response = responseStub();
  await ingestMedicalKnowledge(
    {
      user: { role: "HOSPITAL_ADMIN" },
      body: { ...validBody, url: "https://cdc.gov.attacker.example/reference" },
    },
    response
  );
  assert.equal(response.statusCode, 400);
});
