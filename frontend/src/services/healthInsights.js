const bodySystems = [
  { pattern: /troponin|ck.?mb|cardiac|\bheart\b|coronary|myocard|ecg|e\.c\.g\./i, regionId: "heart", label: "Heart" },
  { pattern: /creatinine|urea|egfr|kidney|renal|nephro/i, regionId: "kidneys", label: "Kidneys" },
  { pattern: /\balt\b|\bast\b|sgpt|sgot|bilirubin|liver|hepatic|alkaline phosphatase|\balp\b/i, regionId: "liver", label: "Liver" },
  { pattern: /tsh|thyroid|\bt3\b|\bt4\b/i, regionId: "thyroid", label: "Thyroid" },
  { pattern: /lung|pulmonary|respiratory|asthma|bronch|pneumon|copd/i, regionId: "lungs", label: "Lungs" },
  { pattern: /stomach|gastric|gastritis/i, regionId: "stomach", label: "Stomach" },
  { pattern: /brain|cerebral|neurolog|cerebrovascular/i, regionId: "brain", label: "Brain" },
];
const supportedAnatomyRegions = new Set(bodySystems.map(({ regionId }) => regionId));
const negativeDiagnosisPattern = /\b(no|not|without|negative for|ruled out|absent|denies)\b/i;

