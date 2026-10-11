const crypto = require("crypto");
const mongoose = require("mongoose");
const Document = require("../models/Document");
const HealthRecord = require("../models/HealthRecord");
const HealthAccessRequest = require("../models/HealthAccessRequest");
const HealthIdentity = require("../models/HealthIdentity");
const Medication = require("../models/Medication");
const ShareGrant = require("../models/ShareGrant");
const { createHealthId, createQrToken, hashToken } = require("../services/healthIdService");

const REQUEST_LIFETIME_MINUTES = 15;
const MAX_STATUS_POLLS_PER_MINUTE = 30;
const MAX_ACCESS_EVENTS = 50;
const allowedRecordModels = {
  document: Document,
  record: HealthRecord,
  medication: Medication,
};

async function findOrCreateIdentity(patientId) {
  let identity = await HealthIdentity.findOne({ patientId }).select("+tokenHash");
  if (identity) return identity;

  const healthId = createHealthId();
  const token = createQrToken(healthId, 1);
  try {
    await HealthIdentity.create({
      patientId,
      healthId,
      generation: 1,
      tokenHash: hashToken(token),
      accessEvents: [{ event: "created", occurredAt: new Date() }],
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  identity = await HealthIdentity.findOne({ patientId }).select("+tokenHash");
  if (identity) return identity;
  throw new Error("The Health ID could not be loaded after creation.");
}

function patientOnly(req, res) {
  if (req.user.role === "PATIENT") return true;
  res.status(403).json({ success: false, message: "A patient account is required." });
  return false;
}

const getMyHealthId = async (req, res) => {
  try {
    if (!patientOnly(req, res)) return;
    const identity = await findOrCreateIdentity(req.user.userId);
    const qrToken = createQrToken(identity.healthId, identity.generation);
    if (hashToken(qrToken) !== identity.tokenHash) {
      return res.status(503).json({
        success: false,
        message: "The Health ID QR is unavailable. Replace the QR from this signed-in page.",
      });
    }
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      healthId: identity.healthId,
      qrToken,
      prototype: true,
    });
  } catch (error) {
    console.error("Loading patient Health ID failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load your Health ID." });
  }
};

const regenerateHealthId = async (req, res) => {
  try {
    if (!patientOnly(req, res)) return;
    const identity = await findOrCreateIdentity(req.user.userId);
    const generation = identity.generation + 1;
    const qrToken = createQrToken(identity.healthId, generation);
    const updated = await HealthIdentity.findOneAndUpdate(
      { _id: identity._id, patientId: req.user.userId, generation: identity.generation },
      {
        $set: { generation, tokenHash: hashToken(qrToken), active: true },
        $push: {
          accessEvents: {
            $each: [{ event: "link-regenerated", occurredAt: new Date() }],
            $slice: -MAX_ACCESS_EVENTS,
          },
        },
      },
      { new: true }
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: "The QR code changed. Refresh and try again." });
    }
    const now = new Date();
    await HealthAccessRequest.updateMany(
      { identityId: identity._id, status: { $in: ["PENDING", "APPROVING"] } },
      {
        $set: { status: "DENIED" },
        $push: {
          accessEvents: {
            $each: [{ event: "denied", occurredAt: now }],
            $slice: -MAX_ACCESS_EVENTS,
          },
        },
      }
    );
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      healthId: updated.healthId,
      qrToken,
      message: "A new QR code is active. Requests from the previous code were denied.",
    });
  } catch (error) {
    console.error("Regenerating patient Health ID failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to regenerate the QR code." });
  }
};

