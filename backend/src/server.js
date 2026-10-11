const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

process.env.MONGO_URI =
  process.env.MONGO_URI || process.env.MONGODB_URI;

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const mongoose = require("mongoose");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const documentRoutes = require("./routes/documentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const healthRecordRoutes = require("./routes/healthRecordRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const medicationRoutes = require("./routes/medicationRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const doctorAppointmentRoutes = require("./routes/doctorAppointmentRoutes");
const adminDoctorRoutes = require("./routes/adminDoctorRoutes");
const labReportRoutes = require("./routes/labReportRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const labTestRoutes = require("./routes/labTestRoutes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");
const abhaRoutes = require("./routes/abhaRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const chatbotFeedbackRoutes = require("./routes/chatbotFeedbackRoutes");
const supportTicketRoutes = require("./routes/supportTicketRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const fhirRoutes = require("./routes/fhirRoutes");
const shareRoutes = require("./routes/shareRoutes");
const healthIdRoutes = require("./routes/healthIdRoutes");
const nutritionRoutes = require("./routes/nutritionRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
  res.set("Referrer-Policy", "no-referrer");
  next();
});

app.use(
  cors({
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
      : true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "MediPilot AI API is running",
    version: "1.0.0",
  });
});

app.get("/api/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  return res.status(connected ? 200 : 503).json({
    success: connected,
    server: "running",
    database: connected ? "connected" : "disconnected",
    message: connected
      ? "API and database are ready."
      : "The API is running, but its MongoDB connection is unavailable.",
  });
});

app.use("/api", (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  return res.status(503).json({
    success: false,
    code: "DATABASE_UNAVAILABLE",
    message:
      "The server cannot connect to MongoDB right now. Check the database connection and try again.",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/fhir", fhirRoutes);
app.use("/api/shares", shareRoutes);
app.use("/api/health-id", healthIdRoutes);
app.use("/api/nutrition", nutritionRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/health-records", healthRecordRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/doctor-appointments", doctorAppointmentRoutes);
app.use("/api/admin/doctors", adminDoctorRoutes);
app.use("/api/lab-reports", labReportRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/lab-tests", labTestRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/abha", abhaRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/chatbot-feedback", chatbotFeedbackRoutes);
app.use("/api/support-tickets", supportTicketRoutes);
app.use("/api/feedback", feedbackRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  console.error("API error:", err);
  return res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected server error occurred."
        : err.message || "Internal server error",
  });
});

async function connectDatabaseWithRetry() {
  let retryDelay = 5000;

  while (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
      return;
    } catch (error) {
      console.error(
        `MongoDB connection failed${
          error.code ? ` (${error.code})` : ""
        }. Retrying in ${Math.round(retryDelay / 1000)} seconds.`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      retryDelay = Math.min(retryDelay * 2, 30000);
    }
  }
}

async function startServer() {
  if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
    console.error("Missing MONGO_URI or MONGODB_URI in backend/.env");
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    console.error("Missing JWT_SECRET in backend/.env");
    process.exit(1);
  }

  fs.mkdirSync(path.resolve(__dirname, "../private_uploads"), {
    recursive: true,
  });

  await new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log(`MediPilot AI backend running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      resolve();
    });
    server.once("error", reject);
  });

  connectDatabaseWithRetry();
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Failed to start MediPilot AI:", error.message);
    process.exit(1);
  });
}

module.exports = app;
