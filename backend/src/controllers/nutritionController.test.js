const test = require("node:test");
const assert = require("node:assert/strict");
const Document = require("../models/Document");
const NutritionEntry = require("../models/NutritionEntry");
const NutritionProfile = require("../models/NutritionProfile");
const nutritionController = require("./nutritionController");

function responseStub() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set(name, value) { this.headers[name] = value; return this; },
  };
}

test("accepts real calendar dates and rejects invalid dates", () => {
  assert.equal(nutritionController.validDate("2026-10-11"), true);
  assert.equal(nutritionController.validDate("2026-02-30"), false);
  assert.equal(nutritionController.validDate("2026/10/11"), false);
});

test("saves a patient-owned meal without inventing nutrition estimates", async (t) => {
  const originalCreate = NutritionEntry.create;
  t.after(() => { NutritionEntry.create = originalCreate; });
  let saved;
  NutritionEntry.create = async (body) => { saved = body; return { ...body, _id: "meal-id" }; };
  const response = responseStub();

  await nutritionController.createNutritionEntry({
    user: { userId: "patient-id", role: "PATIENT" },
    body: {
      entryDate: "2026-10-11",
      entryType: "MEAL",
      title: "Lunch",
      details: "Rice and vegetables",
    },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(saved.userId, "patient-id");
  assert.equal(saved.entryType, "MEAL");
  assert.deepEqual(saved.nutritionEstimate, {
    calories: null,
    proteinGrams: null,
    carbohydrateGrams: null,
    fatGrams: null,
  });
});

test("rejects invalid water intake and does not write it", async (t) => {
  const originalCreate = NutritionEntry.create;
  t.after(() => { NutritionEntry.create = originalCreate; });
  let creates = 0;
  NutritionEntry.create = async () => { creates += 1; };
  const response = responseStub();

  await nutritionController.createNutritionEntry({
    user: { userId: "patient-id", role: "PATIENT" },
    body: { entryType: "WATER", title: "Water", amountMl: 0 },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(creates, 0);
});

test("updates only a nutrition entry owned by the signed-in patient", async (t) => {
  const originalUpdate = NutritionEntry.findOneAndUpdate;
  t.after(() => { NutritionEntry.findOneAndUpdate = originalUpdate; });
  let filter;
  NutritionEntry.findOneAndUpdate = async (query, update) => {
    filter = query;
    return { ...update.$set, _id: query._id };
  };
  const response = responseStub();

  await nutritionController.updateNutritionEntry({
    params: { id: "507f1f77bcf86cd799439011" },
    user: { userId: "patient-id", role: "PATIENT" },
    body: {
      entryDate: "2026-10-11",
      entryType: "SLEEP",
      title: "Night sleep",
      durationMinutes: 420,
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(filter, {
    _id: "507f1f77bcf86cd799439011",
    userId: "patient-id",
  });
});

test("refuses to send reports to the planner unless they are confirmed and patient-owned", async (t) => {
  const originalFind = Document.find;
  const originalProfileFind = NutritionProfile.findOne;
  const originalAllergyFind = require("../models/HealthRecord").find;
  const ollamaService = require("../services/ollamaRagService");
  const originalGenerate = ollamaService.generateDietRecommendations;
  t.after(() => {
    Document.find = originalFind;
    NutritionProfile.findOne = originalProfileFind;
    require("../models/HealthRecord").find = originalAllergyFind;
    ollamaService.generateDietRecommendations = originalGenerate;
  });
  let findQuery;
  let generated = false;
  Document.find = (query) => {
    findQuery = query;
    return { select: () => ({ lean: async () => [] }) };
  };
  ollamaService.generateDietRecommendations = async () => { generated = true; };
  const response = responseStub();

  await nutritionController.generateDietPlan({
    body: { documentIds: ["507f1f77bcf86cd799439011"] },
    user: { userId: "patient-id", role: "PATIENT" },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(generated, false);
  assert.deepEqual(findQuery, {
    _id: { $in: ["507f1f77bcf86cd799439011"] },
    patientId: "patient-id",
    reviewStatus: "CONFIRMED",
  });
});

test("blocks non-patient access to saved nutrition data", async () => {
  const response = responseStub();
  await nutritionController.getMyNutrition({
    user: { userId: "doctor-id", role: "DOCTOR" },
    query: {},
  }, response);
  assert.equal(response.statusCode, 403);
});

test("loads the patient's saved nutrition data from MongoDB for the requested week", async (t) => {
  const HealthRecord = require("../models/HealthRecord");
  const originalProfileFindOne = NutritionProfile.findOne;
  const originalEntryFind = NutritionEntry.find;
  const originalRecordFind = HealthRecord.find;
  t.after(() => {
    NutritionProfile.findOne = originalProfileFindOne;
    NutritionEntry.find = originalEntryFind;
    HealthRecord.find = originalRecordFind;
  });

  let profileFilter;
  let entryFilter;
  let allergyFilter;
  const savedProfile = { userId: "patient-id", dietaryPreference: "Vegetarian" };
  const savedEntry = { entryDate: "2026-10-11", entryType: "MEAL", title: "Lunch" };
  const allergy = { title: "Peanuts", details: "Avoid" };
  NutritionProfile.findOne = (filter) => {
    profileFilter = filter;
    return { lean: async () => savedProfile };
  };
  NutritionEntry.find = (filter) => {
    entryFilter = filter;
    return {
      sort: () => ({ lean: async () => [savedEntry] }),
    };
  };
  HealthRecord.find = (filter) => {
    allergyFilter = filter;
    return {
      select: () => ({
        limit: () => ({ lean: async () => [allergy] }),
      }),
    };
  };

  const response = responseStub();
  await nutritionController.getMyNutrition({
    user: { userId: "patient-id", role: "PATIENT" },
    query: { date: "2026-10-11" },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(profileFilter, { userId: "patient-id" });
  assert.deepEqual(entryFilter, {
    userId: "patient-id",
    entryDate: { $gte: "2026-10-05", $lte: "2026-10-11" },
  });
  assert.deepEqual(allergyFilter, {
    patientId: "patient-id",
    recordType: "ALLERGY",
  });
  assert.equal(response.body.profile, savedProfile);
  assert.deepEqual(response.body.entries, [savedEntry]);
  assert.deepEqual(response.body.healthRecordAllergies, [allergy]);
  assert.equal(response.body.weekStart, "2026-10-05");
});

test("validates and saves the explicit food-allergy review confirmation", async (t) => {
  const originalUpdate = NutritionProfile.findOneAndUpdate;
  t.after(() => { NutritionProfile.findOneAndUpdate = originalUpdate; });
  let update;
  NutritionProfile.findOneAndUpdate = (_filter, value) => {
    update = value;
    return { lean: async () => ({ ...value.$set, userId: "patient-id" }) };
  };
  const invalidResponse = responseStub();
  await nutritionController.saveMyNutritionProfile({
    user: { userId: "patient-id", role: "PATIENT" },
    body: { foodAllergiesReviewed: "true" },
  }, invalidResponse);
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal(update, undefined);

  const response = responseStub();

  await nutritionController.saveMyNutritionProfile({
    user: { userId: "patient-id", role: "PATIENT" },
    body: { allergies: [], foodAllergiesReviewed: true },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(update.$set, { allergies: [], foodAllergiesReviewed: true });
});

test("requires reviewed allergy information before calling the AI planner", async (t) => {
  const HealthRecord = require("../models/HealthRecord");
  const originalProfileFindOne = NutritionProfile.findOne;
  const originalHealthRecordFind = HealthRecord.find;
  const originalEntryFind = NutritionEntry.find;
  const ollamaService = require("../services/ollamaRagService");
  const originalGenerate = ollamaService.generateDietRecommendations;
  t.after(() => {
    NutritionProfile.findOne = originalProfileFindOne;
    HealthRecord.find = originalHealthRecordFind;
    NutritionEntry.find = originalEntryFind;
    ollamaService.generateDietRecommendations = originalGenerate;
  });
  NutritionProfile.findOne = () => ({ lean: async () => null });
  HealthRecord.find = () => ({ select: () => ({ limit: () => ({ lean: async () => [] }) }) });
  NutritionEntry.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  let generated = false;
  ollamaService.generateDietRecommendations = async () => { generated = true; };
  const response = responseStub();

  await nutritionController.generateDietPlan({
    body: { documentIds: [], date: "2026-10-11" },
    user: { userId: "patient-id", role: "PATIENT" },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /allergy/i);
  assert.equal(generated, false);
});
