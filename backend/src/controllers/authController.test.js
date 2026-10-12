const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const { after, test } = require("node:test");
const User = require("../models/User");
const {
  loginUser,
  loginWithGoogle,
  registerUser,
} = require("./authController");

process.env.JWT_SECRET = "test-only-secret";

const originalFindOne = User.findOne;
const originalCreate = User.create;
const originalVerifyIdToken = OAuth2Client.prototype.verifyIdToken;
const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;

function responseRecorder() {
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

after(() => {
  User.findOne = originalFindOne;
  User.create = originalCreate;
  OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;
  if (originalGoogleClientId === undefined) {
    delete process.env.GOOGLE_CLIENT_ID;
  } else {
    process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
  }
});

test("registers a patient with a normalized email and hashed password", async () => {
  User.findOne = async (query) => {
    assert.deepEqual(query, { email: "patient@example.com" });
    return null;
  };
  User.create = async (data) => {
    assert.equal(data.name, "Test Patient");
    assert.equal(data.role, "PATIENT");
    assert.notEqual(data.password, "long-password");
    return {
      _id: "65bcb0000000000000000001",
      name: data.name,
      email: data.email,
      role: data.role,
    };
  };

  const res = responseRecorder();
  await registerUser(
    {
      body: {
        name: " Test Patient ",
        email: "Patient@Example.com",
        password: "long-password",
      },
    },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.user.email, "patient@example.com");
  assert.equal(res.body.user.role, "PATIENT");
});

test("rejects an existing email address", async () => {
  User.findOne = async () => ({ _id: "65bcb0000000000000000001" });

  const res = responseRecorder();
  await registerUser(
    {
      body: {
        name: "Test Patient",
        email: "patient@example.com",
        password: "long-password",
      },
    },
    res
  );

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /already exists/i);
});

test("logs in a MongoDB user and returns a signed token", async () => {
  User.findOne = async (query) => {
    assert.deepEqual(query, { email: "patient@example.com" });
    return {
      _id: { toString: () => "65bcb0000000000000000001" },
      name: "Test Patient",
      email: "patient@example.com",
      role: "PATIENT",
      password: await bcrypt.hash("long-password", 4),
    };
  };

  const res = responseRecorder();
  await loginUser(
    {
      body: {
        email: "Patient@Example.com",
        password: "long-password",
      },
    },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.email, "patient@example.com");
  assert.equal(typeof res.body.token, "string");
});

test("rejects invalid credentials", async () => {
  User.findOne = async () => null;

  const res = responseRecorder();
  await loginUser(
    {
      body: {
        email: "missing@example.com",
        password: "long-password",
      },
    },
    res
  );

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, "Invalid email or password");
});

test("creates a patient account after verifying a Google credential", async () => {
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  OAuth2Client.prototype.verifyIdToken = async (options) => {
    assert.deepEqual(options, {
      idToken: "google-id-token",
      audience: "test-google-client-id",
    });
    return {
      getPayload: () => ({
        sub: "google-user-123",
        email: "Patient@Example.com",
        email_verified: true,
        name: "Test Patient",
      }),
    };
  };
  User.findOne = async () => null;
  User.create = async (data) => {
    assert.equal(data.name, "Test Patient");
    assert.equal(data.email, "patient@example.com");
    assert.equal(data.googleId, "google-user-123");
    assert.equal(data.role, "PATIENT");
    assert.match(data.password, /^\$2[aby]\$/);
    return {
      _id: { toString: () => "65bcb0000000000000000001" },
      name: data.name,
      email: data.email,
      role: data.role,
    };
  };

  const res = responseRecorder();
  await loginWithGoogle({ body: { credential: "google-id-token" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.email, "patient@example.com");
  assert.equal(typeof res.body.token, "string");
});

test("links a verified Google identity to an existing email account", async () => {
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  OAuth2Client.prototype.verifyIdToken = async () => ({
    getPayload: () => ({
      sub: "google-user-123",
      email: "patient@example.com",
      email_verified: true,
    }),
  });

  const user = {
    _id: { toString: () => "65bcb0000000000000000001" },
    name: "Existing Patient",
    email: "patient@example.com",
    role: "PATIENT",
    googleId: undefined,
    save: async () => {},
  };
  User.findOne = async (query) => {
    if (query.googleId) return null;
    assert.deepEqual(query, { email: "patient@example.com" });
    return user;
  };
  User.create = async () => {
    throw new Error("Should reuse the existing account");
  };

  const res = responseRecorder();
  await loginWithGoogle({ body: { credential: "google-id-token" } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(user.googleId, "google-user-123");
  assert.equal(res.body.user.name, "Existing Patient");
});

test("rejects Google sign-in when the Google email is not verified", async () => {
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  OAuth2Client.prototype.verifyIdToken = async () => ({
    getPayload: () => ({
      sub: "google-user-123",
      email: "patient@example.com",
      email_verified: false,
    }),
  });

  const res = responseRecorder();
  await loginWithGoogle({ body: { credential: "google-id-token" } }, res);

  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /verified email/i);
});
