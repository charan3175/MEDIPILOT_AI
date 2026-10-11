const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;

function passwordResetMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user;
  const frontendUrl = process.env.FRONTEND_URL?.split(",")[0]?.trim();

  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !user ||
    !pass ||
    !from ||
    !frontendUrl
  ) {
    const error = new Error(
      "Password reset email is not configured. Contact the administrator."
    );
    error.status = 503;
    throw error;
  }

  let resetUrl;
  try {
    resetUrl = new URL("/", frontendUrl);
  } catch {
    const error = new Error(
      "Password reset email is not configured. Contact the administrator."
    );
    error.status = 503;
    throw error;
  }

  if (!["http:", "https:"].includes(resetUrl.protocol)) {
    const error = new Error(
      "Password reset email is not configured. Contact the administrator."
    );
    error.status = 503;
    throw error;
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: { user, pass },
    }),
    resetUrl,
    from,
  };
}

const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "PATIENT",
      phone,
    });

    return res.status(201).json({
      success: true,
      message: "Patient registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from environment configuration");
      return res.status(500).json({
        success: false,
        message: "Authentication is not configured",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

const requestPasswordReset = async (req, res) => {
  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    const { transporter, resetUrl, from } = passwordResetMailer();
    const user = await User.findOne({ email }).select(
      "+resetPasswordRequestedAt"
    );
    const response = {
      success: true,
      message:
        "If an account exists with this email, a password reset link will be sent.",
    };

    if (!user) {
      return res.status(200).json(response);
    }

    const now = new Date();
    if (
      user.resetPasswordRequestedAt &&
      now - user.resetPasswordRequestedAt < PASSWORD_RESET_COOLDOWN_MS
    ) {
      return res.status(200).json(response);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = new Date(
      now.getTime() + PASSWORD_RESET_TTL_MS
    );
    user.resetPasswordRequestedAt = now;
    await user.save();
    resetUrl.searchParams.set("resetToken", token);

    try {
      await transporter.sendMail({
        from,
        to: user.email,
        subject: "Reset your MEDIPILOT AI password",
        text: `We received a request to reset your MEDIPILOT AI password.\n\nOpen this link within 30 minutes to choose a new password:\n${resetUrl.toString()}\n\nIf you did not request this change, you can ignore this email.`,
      });
    } catch (error) {
      await User.findOneAndUpdate(
        { _id: user._id, resetPasswordTokenHash: tokenHash },
        {
          $set: {
            resetPasswordTokenHash: null,
            resetPasswordExpiresAt: null,
            resetPasswordRequestedAt: null,
          },
        }
      );
      throw error;
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Password reset request failed:", error.message);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status
        ? error.message
        : "Unable to send a password reset email. Please try again later.",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        success: false,
        message:
          "This password reset link is invalid or expired. Request a new one.",
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters.",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpiresAt: { $gt: new Date() },
    }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "This password reset link is invalid or expired. Request a new one.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          password: hashedPassword,
          resetPasswordTokenHash: null,
          resetPasswordExpiresAt: null,
          resetPasswordRequestedAt: null,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(400).json({
        success: false,
        message:
          "This password reset link is invalid or expired. Request a new one.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password updated. You can now sign in.",
    });
  } catch (error) {
    console.error("Password reset failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to reset the password. Please try again.",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
};
