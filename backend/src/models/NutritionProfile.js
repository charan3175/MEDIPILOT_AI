const mongoose = require("mongoose");

const nutritionProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    dietaryPreference: { type: String, trim: true, maxlength: 100, default: "" },
    allergies: { type: [String], default: [] },
    foodAllergiesReviewed: { type: Boolean, default: false },
    restrictions: { type: [String], default: [] },
    healthGoals: { type: [String], default: [] },
    waterGoalMl: { type: Number, min: 1, max: 10000, default: null },
    exerciseGoalMinutes: { type: Number, min: 1, max: 1440, default: null },
    sleepGoalHours: { type: Number, min: 0.25, max: 24, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NutritionProfile", nutritionProfileSchema);
