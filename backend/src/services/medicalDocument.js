const crypto = require("crypto");
const path = require("path");

const MIME_SIGNATURES = [
  {
    mimeType: "application/pdf",
    matches: (buffer) => buffer.subarray(0, 5).toString("ascii") === "%PDF-",
  },
  {
    mimeType: "image/png",
    matches: (buffer) =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    mimeType: "image/jpeg",
    matches: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
];
const SUPPORTED_OCR_LANGUAGES = new Set(["eng", "eng+hin", "eng+tel", "eng+tam"]);

function isSupportedOcrLanguage(language) {
  return SUPPORTED_OCR_LANGUAGES.has(language);
}

function detectDocumentMime(buffer) {
  return MIME_SIGNATURES.find(({ matches }) => matches(buffer))?.mimeType || null;
}

function sanitizeOriginalFilename(filename) {
  const baseName = path.basename(String(filename || "").replace(/\\/g, "/"));
  const safeName = baseName
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .trim()
    .slice(0, 180);
  return safeName || "medical-document";
}

function hashUpload(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function extractLabValues(text, extractionConfidence = null) {
  const results = [];
  const lines = String(text || "").split(/\r?\n/);

  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;

    const match = cleaned.match(
      /^([A-Za-z][A-Za-z0-9 ()/%_-]{1,55}?)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*([A-Za-zµμ/%]+(?:\/[A-Za-zµμ]+)?)?(?:\s*\(?\s*(?:Reference(?:\s+Range)?\s*[:=]?\s*)?(\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?)\s*\)?)?(?:\s+(LOW|NORMAL|HIGH|CRITICAL))?$/i
    );
    if (!match) continue;

    const confidence = Number.isFinite(extractionConfidence)
      ? Math.max(0, Math.min(1, extractionConfidence / 100))
      : null;
    results.push({
      testName: match[1].trim(),
      value: Number(match[2]),
      originalValue: match[2],
      unit: match[3] || null,
      referenceRange: match[4] || null,
      reportedFlag: match[5]?.toUpperCase() || "UNKNOWN",
      confidence,
      verificationStatus: confidence !== null && confidence < 0.75 ? "REVIEW_REQUIRED" : "UNVERIFIED",
      sourceLine: cleaned,
    });
  }

  return results;
}

function parseExplicitMedicalDate(value) {
  const source = String(value || "").trim();
  let year;
  let month;
  let day;
  let match = source.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (match) {
    [, year, month, day] = match;
  } else {
    match = source.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
    if (match) {
      [, day, month, year] = match;
    } else {
      match = source.match(/\b(\d{1,2})-(\d{1,2})-(20\d{2})\b/);
      if (match) [, day, month, year] = match;
    }
  }
  if (!year) return null;
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay, 12));
  if (
    date.getUTCFullYear() !== numericYear ||
    date.getUTCMonth() !== numericMonth - 1 ||
    date.getUTCDate() !== numericDay
  ) return null;
  return date;
}

