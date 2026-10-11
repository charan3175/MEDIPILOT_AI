const mongoose = require("mongoose");
const Document = require("../models/Document");
const HealthRecord = require("../models/HealthRecord");
const NutritionEntry = require("../models/NutritionEntry");
const NutritionProfile = require("../models/NutritionProfile");
const { generateDietRecommendations } = require("../services/ollamaRagService");

const ENTRY_TYPES = new Set(["MEAL", "WATER", "EXERCISE", "SLEEP"]);
const NUTRITION_LIMITS = {
  calories: 10000,
  proteinGrams: 1000,
  carbohydrateGrams: 2000,
  fatGrams: 1000,
};
const NUTRITION_FIELDS = Object.keys(NUTRITION_LIMITS);

function isPatient(req, res) {
  if (req.user?.role === "PATIENT") return true;
  res.status(403).json({ success: false, message: "Food and daily habit tools are available to patient accounts only." });
  return false;
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseStringList(value, label) {
  if (!Array.isArray(value) || value.length > 20) {
    return { error: `${label} must contain no more than 20 items.` };
  }
  const items = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim() || item.trim().length > 100) {
      return { error: `Each ${label.toLowerCase()} item must contain 1 to 100 characters.` };
    }
    const normalized = item.trim();
    if (!items.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
      items.push(normalized);
    }
  }
  return { value: items };
}

function normalizeEntry(body, defaultDate) {
  if (!body || !ENTRY_TYPES.has(body.entryType)) {
    return { error: "Choose a meal, water, exercise, or sleep entry." };
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const details = body.details === undefined ? "" : body.details;
  const entryDate = body.entryDate || defaultDate;
  if (!title || title.length > 120 || typeof details !== "string" || details.length > 500) {
    return { error: "Provide a title up to 120 characters and notes up to 500 characters." };
  }
  if (!validDate(entryDate)) return { error: "Choose a valid entry date." };

  const entry = {
    entryDate,
    entryType: body.entryType,
    title,
    details: details.trim(),
    amountMl: null,
    durationMinutes: null,
    nutritionEstimate: Object.fromEntries(NUTRITION_FIELDS.map((field) => [field, null])),
  };
  if (body.entryType === "WATER") {
    if (!Number.isInteger(body.amountMl) || body.amountMl < 1 || body.amountMl > 10000) {
      return { error: "Water amount must be between 1 and 10000 millilitres." };
    }
    entry.amountMl = body.amountMl;
  }
  if (body.entryType === "EXERCISE" || body.entryType === "SLEEP") {
    if (!Number.isInteger(body.durationMinutes) || body.durationMinutes < 1 || body.durationMinutes > 1440) {
      return { error: "Duration must be between 1 and 1440 minutes." };
    }
    entry.durationMinutes = body.durationMinutes;
  }
  if (body.entryType === "MEAL" && body.nutritionEstimate !== undefined) {
    if (!body.nutritionEstimate || typeof body.nutritionEstimate !== "object" || Array.isArray(body.nutritionEstimate)) {
      return { error: "Nutrition estimates must be an object of numeric values." };
    }
    for (const field of NUTRITION_FIELDS) {
      const value = body.nutritionEstimate[field];
      if (value === undefined || value === null || value === "") continue;
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > NUTRITION_LIMITS[field]) {
        return { error: `The ${field} estimate must be between 0 and ${NUTRITION_LIMITS[field]}.` };
      }
      entry.nutritionEstimate[field] = value;
    }
  }
  return { value: entry };
}

const getMyNutrition = async (req, res) => {
  if (!isPatient(req, res)) return;
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    if (!validDate(date)) return res.status(400).json({ success: false, message: "Choose a valid date." });
    const startDate = new Date(`${date}T00:00:00.000Z`);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    const weekStart = startDate.toISOString().slice(0, 10);
    const [profile, entries, allergyRecords] = await Promise.all([
      NutritionProfile.findOne({ userId: req.user.userId }).lean(),
      NutritionEntry.find({
        userId: req.user.userId,
        entryDate: { $gte: weekStart, $lte: date },
      }).sort({ entryDate: 1, createdAt: 1 }).lean(),
      HealthRecord.find({ patientId: req.user.userId, recordType: "ALLERGY" })
        .select("title details")
        .limit(50)
        .lean(),
    ]);
    return res.status(200).json({
      success: true,
      profile,
      entries,
      healthRecordAllergies: allergyRecords.map(({ title, details }) => ({ title, details })),
      date,
      weekStart,
    });
  } catch (error) {
    console.error("Load patient nutrition data failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to load food and daily habit data." });
  }
};

