const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getMyHealthId,
  regenerateHealthId,
  createAccessRequest,
  getAccessRequestStatus,
  listAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  revokeAccessRequest,
} = require("../controllers/healthIdController");

const router = express.Router();

router.post("/requests", createAccessRequest);
router.get("/requests/status/:token", getAccessRequestStatus);
router.get("/my", protect, getMyHealthId);
router.post("/my/regenerate", protect, regenerateHealthId);
router.get("/requests", protect, listAccessRequests);
router.post("/requests/:id/approve", protect, approveAccessRequest);
router.post("/requests/:id/deny", protect, denyAccessRequest);
router.delete("/requests/:id", protect, revokeAccessRequest);

module.exports = router;