function extractAppointmentSuggestions(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const doctorLine = lines.find((line) => /^(?:attending\s+)?(?:doctor|physician|consultant)\s*[:=-]/i.test(line));
  const doctorMatch = doctorLine?.match(/^(?:attending\s+)?(?:doctor|physician|consultant)\s*[:=-]\s*(.{1,150})$/i);
  const doctorName = doctorMatch?.[1]?.trim().replace(/^dr\.?\s*/i, "").trim() || "";
  const hospitalLine = lines.find((line) => /^(?:hospital|clinic|healthcare provider)\s*[:=-]/i.test(line));
  const hospitalMatch = hospitalLine?.match(/^(?:hospital|clinic|healthcare provider)\s*[:=-]\s*(.{1,180})$/i);
  const hospitalName = hospitalMatch?.[1]?.trim() || "";

  const suggestions = [];
  const seen = new Set();
  for (const line of lines) {
    const consultationMatch = line.match(/^(?:consultation|visit|appointment)\s+date\s*[:=-]\s*(.+)$/i);
    const followUpMatch = line.match(/^(?:next\s+)?follow[\s-]?up\s+date\s*[:=-]\s*(.+)$/i);
    const match = consultationMatch || followUpMatch;
    if (!match) continue;
    const date = parseExplicitMedicalDate(match[1]);
    if (!date) continue;
    const key = `${consultationMatch ? "CONSULTATION" : "FOLLOW_UP"}:${date.toISOString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      suggestionType: consultationMatch ? "CONSULTATION" : "FOLLOW_UP",
      doctorName,
      hospitalName,
      appointmentDate: date,
      followUpDate: followUpMatch ? date : null,
      sourceEvidence: [line, doctorLine, hospitalLine].filter(Boolean),
    });
  }
  return suggestions;
}

function extractClinicalFacts(text, extractionConfidence = null) {
  const facts = [];
  const confidence = Number.isFinite(extractionConfidence)
    ? Math.max(0, Math.min(1, extractionConfidence / 100))
    : null;
  const lines = String(text || "").split(/\r?\n/);
  const labels = [
    {
      type: "DIAGNOSIS",
      pattern: /^(primary\s+diagnosis|discharge\s+diagnosis|final\s+diagnosis|diagnosis|निदान|प्राथमिक\s+निदान|अंतिम\s+निदान)\s*[:=-]\s*(.{1,300})$/iu,
    },
    {
      type: "DATE",
      pattern: /^(report\s+date|date\s+of\s+report|admission\s+date|discharge\s+date|procedure\s+date|test\s+date|दिनांक|रिपोर्ट\s+दिनांक|प्रवेश\s+दिनांक|छुट्टी\s+दिनांक)\s*[:=-]\s*(.{1,40})$/iu,
    },
  ];
  const seen = new Set();
  for (const sourceLine of lines) {
    const line = sourceLine.replace(/\s+/g, " ").trim();
    if (!line) continue;
    for (const { type, pattern } of labels) {
      const match = line.match(pattern);
      if (!match) continue;
      const label = match[1].trim();
      const rawValue = match[2].trim();
      const date = type === "DATE" ? parseExplicitMedicalDate(rawValue) : null;
      if (type === "DATE" && !date) continue;
      const value = date ? date.toISOString().slice(0, 10) : rawValue;
      const key = `${type}:${label.toLowerCase()}:${value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      facts.push({
        fieldType: type,
        label,
        value,
        sourceLine: line,
        confidence,
        verificationStatus: confidence !== null && confidence < 0.75 ? "REVIEW_REQUIRED" : "UNVERIFIED",
      });
      break;
    }
  }
  return facts;
}

function extractMedicationSuggestions(text) {
  const fieldNames = {
    strength: "strength",
    dose: "dosage",
    dosage: "dosage",
    form: "dosageForm",
    "dosage form": "dosageForm",
    route: "route",
    frequency: "frequency",
    duration: "duration",
    "food instructions": "foodInstructions",
    "start date": "startDate",
    "end date": "endDate",
    doctor: "prescribedBy",
    "prescribed by": "prescribedBy",
    "prescription date": "prescriptionDate",
    instructions: "instructions",
  };
  const suggestions = [];
  let current = null;

  for (const sourceLine of String(text || "").split(/\r?\n/)) {
    const line = sourceLine.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const medicineMatch = line.match(/^(?:medicine|medication|drug)\s*[:=-]\s*(.{1,200})$/i);
    if (medicineMatch) {
      const medicineName = medicineMatch[1].trim();
      if (!medicineName) {
        current = null;
        continue;
      }
      current = {
        medicineName,
        strength: "",
        dosage: "",
        dosageForm: "",
        route: "",
        frequency: "",
        duration: "",
        foodInstructions: "",
        startDate: null,
        endDate: null,
        prescribedBy: "",
        prescriptionDate: null,
        instructions: "",
        sourceEvidence: [line],
      };
      suggestions.push(current);
      continue;
    }

    if (!current) continue;
    const fieldMatch = line.match(/^([A-Za-z][A-Za-z ]{0,30})\s*[:=-]\s*(.{1,500})$/);
    const field = fieldMatch?.[1]?.trim().toLowerCase();
    const target = fieldNames[field];
    if (!target) continue;
    const value = fieldMatch[2].trim();
    if (target === "startDate" || target === "endDate" || target === "prescriptionDate") {
      const parsedDate = parseExplicitMedicalDate(value);
      if (!parsedDate) continue;
      current[target] = parsedDate;
    } else {
      current[target] = value;
    }
    current.sourceEvidence.push(line);
  }

  const seen = new Set();
  return suggestions.filter((suggestion) => {
    const key = JSON.stringify(suggestion);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = {
  detectDocumentMime,
  extractAppointmentSuggestions,
  extractClinicalFacts,
  extractLabValues,
  extractMedicationSuggestions,
  hashUpload,
  isSupportedOcrLanguage,
  parseExplicitMedicalDate,
  sanitizeOriginalFilename,
};
