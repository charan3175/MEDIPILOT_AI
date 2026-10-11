import assert from "node:assert/strict";
import test from "node:test";
import { api, saveSession } from "./api.js";
import { clearGuestSandbox } from "./guestSandbox.js";

function installBrowserStorage(t) {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const previousSessionStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const localValues = new Map();
  const sessionValues = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key) {
        return localValues.get(key) ?? null;
      },
      setItem(key, value) {
        localValues.set(key, String(value));
      },
      removeItem(key) {
        localValues.delete(key);
      },
    },
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem(key) {
        return sessionValues.get(key) ?? null;
      },
      setItem(key, value) {
        sessionValues.set(key, String(value));
      },
      removeItem(key) {
        sessionValues.delete(key);
      },
    },
  });

  t.after(() => {
    if (previousStorage) {
      Object.defineProperty(globalThis, "localStorage", previousStorage);
    } else {
      delete globalThis.localStorage;
    }
    if (previousSessionStorage) {
      Object.defineProperty(globalThis, "sessionStorage", previousSessionStorage);
    } else {
      delete globalThis.sessionStorage;
    }
  });
}

test("guest data reads and writes stay in the browser session", async (t) => {
  installBrowserStorage(t);
  const previousFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
  });

  localStorage.setItem("medipilot_user", JSON.stringify({
    name: "Demo Patient",
    role: "PATIENT",
    isDemo: true,
  }));

  const profile = await api.get("/dashboard/me");
  assert.equal(profile.profile.name, "Demo Patient");
  assert.equal((await api.get("/documents/my")).documents.length, 2);

  const savedEntry = await api.post("/nutrition/entries", {
    entryDate: "2026-10-11",
    entryType: "WATER",
    title: "Water",
    amountMl: 250,
  });
  const nutrition = await api.get("/nutrition/my?date=2026-10-11");
  assert.ok(nutrition.entries.some((entry) => entry._id === savedEntry.entry._id));
  const appointment = await api.post("/appointments", {
    doctorName: "Guest-session test clinician",
    appointmentDate: "2026-10-15",
  });
  await api.patch(`/appointments/${appointment.appointment._id}/status`, {
    status: "CANCELLED",
  });
  assert.equal(
    (await api.get("/appointments/my")).appointments[0].status,
    "CANCELLED"
  );
  await assert.rejects(
    api.post("/nutrition/diet-plan", {}),
    /AI diet planning needs the connected AI service/
  );
  await assert.rejects(
    api.post("/shares", { records: [], expiresInHours: 1 }),
    /Secure hospital links are unavailable in guest mode/
  );
  assert.equal(fetchCalled, false);

  clearGuestSandbox();
  const resetNutrition = await api.get("/nutrition/my?date=2026-10-11");
  assert.ok(!resetNutrition.entries.some((entry) => entry._id === savedEntry.entry._id));
});

test("demo-data preview blocks account requests without reaching the backend", async (t) => {
  installBrowserStorage(t);
  const previousFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch should not be called");
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
  });
  localStorage.setItem("medipilot_user", JSON.stringify({
    name: "Signed-in Patient",
    role: "PATIENT",
  }));
  localStorage.setItem("medipilot_demo_data", "true");

  await assert.rejects(
    api.get("/dashboard/me"),
    /Demo data preview is read-only/
  );
  assert.equal(fetchCalled, false);
});

test("signed-in account requests still include their bearer token", async (t) => {
  installBrowserStorage(t);
  const previousFetch = globalThis.fetch;
  let requestOptions;
  globalThis.fetch = async (_url, options) => {
    requestOptions = options;
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
  });

  saveSession("patient-token", {
    name: "Signed-in Patient",
    role: "PATIENT",
  });

  assert.deepEqual(await api.get("/dashboard/me"), { success: true });
  assert.equal(requestOptions.headers.Authorization, "Bearer patient-token");
});
