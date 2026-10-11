const crypto = require("crypto");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createQrToken(
  healthId,
  generation,
  secret = process.env.HEALTH_ID_QR_SECRET || process.env.JWT_SECRET
) {
  if (!secret) {
    throw new Error("JWT_SECRET is required to create a Health ID QR token.");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(`medipilot-health-id:${healthId}:${generation}`)
    .digest("hex");
}

function createHealthId() {
  return `AHI-${crypto.randomBytes(10).toString("hex").toUpperCase()}`;
}

module.exports = { hashToken, createQrToken, createHealthId };