const createAccessRequest = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const { qrToken, organization, requesterName = "", requesterRole, purpose } = req.body || {};
    if (
      typeof qrToken !== "string" ||
      !/^[a-f0-9]{64}$/i.test(qrToken) ||
      typeof organization !== "string" ||
      !organization.trim() ||
      organization.trim().length > 120 ||
      typeof requesterName !== "string" ||
      requesterName.trim().length > 100 ||
      !["physician", "nurse", "technician", "administrator", "other"].includes(requesterRole) ||
      !["care", "diagnostic-review", "follow-up", "other"].includes(purpose)
    ) {
      return res.status(400).json({ success: false, message: "Enter a clinic, a valid requester role, a valid purpose, and an optional requester name." });
    }

    const identity = await HealthIdentity.findOne({
      tokenHash: hashToken(qrToken),
      active: true,
    });
    if (!identity) {
      return res.status(404).json({ success: false, message: "This Health ID QR is invalid or has been replaced." });
    }
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
    const allowedRequest = await HealthIdentity.findOneAndUpdate(
      {
        _id: identity._id,
        tokenHash: hashToken(qrToken),
        active: true,
        $expr: {
          $or: [
            { $lte: [{ $ifNull: ["$requestWindowStartedAt", new Date(0)] }, windowStart] },
            { $lt: [{ $ifNull: ["$requestCount", 0] }, 10] },
          ],
        },
      },
      [
        {
          $set: {
            requestWindowStartedAt: {
              $cond: [
                { $gt: [{ $ifNull: ["$requestWindowStartedAt", new Date(0)] }, windowStart] },
                "$requestWindowStartedAt",
                now,
              ],
            },
            requestCount: {
              $cond: [
                { $gt: [{ $ifNull: ["$requestWindowStartedAt", new Date(0)] }, windowStart] },
                { $add: [{ $ifNull: ["$requestCount", 0] }, 1] },
                1,
              ],
            },
          },
        },
      ],
      { new: true }
    );
    if (!allowedRequest) {
      const identityIsCurrent = await HealthIdentity.exists({
        _id: identity._id,
        tokenHash: hashToken(qrToken),
        active: true,
      });
      if (!identityIsCurrent) {
        return res.status(404).json({ success: false, message: "This Health ID QR is invalid or has been replaced." });
      }
      return res.status(429).json({ success: false, message: "This QR has received too many recent requests. Ask the patient to try again later." });
    }

    const requestToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(now.getTime() + REQUEST_LIFETIME_MINUTES * 60 * 1000);
    const accessRequest = await HealthAccessRequest.create({
      patientId: identity.patientId,
      identityId: identity._id,
      identityGeneration: identity.generation,
      requestTokenHash: hashToken(requestToken),
      organization: organization.trim(),
      requesterName: requesterName.trim(),
      requesterRole,
      purpose,
      requestExpiresAt: expiresAt,
      accessEvents: [{ event: "requested", occurredAt: new Date() }],
    });
    const stillCurrent = await HealthIdentity.exists({
      _id: identity._id,
      tokenHash: hashToken(qrToken),
      active: true,
    });
    if (!stillCurrent) {
      await HealthAccessRequest.updateOne(
        { _id: accessRequest._id, status: "PENDING" },
        {
          $set: { status: "DENIED" },
          $push: {
            accessEvents: {
              $each: [{ event: "denied", occurredAt: new Date() }],
              $slice: -MAX_ACCESS_EVENTS,
            },
          },
        }
      );
      return res.status(404).json({ success: false, message: "This Health ID QR is invalid or has been replaced." });
    }
    res.set("Cache-Control", "no-store");
    return res.status(201).json({
      success: true,
      requestToken,
      expiresAt,
      message: "Request sent. No patient details or records are visible until the patient approves.",
    });
  } catch (error) {
    console.error("Creating Health ID access request failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to send the access request." });
  }
};

