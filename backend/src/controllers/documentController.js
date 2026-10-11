
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Document = require("../models/Document");
const HealthRecord = require("../models/HealthRecord");
const Medication = require("../models/Medication");
const LabReport = require("../models/LabReport");
const Appointment = require("../models/Appointment");
const AppointmentSuggestion = require("../models/AppointmentSuggestion");
const MedicationSuggestion = require("../models/MedicationSuggestion");
const { buildHealthTimeline } = require("../services/healthTimeline");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const { summarizeWithOllama } = require("../services/ollamaRagService");
const {
  detectDocumentMime,
  extractAppointmentSuggestions,
  extractClinicalFacts,
  extractLabValues,
  extractMedicationSuggestions,
  hashUpload,
  isSupportedOcrLanguage,
  parseExplicitMedicalDate,
  sanitizeOriginalFilename,
} = require("../services/medicalDocument");

const uploadDir = path.resolve(__dirname, "../../private_uploads");

const removeTemporaryUpload = (file) => {
  if (!file?.path || !fs.existsSync(file.path)) return;
  try {
    fs.unlinkSync(file.path);
  } catch (error) {
    console.error("Temporary upload cleanup failed:", error.message);
  }
};

// Upload a PDF, JPG, or PNG.
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a PDF, JPG, or PNG file.",
      });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const detectedMime = detectDocumentMime(fileBuffer);
    if (!detectedMime || detectedMime !== req.file.mimetype) {
      removeTemporaryUpload(req.file);
      return res.status(400).json({
        success: false,
        code: "INVALID_FILE_SIGNATURE",
        message: "The file content does not match its declared PDF, JPG, or PNG type.",
      });
    }

    const uploadHash = hashUpload(fileBuffer);
    const existing = await Document.findOne({
      patientId: req.user.userId,
      uploadHash,
    }).select("_id originalName documentType processingStatus createdAt");
    if (existing) {
      removeTemporaryUpload(req.file);
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_DOCUMENT",
        message: "This exact document has already been uploaded.",
        documentId: existing._id,
      });
    }

    const allowedDocumentTypes = [
      "LAB_REPORT",
      "PRESCRIPTION",
      "DIAGNOSTIC_REPORT",
      "DISCHARGE_SUMMARY",
      "OTHER",
    ];
    const selectedDocumentType = String(req.body.documentType || "OTHER").toUpperCase();
    if (!allowedDocumentTypes.includes(selectedDocumentType)) {
      removeTemporaryUpload(req.file);
      return res.status(400).json({
        success: false,
        code: "INVALID_DOCUMENT_TYPE",
        message: "Select a supported document type.",
      });
    }
    const ocrLanguage = req.body.ocrLanguage || "eng";
    if (!isSupportedOcrLanguage(ocrLanguage)) {
      removeTemporaryUpload(req.file);
      return res.status(400).json({
        success: false,
        code: "INVALID_OCR_LANGUAGE",
        message: "Choose English, English and Hindi, English and Telugu, or English and Tamil for image OCR.",
      });
    }

    let extractedText = "";
    let extractionMessage = "No readable text could be extracted.";
    let ocrStatus = "NOT_REQUIRED";
    let pageCount = null;
    let extractionConfidence = null;
    let processingStatus = "REVIEW_REQUIRED";
    let extractionStatus = "REVIEW_REQUIRED";
    let processingErrorCode = "";

    if (detectedMime === "application/pdf") {
      try {
        const parsedPdf = await pdfParse(fileBuffer);
        extractedText = (parsedPdf.text || "").trim();
        pageCount = Number.isInteger(parsedPdf.numpages) ? parsedPdf.numpages : null;
        extractionMessage = extractedText
          ? "PDF text extracted successfully."
          : "This PDF contains no selectable text. Scanned-PDF OCR is unavailable; please upload a readable image or text-based PDF.";
        if (!extractedText) {
          ocrStatus = "UNAVAILABLE";
          processingErrorCode = "SCANNED_PDF_OCR_UNAVAILABLE";
        }
      } catch (error) {
        console.error("PDF extraction failed.");
        extractionMessage = "PDF text extraction failed.";
        ocrStatus = "FAILED";
        processingErrorCode = "PDF_TEXT_EXTRACTION_FAILED";
      }
    } else {
      try {
        const result = await Tesseract.recognize(req.file.path, ocrLanguage);
        extractedText = (result.data.text || "").trim();
        extractionConfidence = Number.isFinite(result.data.confidence)
          ? result.data.confidence
          : null;
        ocrStatus =
          Number.isFinite(extractionConfidence) && extractionConfidence < 50
            ? "FAILED"
            : "COMPLETED";
        extractionMessage = extractedText
          ? `Image OCR completed${Number.isFinite(extractionConfidence) ? ` with ${Math.round(extractionConfidence)}% confidence` : ""}. Verify every extracted field against the document.`
          : "No readable text found in the image.";
        if (!extractedText) processingErrorCode = "NO_READABLE_TEXT";
      } catch (error) {
        console.error("Image OCR failed.");
        extractionMessage = "Image OCR failed.";
        ocrStatus = "FAILED";
        processingErrorCode = "IMAGE_OCR_FAILED";
      }
    }

    const extractedData = extractLabValues(extractedText, extractionConfidence);
    const extractedClinicalData = extractClinicalFacts(extractedText, extractionConfidence);
    if (extractedText && (extractedData.length || extractedClinicalData.length)) {
      extractionStatus = "REVIEW_REQUIRED";
      processingStatus = "REVIEW_REQUIRED";
      const details = [
        extractedData.length ? `${extractedData.length} lab result candidate${extractedData.length === 1 ? "" : "s"}` : "",
        extractedClinicalData.length ? `${extractedClinicalData.length} diagnosis/date candidate${extractedClinicalData.length === 1 ? "" : "s"}` : "",
      ].filter(Boolean).join(" and ");
      extractionMessage += ` Found ${details}; review against the source before relying on them.`;
    } else if (extractedText) {
      processingErrorCode ||= "NO_STRUCTURED_RESULTS";
      extractionMessage += " No supported structured details were confidently recognized; review the extracted text manually.";
    }
    const originalName = sanitizeOriginalFilename(req.file.originalname);

    const savedDocument = await Document.create({
      patientId: req.user.userId,
      uploadedBy: req.user.userId,
      originalName,
      storedName: req.file.filename,
      mimeType: detectedMime,
      size: req.file.size,
      uploadHash,
      ocrLanguage,
      documentType: selectedDocumentType,
      processingStatus,
      ocrStatus,
      extractionStatus,
      reviewStatus: "REVIEW_REQUIRED",
      processingMessage: processingErrorCode || extractionMessage,
      pageCount,
      extractedText,
      extractedData,
      extractedClinicalData,
    });

    let appointmentSuggestions = [];
    let medicationSuggestions = [];
    let suggestionMessage = "";
    try {
      const extractedSuggestions = extractAppointmentSuggestions(extractedText);
      if (extractedSuggestions.length) {
        appointmentSuggestions = await AppointmentSuggestion.insertMany(
          extractedSuggestions.map((suggestion) => ({
            ...suggestion,
            patientId: req.user.userId,
            sourceDocumentId: savedDocument._id,
          })),
          { ordered: false }
        );
      }
    } catch (error) {
      console.error("Appointment suggestion preparation failed:", error.message);
      suggestionMessage = "The document was saved, but possible appointment details could not be prepared.";
    }

    if (selectedDocumentType === "PRESCRIPTION" && extractedText) {
      try {
        const extractedMedicines = extractMedicationSuggestions(extractedText);
        medicationSuggestions = await Promise.all(extractedMedicines.map((suggestion) => {
          const sourceKey = crypto
            .createHash("sha256")
            .update(JSON.stringify(suggestion))
            .digest("hex");
          return MedicationSuggestion.findOneAndUpdate(
            {
              patientId: req.user.userId,
              sourceDocumentId: savedDocument._id,
              sourceKey,
            },
            {
              $setOnInsert: {
                ...suggestion,
                patientId: req.user.userId,
                sourceDocumentId: savedDocument._id,
                sourceKey,
              },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }));
      } catch (error) {
        console.error("Medication suggestion preparation failed:", error.message);
        suggestionMessage = "The document was saved, but possible medicine details could not be prepared.";
      }
    }

    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully.",
      extractionMessage,
      appointmentSuggestions: appointmentSuggestions.map((suggestion) => ({
        id: suggestion._id,
        suggestionType: suggestion.suggestionType,
        reviewStatus: suggestion.reviewStatus,
      })),
      medicationSuggestions: medicationSuggestions.map((suggestion) => ({
        id: suggestion._id,
        reviewStatus: suggestion.reviewStatus,
      })),
      ...(suggestionMessage ? { suggestionMessage } : {}),
      document: {
        id: savedDocument._id,
        originalName: savedDocument.originalName,
        documentType: savedDocument.documentType,
        size: savedDocument.size,
        processingStatus: savedDocument.processingStatus,
        ocrStatus: savedDocument.ocrStatus,
        extractionStatus: savedDocument.extractionStatus,
        reviewStatus: savedDocument.reviewStatus,
        processingMessage: savedDocument.processingMessage,
        extractedText: savedDocument.extractedText,
        extractedData: savedDocument.extractedData,
        extractedClinicalData: savedDocument.extractedClinicalData,
        ocrLanguage: savedDocument.ocrLanguage,
        createdAt: savedDocument.createdAt,
      },
    });
  } catch (error) {
    console.error("Document upload failed.");

    if (error.code === 11000) {
      removeTemporaryUpload(req.file);
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_DOCUMENT",
        message: "This exact document has already been uploaded.",
      });
    }

    removeTemporaryUpload(req.file);

    return res.status(500).json({
      success: false,
      message: "Unable to save the document.",
    });
  }
};

