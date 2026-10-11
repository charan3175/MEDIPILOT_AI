const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { after, test } = require("node:test");
const Document = require("../models/Document");
const HealthAccessRequest = require("../models/HealthAccessRequest");
const HealthIdentity = require("../models/HealthIdentity");
const ShareGrant = require("../models/ShareGrant");
const User = require("../models/User");
const ollamaRagService = require("../services/ollamaRagService");
const {
  approveAccessRequest,
  createAccessRequest,
  getMyHealthId,
  getAccessRequestStatus,
} = require("./healthIdController");
const shareController = require("./shareController");
const { accessSharedRecords, getSharedAccessStatus, generateSharedHealthBrief } = shareController;

process.env.JWT_SECRET = "test-only-health-id-secret";

const originalMethods = {
  identityFindOne: HealthIdentity.findOne,
  identityFindOneAndUpdate: HealthIdentity.findOneAndUpdate,
  identityExists: HealthIdentity.exists,
  identityCreate: HealthIdentity.create,
  requestCreate: HealthAccessRequest.create,
  requestFindOne: HealthAccessRequest.findOne,
  requestFindOneAndUpdate: HealthAccessRequest.findOneAndUpdate,
  requestUpdateOne: HealthAccessRequest.updateOne,
  requestExists: HealthAccessRequest.exists,
  documentExists: Document.exists,
  documentFind: Document.find,
  shareCreate: ShareGrant.create,
  shareDeleteOne: ShareGrant.deleteOne,
  shareFindOne: ShareGrant.findOne,
  shareFindOneAndUpdate: ShareGrant.findOneAndUpdate,
  summarizeAuthorizedShare: ollamaRagService.summarizeAuthorizedShare,
  userFindById: User.findById,
};

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

after(() => {
  HealthIdentity.findOne = originalMethods.identityFindOne;
  HealthIdentity.findOneAndUpdate = originalMethods.identityFindOneAndUpdate;
  HealthIdentity.exists = originalMethods.identityExists;
  HealthIdentity.create = originalMethods.identityCreate;
  HealthAccessRequest.create = originalMethods.requestCreate;
  HealthAccessRequest.findOne = originalMethods.requestFindOne;
  HealthAccessRequest.findOneAndUpdate = originalMethods.requestFindOneAndUpdate;
  HealthAccessRequest.updateOne = originalMethods.requestUpdateOne;
  HealthAccessRequest.exists = originalMethods.requestExists;
  Document.exists = originalMethods.documentExists;
  Document.find = originalMethods.documentFind;
  ShareGrant.create = originalMethods.shareCreate;
  ShareGrant.deleteOne = originalMethods.shareDeleteOne;
  ShareGrant.findOne = originalMethods.shareFindOne;
  ShareGrant.findOneAndUpdate = originalMethods.shareFindOneAndUpdate;
  ollamaRagService.summarizeAuthorizedShare = originalMethods.summarizeAuthorizedShare;
  User.findById = originalMethods.userFindById;
});