const saveMyNutritionProfile = async (req, res) => {
  if (!isPatient(req, res)) return;
  const body = req.body || {};
  const stringFields = ["dietaryPreference"];
  for (const field of stringFields) {
    if (body[field] !== undefined && (typeof body[field] !== "string" || body[field].length > 100)) {
      return res.status(400).json({ success: false, message: "Dietary preference must be 100 characters or fewer." });
    }
  }
  if (body.foodAllergiesReviewed !== undefined && typeof body.foodAllergiesReviewed !== "boolean") {
    return res.status(400).json({ success: false, message: "Confirm that you reviewed your food-allergy information." });
  }
  const parsed = {};
  for (const [field, label] of [
    ["allergies", "Allergies"],
    ["restrictions", "Food restrictions"],
    ["healthGoals", "Health goals"],
  ]) {
    if (body[field] !== undefined) {
      const result = parseStringList(body[field], label);
      if (result.error) return res.status(400).json({ success: false, message: result.error });
      parsed[field] = result.value;
    }
  }
  const goalLimits = {
    waterGoalMl: [1, 10000],
    exerciseGoalMinutes: [1, 1440],
    sleepGoalHours: [0.25, 24],
  };
  for (const [field, [minimum, maximum]] of Object.entries(goalLimits)) {
    if (body[field] === undefined) continue;
    if (body[field] === null || body[field] === "") {
      parsed[field] = null;
    } else if (typeof body[field] !== "number" || !Number.isFinite(body[field]) || body[field] < minimum || body[field] > maximum) {
      return res.status(400).json({ success: false, message: `Enter a valid ${field.replace(/([A-Z])/g, " $1").toLowerCase()} value.` });
    } else {
      parsed[field] = body[field];
    }
  }
  if (body.dietaryPreference !== undefined) parsed.dietaryPreference = body.dietaryPreference.trim();
  if (body.foodAllergiesReviewed !== undefined) parsed.foodAllergiesReviewed = body.foodAllergiesReviewed;
  if (!Object.keys(parsed).length) return res.status(400).json({ success: false, message: "Provide at least one preference or personal goal to save." });

  try {
    const profile = await NutritionProfile.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: parsed, $setOnInsert: { userId: req.user.userId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    return res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error("Save patient nutrition preferences failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to save food preferences and goals." });
  }
};

const createNutritionEntry = async (req, res) => {
  if (!isPatient(req, res)) return;
  const normalized = normalizeEntry(req.body, new Date().toISOString().slice(0, 10));
  if (normalized.error) return res.status(400).json({ success: false, message: normalized.error });
  try {
    const entry = await NutritionEntry.create({ userId: req.user.userId, ...normalized.value });
    return res.status(201).json({ success: true, entry });
  } catch (error) {
    console.error("Create patient nutrition entry failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to save this daily habit entry." });
  }
};

const updateNutritionEntry = async (req, res) => {
  if (!isPatient(req, res)) return;
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid habit entry identifier." });
  }
  const normalized = normalizeEntry(req.body, new Date().toISOString().slice(0, 10));
  if (normalized.error) return res.status(400).json({ success: false, message: normalized.error });
  try {
    const entry = await NutritionEntry.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: normalized.value },
      { new: true, runValidators: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: "Daily habit entry not found." });
    return res.status(200).json({ success: true, entry });
  } catch (error) {
    console.error("Update patient nutrition entry failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update this daily habit entry." });
  }
};

const deleteNutritionEntry = async (req, res) => {
  if (!isPatient(req, res)) return;
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid habit entry identifier." });
  }
  try {
    const entry = await NutritionEntry.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId,
    });
    if (!entry) return res.status(404).json({ success: false, message: "Daily habit entry not found." });
    return res.status(200).json({ success: true, message: "Daily habit entry deleted." });
  } catch (error) {
    console.error("Delete patient nutrition entry failed:", error.message);
    return res.status(500).json({ success: false, message: "Unable to delete this daily habit entry." });
  }
};

const generateDietPlan = async (req, res) => {
  if (!isPatient(req, res)) return;
  const documentIds = req.body?.documentIds;
  if (!Array.isArray(documentIds) || documentIds.length > 10 || documentIds.some((id) => typeof id !== "string" || !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ success: false, message: "Select up to 10 valid report IDs for review." });
  }
  const uniqueIds = [...new Set(documentIds)];
  const date = req.body?.date || new Date().toISOString().slice(0, 10);
  if (!validDate(date)) return res.status(400).json({ success: false, message: "Choose a valid date for the planner context." });
  const weekStartDate = new Date(`${date}T00:00:00.000Z`);
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - 6);
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  try {
    let reports = [];
    if (uniqueIds.length) {
      reports = await Document.find({
        _id: { $in: uniqueIds },
        patientId: req.user.userId,
        reviewStatus: "CONFIRMED",
      }).select("originalName documentType reportDate extractedData reviewStatus").lean();
      if (reports.length !== uniqueIds.length) {
        return res.status(400).json({ success: false, message: "One or more selected reports are not confirmed reports in your account. Review them and try again." });
      }
    }
    const [profile, allergyRecords, habitEntries] = await Promise.all([
      NutritionProfile.findOne({ userId: req.user.userId }).lean(),
      HealthRecord.find({ patientId: req.user.userId, recordType: "ALLERGY" })
        .select("title details")
        .limit(50)
        .lean(),
      NutritionEntry.find({
        userId: req.user.userId,
        entryDate: { $gte: weekStart, $lte: date },
      })
        .select("entryDate entryType title details amountMl durationMinutes nutritionEstimate")
        .sort({ entryDate: -1, createdAt: -1 })
        .limit(200)
        .lean(),
    ]);
    if (!profile?.foodAllergiesReviewed) {
      return res.status(400).json({ success: false, message: "Review and save your food-allergy information before generating recommendations." });
    }
    const result = await generateDietRecommendations({
      reports,
      profile,
      healthRecordAllergies: allergyRecords,
      habitEntries,
    });
    res.set("Cache-Control", "no-store");
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Generate patient diet recommendations failed:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Unable to generate evidence-grounded food recommendations.",
    });
  }
};

module.exports = {
  getMyNutrition,
  saveMyNutritionProfile,
  createNutritionEntry,
  updateNutritionEntry,
  deleteNutritionEntry,
  generateDietPlan,
  normalizeEntry,
  validDate,
};