const getAccessRequestStatus = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    if (!/^[a-f0-9]{64}$/i.test(req.params.token)) {
      return res.status(404).json({ success: false, message: "Access request not found." });
    }
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 1000);
    const request = await HealthAccessRequest.findOneAndUpdate(
      {
        requestTokenHash: hashToken(req.params.token),
        $expr: {
          $or: [
            { $lte: [{ $ifNull: ["$statusPollWindowStartedAt", new Date(0)] }, windowStart] },
            { $lt: [{ $ifNull: ["$statusPollCount", 0] }, MAX_STATUS_POLLS_PER_MINUTE] },
          ],
        },
      },
      [
        {
          $set: {
            statusPollWindowStartedAt: {
              $cond: [
                { $gt: [{ $ifNull: ["$statusPollWindowStartedAt", new Date(0)] }, windowStart] },
                "$statusPollWindowStartedAt",
                now,
              ],
            },
            statusPollCount: {
              $cond: [
                { $gt: [{ $ifNull: ["$statusPollWindowStartedAt", new Date(0)] }, windowStart] },
                { $add: [{ $ifNull: ["$statusPollCount", 0] }, 1] },
                1,
              ],
            },
          },
        },
      ],
      { new: true }
    ).select("status requestExpiresAt grantedExpiresAt");
    if (!request) {
      return res.status(429).json({ success: false, message: "This access request is unavailable or has received too many status checks. Try again shortly." });
    }
    let status = request.status;
    if (status === "PENDING" && request.requestExpiresAt <= now) {
      const updated = await HealthAccessRequest.findOneAndUpdate(
        { _id: request._id, status: "PENDING" },
        {
          $set: { status: "EXPIRED" },
          $push: {
            accessEvents: {
              $each: [{ event: "expired", occurredAt: new Date() }],
              $slice: -MAX_ACCESS_EVENTS,
            },
          },
        },
        { new: true }
      );
      status = updated?.status || "EXPIRED";
    } else if (status === "APPROVED" && request.grantedExpiresAt <= now) {
      const updated = await HealthAccessRequest.findOneAndUpdate(
        {
          _id: request._id,
          status: "APPROVED",
          grantedExpiresAt: { $lte: now },
        },
        {
          $set: { status: "EXPIRED" },
          $push: {
            accessEvents: {
              $each: [{ event: "expired", occurredAt: now }],
              $slice: -MAX_ACCESS_EVENTS,
            },
          },
        },
        { new: true }
      );
      status = updated?.status || "EXPIRED";
    }
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      status: status.toLowerCase(),
      expiresAt: status === "APPROVED" ? request.grantedExpiresAt : request.requestExpiresAt,
    });
  } catch (error) {
    console.error("Checking Health ID request status failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to check the request status." });
  }
};

const listAccessRequests = async (req, res) => {
  try {
    if (!patientOnly(req, res)) return;
    const requests = await HealthAccessRequest.find({ patientId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const identity = await HealthIdentity.findOne({ patientId: req.user.userId })
      .select("accessEvents")
      .lean();
    const grantIds = requests
      .map((request) => request.shareGrantId)
      .filter(Boolean);
    const grants = await ShareGrant.find({
      _id: { $in: grantIds },
      patientId: req.user.userId,
    }).select("expiresAt revokedAt accessCount accessEvents").lean();
    const grantById = new Map(grants.map((grant) => [grant._id.toString(), grant]));
    const now = new Date();
    const expiredRequestIds = requests
      .filter((request) => {
        if (request.status !== "APPROVED") return false;
        const grant = request.shareGrantId
          ? grantById.get(request.shareGrantId.toString())
          : null;
        return Boolean(grant && !grant.revokedAt && grant.expiresAt <= now);
      })
      .map((request) => request._id);
    if (expiredRequestIds.length) {
      await HealthAccessRequest.updateMany(
        { _id: { $in: expiredRequestIds }, patientId: req.user.userId, status: "APPROVED" },
        {
          $set: { status: "EXPIRED" },
          $push: {
            accessEvents: {
              $each: [{ event: "expired", occurredAt: now }],
              $slice: -MAX_ACCESS_EVENTS,
            },
          },
        }
      );
    }
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      identityEvents: identity?.accessEvents || [],
      requests: requests.map((request) => {
        const grant = request.shareGrantId
          ? grantById.get(request.shareGrantId.toString())
          : null;
        let status = request.status;
        if (status === "PENDING" && request.requestExpiresAt <= now) status = "EXPIRED";
        if (status === "APPROVED" && (!grant || grant.revokedAt || grant.expiresAt <= now)) {
          status = grant?.revokedAt ? "REVOKED" : "EXPIRED";
        }
        return {
          _id: request._id,
          organization: request.organization,
          requesterName: request.requesterName,
          requesterRole: request.requesterRole,
          purpose: request.purpose,
          status: status.toLowerCase(),
          requestedAt: request.createdAt,
          expiresAt: grant?.expiresAt || request.requestExpiresAt,
          recordCount: request.recordCount,
          accessCount: grant?.accessCount || 0,
          events: [
            ...request.accessEvents,
            ...(grant?.accessEvents || []).filter((event) => ["accessed", "brief-generated"].includes(event.event)),
          ].sort((left, right) => new Date(left.occurredAt) - new Date(right.occurredAt)),
        };
      }),
    });
  } catch (error) {
    console.error("Listing Health ID access requests failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load Health ID access history." });
  }
};

