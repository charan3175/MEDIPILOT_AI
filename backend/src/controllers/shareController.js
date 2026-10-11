const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Document = require("../models/Document");
const HealthRecord = require("../models/HealthRecord");
const Medication = require("../models/Medication");
const ShareGrant = require("../models/ShareGrant");
const HealthAccessRequest = require("../models/HealthAccessRequest");
const User = require("../models/User");
const { buildFhirBundle } = require("../services/fhirService");
const ollamaRagService = require("../services/ollamaRagService");

const ALLOWED_EXPIRY_HOURS = new Set([1, 6, 24, 72, 168, 720]);
const MAX_ACCESS_EVENTS = 50;

const sourceModels = {
  document: Document,
  record: HealthRecord,
  medication: Medication,
};

const listMyShares = async (req, res) => {
  try {
    const now = new Date();
    const shares = await ShareGrant.find({ patientId: req.user.userId })
      .select("records expiresAt revokedAt accessCount accessEvents createdAt source organization requesterName requesterRole purpose")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const withStatus = shares.map((share) => ({
      ...share,
      status: share.revokedAt ? "revoked" : share.expiresAt <= now ? "expired" : "active",
    }));
    return res.status(200).json({ success: true, shares: withStatus });
  } catch (error) {
    console.error("Listing patient shares failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load sharing history." });
  }
};

