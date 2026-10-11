const express = require("express");
const { protect } = require("../middleware/authMiddleware");

const {
  createMedication,
  getMyMedicationById,
  getMyMedications,
  getMyMedicationSuggestions,
  confirmMedicationSuggestion,
  ignoreMedicationSuggestion,
  updateMedication,
  deleteMedication,
} = require("../controllers/medicationController");

const router = express.Router();

router.use(protect);

router.post("/", createMedication);
router.get("/my", getMyMedications);
router.get("/suggestions/my", getMyMedicationSuggestions);
router.post("/suggestions/:id/confirm", confirmMedicationSuggestion);
router.patch("/suggestions/:id/ignore", ignoreMedicationSuggestion);
router.get("/:id", getMyMedicationById);
router.patch("/:id", updateMedication);
router.delete("/:id", deleteMedication);

module.exports = router;