const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getMyNutrition,
  saveMyNutritionProfile,
  createNutritionEntry,
  updateNutritionEntry,
  deleteNutritionEntry,
  generateDietPlan,
} = require("../controllers/nutritionController");

const router = express.Router();

router.use(protect);
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.get("/my", getMyNutrition);
router.put("/preferences", saveMyNutritionProfile);
router.post("/entries", createNutritionEntry);
router.patch("/entries/:id", updateNutritionEntry);
router.delete("/entries/:id", deleteNutritionEntry);
router.post("/diet-plan", generateDietPlan);

module.exports = router;
