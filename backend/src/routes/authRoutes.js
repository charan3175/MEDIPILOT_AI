
const express = require("express");

const {
  registerUser,
  loginUser,
  loginWithGoogle,
  requestPasswordReset,
  resetPassword,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google", loginWithGoogle);
router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

module.exports = router;