const approveAccessRequest = async (req, res) => {
  try {
    if (!patientOnly(req, res)) return;
    const { records, expiresInHours, expiresInMinutes } = req.body;
    if (!Array.isArray(records) || records.length < 1 || records.length > 50) {
      return res.status(400).json({ success: false, message: "Select between 1 and 50 records to share." });
    }
    const durationMinutes = expiresInMinutes == null
      ? Number(expiresInHours) * 60
      : Number(expiresInMinutes);
    if (![15, 30, 60, 360, 1440, 4320].includes(durationMinutes)) {
      return res.status(400).json({ success: false, message: "Choose an access duration from 15 minutes up to 3 days." });
    }
    const request = await HealthAccessRequest.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
      status: "PENDING",
      requestExpiresAt: { $gt: new Date() },
    }).select("+requestTokenHash");
    if (!request) {
      return res.status(404).json({ success: false, message: "Pending access request not found or expired." });
    }
    const identityIsCurrent = await HealthIdentity.exists({
      _id: request.identityId,
      patientId: req.user.userId,
      generation: request.identityGeneration,
      active: true,
    });
    if (!identityIsCurrent) {
      const now = new Date();
      await HealthAccessRequest.updateOne(
        { _id: request._id, patientId: req.user.userId, status: "PENDING" },
        {
          $set: { status: "DENIED" },
          $push: {
            accessEvents: {
              $each: [{ event: "denied", occurredAt: now }],
              $slice: -MAX_ACCESS_EVENTS,
            },
          },
        }
      );
      return res.status(409).json({ success: false, message: "This request was created from a replaced QR and cannot be approved." });
    }

    const normalizedRecords = [];
    const seen = new Set();
    for (const item of records) {
      if (
        !item ||
        typeof item.kind !== "string" ||
        typeof item.id !== "string" ||
        !Object.prototype.hasOwnProperty.call(allowedRecordModels, item.kind) ||
        !mongoose.isValidObjectId(item.id)
      ) {
        return res.status(400).json({ success: false, message: "One or more selected records are invalid." });
      }
      const key = `${item.kind}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalizedRecords.push({ kind: item.kind, recordId: new mongoose.Types.ObjectId(item.id) });
    }
    if (!normalizedRecords.length) {
      return res.status(400).json({ success: false, message: "Select at least one record to share." });
    }
    const ownedRecords = await Promise.all(normalizedRecords.map(({ kind, recordId }) =>
      allowedRecordModels[kind].exists({ _id: recordId, patientId: req.user.userId })
    ));
    if (ownedRecords.some((record) => !record)) {
      return res.status(404).json({ success: false, message: "A selected record was not found in your account. Refresh and try again." });
    }

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    const now = new Date();
    const claim = await HealthAccessRequest.findOneAndUpdate(
      {
        _id: request._id,
        patientId: req.user.userId,
        status: "PENDING",
        requestExpiresAt: { $gt: now },
      },
      { $set: { status: "APPROVING" } },
      { new: true }
    );
    if (!claim) {
      return res.status(409).json({ success: false, message: "This request is no longer pending. Refresh and try again." });
    }

    let share;
    try {
      share = await ShareGrant.create({
        patientId: req.user.userId,
        tokenHash: request.requestTokenHash,
        records: normalizedRecords,
        expiresAt,
        source: "health-id",
        organization: request.organization,
        requesterName: request.requesterName,
        requesterRole: request.requesterRole,
        purpose: request.purpose,
        healthAccessRequestId: request._id,
        accessEvents: [{ event: "created", occurredAt: new Date() }],
      });
    } catch (error) {
      await HealthAccessRequest.updateOne(
        { _id: request._id, patientId: req.user.userId, status: "APPROVING" },
        { $set: { status: "PENDING" } }
      );
      throw error;
    }
    const approved = await HealthAccessRequest.findOneAndUpdate(
      {
        _id: request._id,
        patientId: req.user.userId,
        status: "APPROVING",
        requestExpiresAt: { $gt: now },
      },
      {
        $set: {
          status: "APPROVED",
          shareGrantId: share._id,
          recordCount: normalizedRecords.length,
          grantedExpiresAt: expiresAt,
        },
        $push: {
          accessEvents: {
            $each: [{ event: "approved", occurredAt: now }],
            $slice: -MAX_ACCESS_EVENTS,
          },
        },
      },
      { new: true }
    );
    if (!approved) {
      await ShareGrant.deleteOne({ _id: share._id, patientId: req.user.userId });
      return res.status(409).json({ success: false, message: "This request is no longer pending. Refresh and try again." });
    }
    return res.status(200).json({ success: true, message: "Selected records are now available for the approved time only." });
  } catch (error) {
    console.error("Approving Health ID access request failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to approve this access request." });
  }
};

const denyAccessRequest = async (req, res) => {
  try {
    if (!patientOnly(req, res)) return;
    const now = new Date();
    const request = await HealthAccessRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        patientId: req.user.userId,
        status: "PENDING",
      },
      {
        $set: { status: "DENIED" },
        $push: {
          accessEvents: {
            $each: [{ event: "denied", occurredAt: now }],
            $slice: -MAX_ACCESS_EVENTS,
          },
        },
      },
      { new: true }
    );
    if (!request) {
      return res.status(404).json({ success: false, message: "Pending access request not found." });
    }
    return res.status(200).json({ success: true, message: "Access request denied." });
  } catch (error) {
    console.error("Denying Health ID access request failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to deny this access request." });
  }
};

const revokeAccessRequest = async (req, res) => {
  try {
    if (!patientOnly(req, res)) return;
    const request = await HealthAccessRequest.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
      status: "APPROVED",
    });
    if (!request) {
      return res.status(404).json({ success: false, message: "Active Health ID access not found." });
    }
    const now = new Date();
    const grant = await ShareGrant.findOneAndUpdate(
      {
        _id: request.shareGrantId,
        patientId: req.user.userId,
        revokedAt: null,
      },
      {
        $set: { revokedAt: now },
        $push: {
          accessEvents: {
            $each: [{ event: "revoked", occurredAt: now }],
            $slice: -MAX_ACCESS_EVENTS,
          },
        },
      },
      { new: true }
    );
    await HealthAccessRequest.updateOne(
      { _id: request._id, patientId: req.user.userId, status: "APPROVED" },
      {
        $set: { status: "REVOKED" },
        $push: {
          accessEvents: {
            $each: [{ event: "revoked", occurredAt: now }],
            $slice: -MAX_ACCESS_EVENTS,
          },
        },
      }
    );
    if (!grant && request.grantedExpiresAt > now) {
      return res.status(409).json({ success: false, message: "Access changed before it could be revoked. Refresh the page." });
    }
    return res.status(200).json({ success: true, message: "Health ID access revoked immediately." });
  } catch (error) {
    console.error("Revoking Health ID access failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to revoke Health ID access." });
  }
};

module.exports = {
  getMyHealthId,
  regenerateHealthId,
  createAccessRequest,
  getAccessRequestStatus,
  listAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  revokeAccessRequest,
};
