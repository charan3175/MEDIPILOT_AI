
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getMyDashboard,
  updateMyLanguagePreference,
} = require("../controllers/dashboardController");

const router = express.Router();

router.get("/me", protect, getMyDashboard);
router.patch("/language", protect, updateMyLanguagePreference);

module.exports = router;
