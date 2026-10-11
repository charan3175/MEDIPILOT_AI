const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHealthId, createQrToken, hashToken } = require("./healthIdService");

test("creates opaque Health IDs and deterministic generation-specific QR tokens", () => {
  const healthId = createHealthId();
  const firstToken = createQrToken(healthId, 1, "test-secret");

  assert.match(healthId, /^AHI-[A-F0-9]{20}$/);
  assert.match(firstToken, /^[a-f0-9]{64}$/);
  assert.equal(createQrToken(healthId, 1, "test-secret"), firstToken);
  assert.notEqual(createQrToken(healthId, 2, "test-secret"), firstToken);
  assert.notEqual(createQrToken(healthId, 1, "different-secret"), firstToken);
  assert.equal(hashToken(firstToken).includes(firstToken), false);
});

test("requires a signing secret when creating a QR token", () => {
  assert.throws(() => createQrToken("AHI-EXAMPLE", 1, ""), /JWT_SECRET/);
});