// List the logged-in patient's documents.
const getMyDocuments = async (req, res) => {
  try {
    const documents = await Document.find({
      patientId: req.user.userId,
    })
      .select("-storedName -extractedText -uploadHash")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      count: documents.length,
      documents,
    });
  } catch (error) {
    console.error("Fetching documents failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve documents.",
    });
  }
};

const getMyDocumentById = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
    })
      .select("-storedName -uploadHash")
      .lean();

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    return res.status(200).json({
      success: true,
      document,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    console.error("Fetching document failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve the document.",
    });
  }
};

const reviewMyDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
    });
    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const results = req.body?.extractedData;
    if (
      !Array.isArray(results) ||
      results.length !== document.extractedData.length ||
      results.length > 200
    ) {
      return res.status(400).json({
        success: false,
        message: "Submit the complete extracted result list for this document.",
      });
    }
    const existingClinicalData = document.extractedClinicalData || [];
    const clinicalResults = req.body?.extractedClinicalData;
    if (
      (existingClinicalData.length && !Array.isArray(clinicalResults)) ||
      (clinicalResults !== undefined && !Array.isArray(clinicalResults)) ||
      (Array.isArray(clinicalResults) && clinicalResults.length !== existingClinicalData.length) ||
      (Array.isArray(clinicalResults) && clinicalResults.length > 200)
    ) {
      return res.status(400).json({
        success: false,
        message: "Submit the complete extracted diagnosis and date list for this document.",
      });
    }

    const allowedDocumentTypes = [
      "LAB_REPORT",
      "PRESCRIPTION",
      "DIAGNOSTIC_REPORT",
      "DISCHARGE_SUMMARY",
      "OTHER",
    ];
    const documentType = req.body?.documentType;
    if (documentType !== undefined && !allowedDocumentTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        message: "Select a supported document type.",
      });
    }

    const correctedResults = [];
    for (let index = 0; index < results.length; index += 1) {
      const input = results[index];
      const existing = document.extractedData[index];
      const testName = typeof input?.testName === "string" ? input.testName.trim() : "";
      const rawValue = input?.value;
      const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
      if (
        !testName ||
        testName.length > 120 ||
        !Number.isFinite(numericValue) ||
        String(input?.unit || "").length > 50 ||
        String(input?.referenceRange || "").length > 100
      ) {
        return res.status(400).json({
          success: false,
          message: `Extracted result ${index + 1} contains an invalid name, value, unit, or reference range.`,
        });
      }
      correctedResults.push({
        testName,
        value: numericValue,
        originalValue: String(rawValue).slice(0, 80),
        unit: String(input.unit || "").trim() || null,
        referenceRange: String(input.referenceRange || "").trim() || null,
        reportedFlag: existing.reportedFlag || "UNKNOWN",
        confidence: existing.confidence,
        verificationStatus: "CONFIRMED",
        sourceLine: existing.sourceLine,
      });
    }

    document.extractedData = correctedResults;
    const correctedClinicalData = [];
    for (let index = 0; index < (clinicalResults || []).length; index += 1) {
      const input = clinicalResults[index];
      const existing = existingClinicalData[index];
      const value = typeof input?.value === "string" ? input.value.trim() : "";
      const label = typeof input?.label === "string" ? input.label.trim() : "";
      if (
        input?.fieldType !== existing.fieldType ||
        !label ||
        label.length > 80 ||
        value.length > 300 ||
        (existing.fieldType === "DATE" && value && (
          !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          parseExplicitMedicalDate(value)?.toISOString().slice(0, 10) !== value
        ))
      ) {
        return res.status(400).json({
          success: false,
          message: `Extracted clinical detail ${index + 1} contains an invalid type, label, or value.`,
        });
      }
      correctedClinicalData.push({
        fieldType: existing.fieldType,
        label,
        value,
        sourceLine: existing.sourceLine,
        confidence: existing.confidence,
        verificationStatus: value ? "CONFIRMED" : "REJECTED",
      });
    }
    document.extractedClinicalData = correctedClinicalData;
    const reportDateCandidate = correctedClinicalData.find((fact) =>
      fact.fieldType === "DATE" &&
      /^(report date|date of report|test date|रिपोर्ट दिनांक)$/iu.test(fact.label)
    );
    if (reportDateCandidate) {
      document.reportDate = reportDateCandidate.verificationStatus === "CONFIRMED"
        ? new Date(`${reportDateCandidate.value}T12:00:00.000Z`)
        : null;
    }
    if (documentType !== undefined) document.documentType = documentType;
    document.reviewStatus = "CONFIRMED";
    document.extractionStatus = "COMPLETED";
    document.processingStatus = "COMPLETED";
    document.processingMessage = "Extracted results reviewed and confirmed by the patient.";
    await document.save();

    return res.status(200).json({
      success: true,
      message: "Extracted results saved as reviewed.",
      document: {
        id: document._id,
        documentType: document.documentType,
        reviewStatus: document.reviewStatus,
        processingStatus: document.processingStatus,
        extractedData: document.extractedData,
        extractedClinicalData: document.extractedClinicalData,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }
    console.error("Document review failed.");
    return res.status(500).json({
      success: false,
      message: "Unable to save document corrections.",
    });
  }
};

