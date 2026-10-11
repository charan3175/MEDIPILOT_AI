const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  createHealthRecord,
  getMyHealthRecords,
  deleteHealthRecord,
} = require("../controllers/healthRecordController");

const router = express.Router();

router.use(protect);

router.post("/", createHealthRecord);

router.get("/my", getMyHealthRecords);

router.delete("/:id", deleteHealthRecord);

module.exports = router;