test("a QR scan creates a pending request without disclosing patient data", async () => {
  const qrToken = crypto.randomBytes(32).toString("hex");
  let savedRequest;
  HealthIdentity.findOne = async (query) => {
    assert.equal(query.tokenHash, crypto.createHash("sha256").update(qrToken).digest("hex"));
    return { _id: "identity-id", patientId: "patient-id", generation: 1 };
  };
  HealthIdentity.findOneAndUpdate = async (query, update) => {
    assert.ok(query.$expr.$or.length);
    assert.ok(Array.isArray(update));
    return { _id: "identity-id" };
  };
  HealthAccessRequest.create = async (request) => {
    savedRequest = request;
    return { _id: "request-id" };
  };
  HealthIdentity.exists = async () => true;

  const res = responseRecorder();
  await createAccessRequest({
    body: {
      qrToken,
      organization: "Example Clinic",
      requesterName: "Care team",
      requesterRole: "physician",
      purpose: "care",
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(Object.keys(res.body).sort(), ["expiresAt", "message", "requestToken", "success"]);
  assert.notEqual(savedRequest.requestTokenHash, res.body.requestToken);
  assert.equal(savedRequest.patientId, "patient-id");
  assert.equal(savedRequest.requesterRole, "physician");
  assert.equal(savedRequest.identityGeneration, 1);
  assert.equal(savedRequest.status, undefined);
  assert.equal(savedRequest.accessEvents[0].event, "requested");
});

test("a QR access request requires a self-reported requester role", async () => {
  const res = responseRecorder();
  await createAccessRequest({
    body: {
      qrToken: crypto.randomBytes(32).toString("hex"),
      organization: "Example Clinic",
      purpose: "care",
    },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /role/i);
});

test("returns an existing patient's QR token only after selecting its stored hash", async () => {
  const { createQrToken, hashToken } = require("../services/healthIdService");
  const healthId = "AHI-0123456789ABCDEF0123";
  const identity = {
    _id: "identity-id",
    healthId,
    generation: 4,
    tokenHash: hashToken(createQrToken(healthId, 4, process.env.JWT_SECRET)),
  };
  HealthIdentity.findOne = () => ({
    select: async (fields) => {
      assert.equal(fields, "+tokenHash");
      return identity;
    },
  });

  const res = responseRecorder();
  await getMyHealthId({
    user: { userId: "patient-id", role: "PATIENT" },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.qrToken, createQrToken(healthId, 4, process.env.JWT_SECRET));
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("limits excessive requests for a valid QR without returning patient information", async () => {
  const qrToken = crypto.randomBytes(32).toString("hex");
  HealthIdentity.findOne = async () => ({
    _id: "identity-id",
    patientId: "patient-id",
    generation: 1,
  });
  HealthIdentity.findOneAndUpdate = async () => null;
  HealthIdentity.exists = async () => true;

  const res = responseRecorder();
  await createAccessRequest({
    body: {
      qrToken,
      organization: "Example Clinic",
      purpose: "care",
      requesterRole: "physician",
    },
  }, res);

  assert.equal(res.statusCode, 429);
  assert.equal(Object.hasOwn(res.body, "patientId"), false);
  assert.match(res.body.message, /too many recent requests/i);
});

test("a pending request status response contains no patient or record information", async () => {
  const requestToken = crypto.randomBytes(32).toString("hex");
  HealthAccessRequest.findOneAndUpdate = (query, update) => ({
    select: async (fields) => {
      assert.equal(fields, "status requestExpiresAt grantedExpiresAt");
      assert.equal(query.requestTokenHash, crypto.createHash("sha256").update(requestToken).digest("hex"));
      assert.ok(Array.isArray(update));
      return {
        _id: "request-id",
        status: "PENDING",
        requestExpiresAt: new Date(Date.now() + 60_000),
        grantedExpiresAt: null,
        patientId: "patient-id",
        records: [{ kind: "document", recordId: "record-id" }],
      };
    },
  });

  const res = responseRecorder();
  await getAccessRequestStatus({ params: { token: requestToken } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ["expiresAt", "status", "success"]);
  assert.equal(res.body.status, "pending");
});

test("limits status polling without disclosing whether a request token exists", async () => {
  const requestToken = crypto.randomBytes(32).toString("hex");
  HealthAccessRequest.findOneAndUpdate = (query, update) => ({
    select: async () => {
      assert.equal(query.requestTokenHash, crypto.createHash("sha256").update(requestToken).digest("hex"));
      assert.ok(query.$expr.$or.length);
      assert.ok(Array.isArray(update));
      return null;
    },
  });

  const res = responseRecorder();
  await getAccessRequestStatus({ params: { token: requestToken } }, res);

  assert.equal(res.statusCode, 429);
  assert.equal(Object.hasOwn(res.body, "patientId"), false);
});

test("the public records viewer denies a QR grant before patient approval", async () => {
  const token = crypto.randomBytes(32).toString("hex");
  ShareGrant.findOne = () => ({
    lean: async () => ({
      _id: "share-id",
      patientId: "patient-id",
      source: "health-id",
      healthAccessRequestId: "request-id",
      expiresAt: new Date(Date.now() + 60_000),
      records: [],
    }),
  });
  ShareGrant.findOneAndUpdate = () => {
    throw new Error("A QR grant must not be logged as accessed before consent is verified.");
  };
  HealthAccessRequest.exists = async () => null;
  User.findById = async () => {
    throw new Error("Patient records must not be queried before consent.");
  };

  const res = responseRecorder();
  await accessSharedRecords({ params: { token } }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    success: false,
    message: "This share link is invalid, expired, or revoked.",
  });
});

test("the professional status endpoint reports expiration without returning records", async () => {
  const token = crypto.randomBytes(32).toString("hex");
  ShareGrant.findOne = (query) => ({
    select: (fields) => ({
      lean: async () => {
        assert.equal(query.tokenHash, crypto.createHash("sha256").update(token).digest("hex"));
        assert.match(fields, /expiresAt/);
        return {
          _id: "share-id",
          patientId: "patient-id",
          source: "direct",
          expiresAt: new Date(Date.now() - 1000),
          revokedAt: null,
        };
      },
    }),
  });

  const res = responseRecorder();
  await getSharedAccessStatus({ params: { token } }, res);

  assert.equal(res.statusCode, 410);
  assert.equal(res.body.status, "expired");
  assert.match(res.body.message, /Access expired/i);
  assert.equal(Object.hasOwn(res.body, "records"), false);
});

test("the Health ID AI brief only loads and summarizes records in the approved grant", async () => {
  const token = crypto.randomBytes(32).toString("hex");
  const patientId = new mongoose.Types.ObjectId();
  const recordId = new mongoose.Types.ObjectId();
  const requestId = new mongoose.Types.ObjectId();
  const shareId = new mongoose.Types.ObjectId();
  ShareGrant.findOne = (query) => ({
    select: async (fields) => {
      assert.equal(query.tokenHash, crypto.createHash("sha256").update(token).digest("hex"));
      assert.match(fields, /records/);
      return {
        _id: shareId,
        patientId,
        source: "health-id",
        healthAccessRequestId: requestId,
        records: [{ kind: "document", recordId }],
      };
    },
  });
  HealthAccessRequest.findOne = (query) => ({
    select: async () => {
      assert.equal(query._id, requestId);
      assert.equal(query.patientId, patientId);
      assert.equal(query.status, "APPROVED");
      return { _id: requestId };
    },
  });
  Document.find = (query) => ({
    select: () => ({
      lean: async () => {
        assert.equal(query.patientId, patientId);
        assert.deepEqual(query._id.$in, [recordId]);
        return [{
          _id: recordId,
          originalName: "selected-report.pdf",
          documentType: "LAB_REPORT",
          reviewStatus: "CONFIRMED",
          extractedData: [{ testName: "Glucose", originalValue: "95", unit: "mg/dL" }],
        }];
      },
    }),
  });
  HealthAccessRequest.exists = async () => true;
  ShareGrant.findOneAndUpdate = (query) => ({
    select: async () => {
      assert.equal(query._id, shareId);
      assert.equal(query.tokenHash, crypto.createHash("sha256").update(token).digest("hex"));
      return { _id: shareId };
    },
  });
  HealthAccessRequest.updateOne = async () => ({ modifiedCount: 1 });
  ollamaRagService.summarizeAuthorizedShare = async ({ records }) => {
    assert.equal(records.length, 1);
    assert.equal(records[0].sourceId, recordId.toString());
    assert.equal(records[0].documentedValues[0].originalValue, "95");
    return "AI summary grounded in selected-report.pdf.";
  };

  const res = responseRecorder();
  await generateSharedHealthBrief({ params: { token } }, res);

  assert.equal(res.statusCode, 200);
  assert.match(res.body.brief, /selected-report\.pdf/);
  assert.equal(res.body.sources.length, 1);
  assert.equal(res.body.sources[0].id, recordId.toString());
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("approval rejects records not owned by the patient", async () => {
  const patientId = new mongoose.Types.ObjectId().toString();
  const recordId = new mongoose.Types.ObjectId().toString();
  HealthAccessRequest.findOne = () => ({
    select: async () => ({
      _id: new mongoose.Types.ObjectId(),
      requestTokenHash: "a".repeat(64),
      identityId: "identity-id",
      identityGeneration: 1,
      organization: "Example Clinic",
      requesterName: "",
      purpose: "care",
      requesterRole: "physician",
    }),
  });
  HealthIdentity.exists = async () => true;
  Document.exists = async (query) => {
    assert.equal(query._id.toString(), recordId);
    assert.equal(query.patientId, patientId);
    return null;
  };
  ShareGrant.create = async () => {
    throw new Error("Should not create a share for an unowned record.");
  };

  const res = responseRecorder();
  await approveAccessRequest({
    user: { userId: patientId, role: "PATIENT" },
    params: { id: "request-id" },
    body: { records: [{ kind: "document", id: recordId }], expiresInHours: 1 },
  }, res);

  assert.equal(res.statusCode, 404);
  assert.match(res.body.message, /not found in your account/i);
});

test("approval creates a time-limited grant for only the patient-selected records", async () => {
  const patientId = new mongoose.Types.ObjectId().toString();
  const recordId = new mongoose.Types.ObjectId().toString();
  const requestId = new mongoose.Types.ObjectId();
  let createdShare;
  let updateCount = 0;
  HealthAccessRequest.findOne = () => ({
    select: async () => ({
      _id: requestId,
      requestTokenHash: "b".repeat(64),
      identityId: "identity-id",
      identityGeneration: 1,
      organization: "Example Clinic",
      requesterName: "Care team",
      requesterRole: "physician",
      purpose: "care",
    }),
  });
  HealthIdentity.exists = async () => true;
  Document.exists = async () => ({ _id: recordId });
  ShareGrant.create = async (data) => {
    createdShare = data;
    return { _id: "share-id" };
  };
  HealthAccessRequest.findOneAndUpdate = async (query, update) => {
    updateCount += 1;
    if (updateCount === 1) {
      assert.equal(query.status, "PENDING");
      assert.equal(update.$set.status, "APPROVING");
      return { status: "APPROVING" };
    }
    assert.equal(query.status, "APPROVING");
    assert.equal(update.$set.status, "APPROVED");
    return { status: "APPROVED" };
  };

  const res = responseRecorder();
  await approveAccessRequest({
    user: { userId: patientId, role: "PATIENT" },
    params: { id: requestId.toString() },
    body: { records: [{ kind: "document", id: recordId }], expiresInMinutes: 360 },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updateCount, 2);
  assert.equal(createdShare.source, "health-id");
  assert.equal(createdShare.requesterRole, "physician");
  assert.equal(createdShare.tokenHash, "b".repeat(64));
  assert.equal(createdShare.records.length, 1);
  assert.equal(createdShare.records[0].kind, "document");
  assert.equal(createdShare.records[0].recordId.toString(), recordId);
  assert.equal(createdShare.expiresAt.getTime() > Date.now(), true);
});

test("approval rejects durations longer than the three-day maximum", async () => {
  const res = responseRecorder();
  await approveAccessRequest({
    user: { userId: new mongoose.Types.ObjectId().toString(), role: "PATIENT" },
    params: { id: new mongoose.Types.ObjectId().toString() },
    body: {
      records: [{ kind: "document", id: new mongoose.Types.ObjectId().toString() }],
      expiresInMinutes: 4321,
    },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /3 days/i);
});

test("expired pending requests become unavailable without exposing records", async () => {
  const requestToken = crypto.randomBytes(32).toString("hex");
  let updateCount = 0;
  HealthAccessRequest.findOneAndUpdate = (query, update) => {
    updateCount += 1;
    if (updateCount === 1) {
      assert.equal(query.requestTokenHash, crypto.createHash("sha256").update(requestToken).digest("hex"));
      assert.ok(Array.isArray(update));
      return {
        select: async () => ({
          _id: "request-id",
          status: "PENDING",
          requestExpiresAt: new Date(Date.now() - 1_000),
          grantedExpiresAt: null,
        }),
      };
    }
    assert.deepEqual(query, { _id: "request-id", status: "PENDING" });
    return { status: "EXPIRED" };
  };

  const res = responseRecorder();
  await getAccessRequestStatus({ params: { token: requestToken } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "expired");
  assert.equal(Object.hasOwn(res.body, "records"), false);
});