// Chronological health history for the logged-in patient.
const getHealthTimeline = async (req, res) => {
  try {
    const patientId = req.user.userId;
    const [documents, records, medications, labReports, appointments] = await Promise.all([
      Document.find({ patientId })
        .select("originalName documentType processingStatus reviewStatus extractedData extractedClinicalData aiSummary reportDate createdAt updatedAt")
        .lean(),
      HealthRecord.find({ patientId }).select("recordType title details value unit recordedAt").lean(),
      Medication.find({ patientId }).select("medicineName dosage frequency status startDate endDate updatedAt").lean(),
      LabReport.find({ patientId }).select("testName testDate reportStatus results reportFileId").lean(),
      Appointment.find({ patientId, status: { $in: ["CONFIRMED", "COMPLETED"] } })
        .select("appointmentDate doctorName hospitalName reason status confirmationStatus")
        .lean(),
    ]);

    const timeline = buildHealthTimeline({
      documents,
      records,
      medications,
      labReports,
      appointments,
    });

    return res.json({
      success: true,
      count: timeline.length,
      timeline,
    });
  } catch (error) {
    console.error("Health timeline failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve the health timeline.",
    });
  }
};

// Download only a document belonging to the logged-in patient.
const downloadMyDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const filePath = path.join(uploadDir, document.storedName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "The stored file could not be found.",
      });
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.download(filePath, document.originalName);
  } catch (error) {
    console.error("Document download failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to download the document.",
    });
  }
};

