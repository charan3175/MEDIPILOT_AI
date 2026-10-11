const assert = require("node:assert/strict");
const { test } = require("node:test");
const { summarizeAuthorizedShare } = require("./ollamaRagService");

test("the authorized-share brief sends only the supplied scoped records to Ollama", async () => {
  const originalFetch = global.fetch;
  const requestBodies = [];
  global.fetch = async (url, options) => {
    if (String(url).endsWith("/api/tags")) {
      return {
        ok: true,
        json: async () => ({ models: [{ name: process.env.OLLAMA_MODEL || "qwen2.5:3b" }] }),
      };
    }
    requestBodies.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => ({ message: { content: "Documented finding from [authorized report]." } }),
    };
  };

  try {
    const records = [{
      sourceTitle: "authorized report",
      sourceId: "selected-document-id",
      documentedValues: [{ testName: "Glucose", originalValue: "95", unit: "mg/dL" }],
    }];
    const brief = await summarizeAuthorizedShare({ records });
    assert.equal(brief, "Documented finding from [authorized report].");
    const message = requestBodies[0].messages[1].content;
    assert.match(message, /selected-document-id/);
    assert.match(message, /95/);
    assert.doesNotMatch(message, /unselected-record/i);
  } finally {
    global.fetch = originalFetch;
  }
});
