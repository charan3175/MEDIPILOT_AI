const mongoose = require("mongoose");

const nutritionEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    entryDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    entryType: {
      type: String,
      required: true,
      enum: ["MEAL", "WATER", "EXERCISE", "SLEEP"],
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    details: { type: String, trim: true, maxlength: 500, default: "" },
    amountMl: { type: Number, min: 1, max: 10000, default: null },
    durationMinutes: { type: Number, min: 1, max: 1440, default: null },
    nutritionEstimate: {
      calories: { type: Number, min: 0, max: 10000, default: null },
      proteinGrams: { type: Number, min: 0, max: 1000, default: null },
      carbohydrateGrams: { type: Number, min: 0, max: 2000, default: null },
      fatGrams: { type: Number, min: 0, max: 1000, default: null },
    },
  },
  { timestamps: true }
);

nutritionEntrySchema.index({ userId: 1, entryDate: -1, entryType: 1 });

module.exports = mongoose.model("NutritionEntry", nutritionEntrySchema);
