const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const { after, test } = require("node:test");
const User = require("../models/User");
const { loginUser, registerUser } = require("./authController");

process.env.JWT_SECRET = "test-only-secret";

const originalFindOne = User.findOne;
const originalCreate = User.create;

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