function rangeState(value, referenceRange, flag) {
  const normalizedFlag = String(flag || "").toUpperCase();
  if (normalizedFlag === "HIGH") return "above";
  if (normalizedFlag === "LOW") return "below";
  if (normalizedFlag === "NORMAL") return "within";

  const numericValue = Number.parseFloat(value);
  const range = String(referenceRange || "").match(/(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/);
  if (!Number.isFinite(numericValue) || !range) return "unknown";
  const lower = Number(range[1]);
  const upper = Number(range[2]);
  if (numericValue < lower) return "below";
  if (numericValue > upper) return "above";
  return "within";
}

function systemFor(testName) {
  return bodySystems.find((system) => system.pattern.test(testName)) || {
    regionId: null,
    label: "Not mapped to a specific system",
  };
}

export function buildBodyFindings(documents = [], labReports = [], healthRecords = []) {
  const results = [];

  for (const document of documents) {
    for (const item of document.extractedData || []) {
      const system = systemFor(item.testName || "");
      results.push({
        id: `${document._id}:${item.testName}:${results.length}`,
        demoSample: Boolean(document.demoSample),
        sourceId: String(document._id),
        documentId: String(document._id),
        sourceTitle: document.originalName || "Uploaded report",
        documentName: document.originalName || "Uploaded report",
        sourceType: "Uploaded report",
        title: item.testName || "Reported value",
        testName: item.testName || "Reported value",
        description: [item.originalValue || item.value, item.unit].filter(Boolean).join(" "),
        value: item.value,
        unit: item.unit || "",
        referenceRange: item.referenceRange || "",
        sourceLine: item.sourceLine || "",
        sourceExcerpt: item.sourceLine || "",
        regionId: system.regionId,
        bodySystem: system.label,
        status:
          item.verificationStatus !== "CONFIRMED" ||
          document.reviewStatus !== "CONFIRMED"
            ? "needs_review"
            : item.reportedFlag === "CRITICAL"
              ? "critical"
              : rangeState(item.value, item.referenceRange, item.reportedFlag),
        verificationStatus: item.verificationStatus || "UNVERIFIED",
        mappingStatus:
          item.verificationStatus === "CONFIRMED" &&
          document.reviewStatus === "CONFIRMED" &&
          system.regionId
            ? "verified"
            : "needs_review",
        date: document.reportDate || document.createdAt,
        reportDate: document.reportDate || document.createdAt,
        uploadDate: document.createdAt,
      });
    }

    for (const item of document.extractedClinicalData || []) {
      if (item.fieldType !== "DIAGNOSIS") continue;
      const system = systemFor(`${item.label || ""} ${item.value || ""}`);
      const reviewed =
        item.verificationStatus === "CONFIRMED" &&
        document.reviewStatus === "CONFIRMED";
      const hasNegativeWording = negativeDiagnosisPattern.test(item.value || "");
      results.push({
        id: `${document._id}:diagnosis:${results.length}`,
        demoSample: Boolean(document.demoSample),
        sourceId: String(document._id),
        documentId: String(document._id),
        sourceTitle: document.originalName || "Uploaded report",
        documentName: document.originalName || "Uploaded report",
        sourceType: "Uploaded report",
        findingType: "DIAGNOSIS_MENTION",
        title: item.label || "Diagnosis text in report",
        testName: item.value || "Diagnosis text in report",
        description: item.value || "Diagnosis text in report",
        sourceLine: item.sourceLine || "",
        sourceExcerpt: item.sourceLine || item.value || "",
        regionId: system.regionId,
        bodySystem: system.label,
        status: reviewed && !hasNegativeWording ? "mentioned" : "needs_review",
        verificationStatus: item.verificationStatus || "UNVERIFIED",
        mappingStatus:
          reviewed && !hasNegativeWording && system.regionId
            ? "verified"
            : "needs_review",
        date: document.reportDate || document.createdAt,
        reportDate: document.reportDate || document.createdAt,
        uploadDate: document.createdAt,
      });
    }
  }

  for (const report of labReports) {
    for (const item of report.results || []) {
      const system = systemFor(item.parameter || report.testName || "");
      results.push({
        id: `${report._id}:${item.parameter}:${results.length}`,
        sourceId: String(report._id),
        documentId: report.reportFileId ? String(report.reportFileId) : null,
        sourceTitle: report.testName || "Lab report",
        documentName: report.testName || "Lab report",
        sourceType: "Lab report",
        title: item.parameter || report.testName || "Reported value",
        testName: item.parameter || report.testName || "Reported value",
        description: [item.value, item.unit].filter(Boolean).join(" "),
        value: item.value,
        unit: item.unit || "",
        referenceRange: item.referenceRange || "",
        sourceLine: "",
        regionId: system.regionId,
        bodySystem: system.label,
        status:
          String(item.flag || "").toUpperCase() === "CRITICAL"
            ? "critical"
            : rangeState(item.value, item.referenceRange, item.flag),
        verificationStatus: "UNKNOWN",
        mappingStatus: "needs_review",
        date: report.testDate,
        reportDate: report.testDate,
      });
    }
  }

  for (const record of healthRecords) {
    if (record.recordType !== "CONDITION") continue;
    const description = [record.title, record.details].filter(Boolean).join(" — ");
    const system = systemFor(description);
    if (!system.regionId || negativeDiagnosisPattern.test(description)) continue;
    results.push({
      id: `${record._id}:condition:${results.length}`,
      sourceId: String(record._id),
      title: record.title || "Patient-entered condition",
      testName: record.title || "Patient-entered condition",
      description: record.details || record.title || "Patient-entered condition",
      sourceExcerpt: description,
      sourceType: "Patient-entered health record",
      findingType: "PATIENT_CONDITION_MENTION",
      regionId: system.regionId,
      bodySystem: system.label,
      status: "mentioned",
      verificationStatus: "PATIENT_ENTERED",
      mappingStatus: "verified",
      date: record.recordedAt,
      reportDate: record.recordedAt,
    });
  }

  return results;
}

export function getAbnormalAnatomicalFindings(findings = []) {
  return findings.filter((finding) =>
    supportedAnatomyRegions.has(finding.regionId) &&
    ["verified", "confirmed"].includes(String(finding.mappingStatus || "").toLowerCase()) &&
    (
      ["above", "below", "critical"].includes(String(finding.status || "").toLowerCase()) ||
      (["DIAGNOSIS_MENTION", "PATIENT_CONDITION_MENTION"].includes(finding.findingType) && finding.status === "mentioned")
    )
  );
}
