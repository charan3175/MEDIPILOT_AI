const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  listMyShares,
  createShare,
  revokeShare,
  accessSharedRecords,
  downloadSharedDocument,
  getSharedAccessStatus,
  generateSharedHealthBrief,
} = require("../controllers/shareController");

const router = express.Router();

router.get("/public/:token", accessSharedRecords);
router.get("/public/:token/status", getSharedAccessStatus);
router.get("/public/:token/documents/:documentId", downloadSharedDocument);
router.post("/public/:token/brief", generateSharedHealthBrief);
router.get("/", protect, listMyShares);
router.post("/", protect, createShare);
router.delete("/:id", protect, revokeShare);

module.exports = router;
