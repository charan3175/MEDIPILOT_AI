
const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

const {
  uploadDocument,
  getMyDocuments,
  getMyDocumentById,
  reviewMyDocument,
  getHealthTimeline,
  downloadMyDocument,
  summarizeMyDocument,
} = require("../controllers/documentController");

const router = express.Router();

router.use(protect);

router.post("/upload", upload.single("file"), uploadDocument);
router.get("/my", getMyDocuments);
router.get("/timeline", getHealthTimeline);
router.patch("/:id/review", reviewMyDocument);
router.get("/:id", getMyDocumentById);
router.get("/:id/download", downloadMyDocument);
router.post("/:id/summarize", summarizeMyDocument);

module.exports = router;
