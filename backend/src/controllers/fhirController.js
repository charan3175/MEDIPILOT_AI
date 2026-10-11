const Document = require("../models/Document");
const HealthRecord = require("../models/HealthRecord");
const Medication = require("../models/Medication");
const User = require("../models/User");
const { buildFhirBundle } = require("../services/fhirService");

const exportMyFhirRecords = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const [user, healthRecords, documents, medications] = await Promise.all([
      User.findById(patientId).select("name email").lean(),
      HealthRecord.find({ patientId }).sort({ recordedAt: -1 }).lean(),
      Document.find({ patientId })
        .select("originalName documentType processingStatus reviewStatus extractedData extractedClinicalData reportDate mimeType createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Medication.find({ patientId }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: "Patient account not found." });
    }

    const result = buildFhirBundle({ user, healthRecords, documents, medications });
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      fhirVersion: "4.0.1",
      exportType: "FHIR R4-style collection bundle",
      profileValidation: "Basic structural checks only; this is not official FHIR R4 profile validation.",
      ...result,
    });
  } catch (error) {
    console.error("FHIR export failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to prepare the FHIR-style export.",
    });
  }
};

module.exports = { exportMyFhirRecords };
