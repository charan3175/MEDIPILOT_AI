const express = require("express");
const { protect } = require("../middleware/authMiddleware");

const {
  getAvailableDoctors,
  getDoctorProfile,
  getMyDoctorProfile,
  upsertMyDoctorProfile,
} = require("../controllers/doctorController");

const router = express.Router();

router.use(protect);

router.get("/my-profile", getMyDoctorProfile);
router.put("/my-profile", upsertMyDoctorProfile);

router.get("/", getAvailableDoctors);
router.get("/:doctorId", getDoctorProfile);

module.exports = router;