const createShare = async (req, res) => {
  try {
    const { records, expiresInHours } = req.body;
    if (!Array.isArray(records) || records.length < 1 || records.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Select between 1 and 50 records to share.",
      });
    }
    if (!ALLOWED_EXPIRY_HOURS.has(Number(expiresInHours))) {
      return res.status(400).json({
        success: false,
        message: "Choose an expiry of 1 hour, 6 hours, 1 day, 3 days, 7 days, or 30 days.",
      });
    }

    const normalizedRecords = [];
    const seen = new Set();
    for (const item of records) {
      if (
        !item ||
        typeof item.kind !== "string" ||
        typeof item.id !== "string" ||
        !Object.prototype.hasOwnProperty.call(sourceModels, item.kind) ||
        !mongoose.isValidObjectId(item.id)
      ) {
        return res.status(400).json({ success: false, message: "One or more selected records are invalid." });
      }
      const key = `${item.kind}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalizedRecords.push({
        kind: item.kind,
        recordId: new mongoose.Types.ObjectId(item.id),
      });
    }
    if (!normalizedRecords.length) {
      return res.status(400).json({ success: false, message: "Select at least one record to share." });
    }

    const ownedRecords = await Promise.all(normalizedRecords.map(({ kind, recordId }) =>
      sourceModels[kind].exists({ _id: recordId, patientId: req.user.userId })
    ));
    if (ownedRecords.some((record) => !record)) {
      return res.status(404).json({
        success: false,
        message: "A selected record was not found in your account. Refresh and try again.",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000);
    const share = await ShareGrant.create({
      patientId: req.user.userId,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      records: normalizedRecords,
      expiresAt,
      accessEvents: [{ event: "created", occurredAt: new Date() }],
    });

    res.set("Cache-Control", "no-store");
    return res.status(201).json({
      success: true,
      message: "A secure, expiring share link was created.",
      share: { id: share._id, token, expiresAt, recordCount: normalizedRecords.length },
    });
  } catch (error) {
    console.error("Creating patient share failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to create the share link." });
  }
};

const revokeShare = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid share identifier." });
    }
    const now = new Date();
    const share = await ShareGrant.findOneAndUpdate(
      { _id: req.params.id, patientId: req.user.userId, revokedAt: null },
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
    if (!share) {
      return res.status(404).json({ success: false, message: "Active share not found." });
    }
    if (share.source === "health-id" && share.healthAccessRequestId) {
      await HealthAccessRequest.updateOne(
        {
          _id: share.healthAccessRequestId,
          patientId: req.user.userId,
          status: "APPROVED",
        },
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
    }
    return res.status(200).json({ success: true, message: "Share link revoked." });
  } catch (error) {
    console.error("Revoking patient share failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to revoke the share link." });
  }
};

const accessSharedRecords = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    if (!/^[a-f0-9]{64}$/i.test(req.params.token)) {
      return res.status(404).json({ success: false, message: "This share link is invalid, expired, or revoked." });
    }

    const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const now = new Date();
    const share = await ShareGrant.findOne(
      {
        tokenHash,
        revokedAt: null,
        expiresAt: { $gt: now },
      }
    ).lean();

    if (!share) {
      return res.status(404).json({ success: false, message: "This share link is invalid, expired, or revoked." });
    }
    if (share.source === "health-id") {
      const consent = await HealthAccessRequest.exists({
        _id: share.healthAccessRequestId,
        patientId: share.patientId,
        status: "APPROVED",
        grantedExpiresAt: { $gt: new Date() },
      });
      if (!consent) {
        return res.status(404).json({ success: false, message: "This share link is invalid, expired, or revoked." });
      }
    }

    const [user, sourceRows] = await Promise.all([
      User.findById(share.patientId).select("name").lean(),
      Promise.all(["document", "record", "medication"].map(async (kind) => {
        const ids = share.records.filter((item) => item.kind === kind).map((item) => item.recordId);
        if (!ids.length) return { kind, rows: [] };
        const fields = kind === "document"
          ? "originalName documentType processingStatus reviewStatus extractedData reportDate mimeType createdAt"
          : kind === "record"
            ? "recordType title details value unit recordedAt createdAt"
            : "medicineName dosage frequency instructions prescribedBy status startDate endDate createdAt";
        const rows = await sourceModels[kind]
          .find({ patientId: share.patientId, _id: { $in: ids } })
          .select(fields)
          .lean();
        return { kind, rows };
      })),
    ]);

    if (!user || !sourceRows.some(({ rows }) => rows.length)) {
      return res.status(404).json({ success: false, message: "No shared records are available." });
    }

    const accessAt = new Date();
    const accessRecorded = await ShareGrant.findOneAndUpdate(
      {
        _id: share._id,
        tokenHash,
        revokedAt: null,
        expiresAt: { $gt: accessAt },
      },
      {
        $inc: { accessCount: 1 },
        $set: { lastAccessedAt: accessAt },
        $push: {
          accessEvents: {
            $each: [{ event: "accessed", occurredAt: accessAt }],
            $slice: -MAX_ACCESS_EVENTS,
          },
        },
      },
      { new: true }
    ).select("_id");
    if (!accessRecorded) {
      return res.status(404).json({ success: false, message: "This share link is invalid, expired, or revoked." });
    }
    if (share.source === "health-id") {
      const consent = await HealthAccessRequest.exists({
        _id: share.healthAccessRequestId,
        patientId: share.patientId,
        status: "APPROVED",
        grantedExpiresAt: { $gt: new Date() },
      });
      if (!consent) {
        return res.status(404).json({ success: false, message: "This share link is invalid, expired, or revoked." });
      }
    }

    const selected = Object.fromEntries(sourceRows.map(({ kind, rows }) => [kind, rows]));
    const result = buildFhirBundle({
      user,
      documents: selected.document,
      healthRecords: selected.record,
      medications: selected.medication,
    });
    return res.status(200).json({
      success: true,
      expiresAt: share.expiresAt,
      source: share.source,
      organization: share.organization,
      requesterName: share.requesterName,
      requesterRole: share.requesterRole,
      purpose: share.purpose,
      approvedAt: share.source === "health-id" ? share.createdAt : null,
      documents: selected.document.map((document) => ({
        id: document._id,
        name: document.originalName,
        createdAt: document.createdAt,
      })),
      ...result,
    });
  } catch (error) {
    console.error("Reading patient share failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load shared records." });
  }
};

const downloadSharedDocument = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    if (!/^[a-f0-9]{64}$/i.test(req.params.token) || !mongoose.isValidObjectId(req.params.documentId)) {
      return res.status(404).json({ success: false, message: "Shared document not found." });
    }
    const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const grant = await ShareGrant.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
      records: { $elemMatch: { kind: "document", recordId: req.params.documentId } },
    }).select("_id patientId source healthAccessRequestId");
    if (!grant) {
      return res.status(404).json({ success: false, message: "Shared document not found." });
    }
    if (grant.source === "health-id") {
      const consent = await HealthAccessRequest.exists({
        _id: grant.healthAccessRequestId,
        patientId: grant.patientId,
        status: "APPROVED",
        grantedExpiresAt: { $gt: new Date() },
      });
      if (!consent) {
        return res.status(404).json({ success: false, message: "Shared document not found." });
      }
    }
    const document = await Document.findOne({
      _id: req.params.documentId,
      patientId: grant.patientId,
    }).select("storedName originalName");
    if (!document) {
      return res.status(404).json({ success: false, message: "Shared document not found." });
    }
    const filePath = path.resolve(__dirname, "../../private_uploads", document.storedName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "The stored document is unavailable." });
    }
    const now = new Date();
    const access = await ShareGrant.updateOne(
      { _id: grant._id, revokedAt: null, expiresAt: { $gt: now } },
      {
        $inc: { accessCount: 1 },
        $set: { lastAccessedAt: now },
        $push: {
          accessEvents: {
            $each: [{ event: "accessed", occurredAt: now }],
            $slice: -MAX_ACCESS_EVENTS,
          },
        },
      }
    );
    if (access.modifiedCount !== 1) {
      return res.status(404).json({ success: false, message: "Shared document not found." });
    }
    if (grant.source === "health-id") {
      const consent = await HealthAccessRequest.exists({
        _id: grant.healthAccessRequestId,
        patientId: grant.patientId,
        status: "APPROVED",
        grantedExpiresAt: { $gt: new Date() },
      });
      if (!consent) {
        return res.status(404).json({ success: false, message: "Shared document not found." });
      }
    }
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "no-referrer");
    return res.download(filePath, document.originalName);
  } catch (error) {
    console.error("Downloading shared document failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to download the shared document." });
  }
};

const getSharedAccessStatus = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    if (!/^[a-f0-9]{64}$/i.test(req.params.token)) {
      return res.status(404).json({ success: false, message: "Shared access not found." });
    }

    const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const share = await ShareGrant.findOne({ tokenHash })
      .select("_id patientId source healthAccessRequestId expiresAt revokedAt")
      .lean();
    if (!share) {
      return res.status(404).json({ success: false, message: "Shared access not found." });
    }
    if (share.revokedAt) {
      return res.status(410).json({
        success: false,
        status: "revoked",
        message: "The patient has revoked access to these health records.",
      });
    }
    if (share.expiresAt <= new Date()) {
      if (share.source === "health-id") {
        const expiredAt = new Date();
        await HealthAccessRequest.updateOne(
          {
            _id: share.healthAccessRequestId,
            patientId: share.patientId,
            status: "APPROVED",
            grantedExpiresAt: { $lte: expiredAt },
          },
          {
            $set: { status: "EXPIRED" },
            $push: {
              accessEvents: {
                $each: [{ event: "expired", occurredAt: expiredAt }],
                $slice: -MAX_ACCESS_EVENTS,
              },
            },
          }
        );
      }
      return res.status(410).json({
        success: false,
        status: "expired",
        message: "Access expired. Patient records are no longer available.",
      });
    }
    if (share.source === "health-id") {
      const consent = await HealthAccessRequest.findOne({
        _id: share.healthAccessRequestId,
        patientId: share.patientId,
        status: "APPROVED",
        grantedExpiresAt: { $gt: new Date() },
      }).select("_id");
      if (!consent) {
        return res.status(410).json({
          success: false,
          status: "revoked",
          message: "The patient has revoked access to these health records.",
        });
      }
    }
    return res.status(200).json({
      success: true,
      status: "active",
      expiresAt: share.expiresAt,
    });
  } catch (error) {
    console.error("Checking shared access status failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to verify shared access." });
  }
};

const generateSharedHealthBrief = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    if (!/^[a-f0-9]{64}$/i.test(req.params.token)) {
      return res.status(404).json({ success: false, message: "Authorized records are unavailable." });
    }

    const tokenHash = crypto.createHash("sha256").update(req.params.token).digest("hex");
    const now = new Date();
    const share = await ShareGrant.findOne({
      tokenHash,
      source: "health-id",
      revokedAt: null,
      expiresAt: { $gt: now },
    }).select("_id patientId records healthAccessRequestId");
    if (!share) {
      return res.status(404).json({ success: false, message: "Authorized records are unavailable." });
    }

    const consent = await HealthAccessRequest.findOne({
      _id: share.healthAccessRequestId,
      patientId: share.patientId,
      status: "APPROVED",
      grantedExpiresAt: { $gt: now },
    }).select("_id");
    if (!consent) {
      return res.status(404).json({ success: false, message: "Authorized records are unavailable." });
    }

    const selectedRows = await Promise.all(["document", "record", "medication"].map(async (kind) => {
      const ids = share.records.filter((item) => item.kind === kind).map((item) => item.recordId);
      if (!ids.length) return { kind, rows: [] };
      const fields = kind === "document"
        ? "originalName documentType reportDate pageCount reviewStatus extractedData"
        : kind === "record"
          ? "recordType title details value unit recordedAt"
          : "medicineName dosage frequency instructions prescribedBy status startDate endDate";
      const rows = await sourceModels[kind]
        .find({ patientId: share.patientId, _id: { $in: ids } })
        .select(fields)
        .lean();
      return { kind, rows };
    }));

    const sourceRows = selectedRows.flatMap(({ kind, rows }) => rows.map((row) => ({ kind, row })));
    if (!sourceRows.length) {
      return res.status(410).json({ success: false, message: "The records approved for this share are no longer available." });
    }

    const briefRecords = sourceRows.map(({ kind, row }) => {
      const sourceId = row._id.toString();
      if (kind === "document") {
        return {
          sourceTitle: row.originalName || "Medical report",
          sourceId,
          recordType: row.documentType,
          date: row.reportDate || null,
          pageCount: row.pageCount,
          reviewStatus: row.reviewStatus,
          documentedValues: (row.extractedData || []).map((item) => ({
            testName: item.testName,
            originalValue: item.originalValue || String(item.value),
            unit: item.unit,
            referenceRange: item.referenceRange,
            reportedFlag: item.reportedFlag,
            verificationStatus: item.verificationStatus,
          })),
        };
      }
      if (kind === "record") {
        return {
          sourceTitle: row.title || row.recordType || "Health record",
          sourceId,
          recordType: row.recordType,
          details: String(row.details || "").slice(0, 1200),
          value: row.value,
          unit: row.unit,
          date: row.recordedAt || null,
        };
      }
      return {
        sourceTitle: row.medicineName || "Medication record",
        sourceId,
        recordType: "Medication",
        dosage: row.dosage,
        frequency: row.frequency,
        instructions: String(row.instructions || "").slice(0, 500),
        prescribedBy: row.prescribedBy,
        status: row.status,
        startDate: row.startDate || null,
        endDate: row.endDate || null,
      };
    });

    const brief = await ollamaRagService.summarizeAuthorizedShare({ records: briefRecords });
    const checkedAt = new Date();
    const stillConsented = await HealthAccessRequest.exists({
      _id: consent._id,
      patientId: share.patientId,
      status: "APPROVED",
      grantedExpiresAt: { $gt: checkedAt },
    });
    const recorded = await ShareGrant.findOneAndUpdate(
      {
        _id: share._id,
        patientId: share.patientId,
        tokenHash,
        source: "health-id",
        revokedAt: null,
        expiresAt: { $gt: checkedAt },
      },
      {
        $push: {
          accessEvents: {
            $each: [{ event: "brief-generated", occurredAt: checkedAt }],
            $slice: -MAX_ACCESS_EVENTS,
          },
        },
      },
      { new: true }
    ).select("_id");
    if (!stillConsented || !recorded) {
      return res.status(410).json({ success: false, message: "Sharing access expired or was revoked before the brief was ready." });
    }
    await HealthAccessRequest.updateOne(
      { _id: consent._id, patientId: share.patientId, status: "APPROVED" },
      {
        $push: {
          accessEvents: {
            $each: [{ event: "brief-generated", occurredAt: checkedAt }],
            $slice: -MAX_ACCESS_EVENTS,
          },
        },
      }
    );

    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    return res.status(200).json({
      success: true,
      brief,
      generatedAt: checkedAt,
      sources: briefRecords.map(({ sourceTitle, sourceId, recordType, date, pageCount }) => ({
        title: sourceTitle,
        id: sourceId,
        type: recordType,
        date,
        pageCount,
      })),
      disclaimer: "AI-generated summary of only the records approved for this share; not a clinician-verified record or medical advice.",
    });
  } catch (error) {
    console.error("Generating scoped Health ID brief failed:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: [400, 413, 503].includes(error.status)
        ? error.message
        : "Unable to generate the health brief from approved records.",
    });
  }
};

module.exports = {
  listMyShares,
  createShare,
  revokeShare,
  accessSharedRecords,
  downloadSharedDocument,
  getSharedAccessStatus,
  generateSharedHealthBrief,
};