// Generate and save an AI explanation.
const summarizeMyDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      patientId: req.user.userId,
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    const language = req.body?.language;
    if (!["en", "te", "hi", "ta"].includes(language)) {
      return res.status(400).json({
        success: false,
        message: "Choose English, Telugu, Hindi, or Tamil before generating the explanation.",
      });
    }

    if (document.reviewStatus !== "CONFIRMED") {
      return res.status(409).json({
        success: false,
        code: "DOCUMENT_REVIEW_REQUIRED",
        message: "Review and confirm the extracted information before generating an explanation.",
      });
    }

    if (!document.extractedText?.trim()) {
      return res.status(400).json({
        success: false,
        message: "No extracted text is available to explain.",
      });
    }

    const summary = await summarizeWithOllama({
      title: document.originalName,
      documentType: document.documentType,
      extractedText: document.extractedText,
      extractedData: document.extractedData,
      extractedClinicalData: document.extractedClinicalData,
      language,
    });

    document.aiSummary = summary;
    document.aiSummaryLanguage = language;
    await document.save();

    return res.json({
      success: true,
      message: "Report explanation generated successfully.",
      documentId: document._id,
      aiSummary: summary,
      language,
    });
  } catch (error) {
    console.error("AI summary failed:", error.message);

    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to generate the report explanation.",
    });
  }
};

module.exports = {
  uploadDocument,
  getMyDocuments,
  getMyDocumentById,
  reviewMyDocument,
  getHealthTimeline,
  downloadMyDocument,
  summarizeMyDocument,
};
