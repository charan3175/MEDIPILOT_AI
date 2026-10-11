const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  getMyABHAProfile,
  saveMyABHAProfile,
  updateABHAConsent,
} = require("../controllers/abhaController");

// All ABHA routes require authentication
router.use(protect);

// Get the logged-in patient's ABHA profile
router.get("/my", getMyABHAProfile);

// Create or update the logged-in patient's ABHA profile
router.put("/my", saveMyABHAProfile);

// Update record-sharing consent settings
router.patch("/consent", updateABHAConsent);

module.exports = router;
