
const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  requestLabTest,
  getMyLabTests,
  getLabQueue,
  updateLabTestStatus,
  cancelMyLabTest,
} = require("../controllers/labTestController");

const router = express.Router();

router.use(protect);

// Patient routes
router.post("/", requestLabTest);
router.get("/my", getMyLabTests);
router.patch("/:id/cancel", cancelMyLabTest);

// Laboratory staff routes
router.get("/queue", getLabQueue);
router.patch("/:id/status", updateLabTestStatus);

module.exports = router;
