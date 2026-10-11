function mergeDocumentLabValues(document, linkedReports) {
  const seen = new Set();
  const values = [
    ...(document.extractedData || []),
    ...linkedReports.flatMap((report) =>
      (report.results || []).map((result) => ({
        ...result,
        testName: result.testName || result.parameter || report.testName || "Reported value",
        originalValue: result.originalValue || String(result.value ?? ""),
        verificationStatus: result.verificationStatus || "UNKNOWN",
      }))
    ),
  ];

  return values.filter((value) => {
    const key = [
      String(value.testName || value.parameter || "").trim().toLowerCase(),
      String(value.originalValue ?? value.value ?? "").trim(),
      String(value.unit || "").trim().toLowerCase(),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildHealthTimeline({ documents = [], records = [], medications = [], labReports = [], appointments = [] }) {
  const documentIds = new Set(documents.map((document) => String(document._id)));
  const reportsByDocument = new Map();
  const standaloneReports = [];

  for (const report of labReports) {
    const documentId = report.reportFileId ? String(report.reportFileId) : "";
    if (!documentId || !documentIds.has(documentId)) {
      standaloneReports.push(report);
      continue;
    }
    const linkedReports = reportsByDocument.get(documentId) || [];
    linkedReports.push(report);
    reportsByDocument.set(documentId, linkedReports);
  }

  return [
    ...documents.map((doc) => ({
      id: `document:${doc._id}`,
      type: "DOCUMENT",
      sourceId: String(doc._id),
      title: doc.originalName,
      documentType: doc.documentType,
      date: doc.reportDate || doc.createdAt,
      dateSource: doc.reportDate ? "clinical" : "upload",
      processingStatus: doc.processingStatus,
      reviewStatus: doc.reviewStatus,
      details: (doc.extractedClinicalData || [])
        .filter((fact) => fact.fieldType === "DIAGNOSIS" && fact.verificationStatus === "CONFIRMED")
        .map((fact) => `Patient-reviewed report text - ${fact.label}: ${fact.value}`)
        .join(" · "),
      labValues: mergeDocumentLabValues(doc, reportsByDocument.get(String(doc._id)) || []),
    })),
    ...records.map((record) => ({
      id: `record:${record._id}`,
      type: record.recordType,
      sourceId: String(record._id),
      title: record.title,
      details: record.details,
      date: record.recordedAt,
      value: record.value,
      unit: record.unit,
    })),
    ...medications.map((medication) => ({
      id: `medication:${medication._id}`,
      type: "MEDICATION",
      sourceId: String(medication._id),
      title: medication.medicineName,
      details: [medication.dosage, medication.frequency, medication.status].filter(Boolean).join(" · "),
      date: medication.startDate || medication.updatedAt,
      endDate: medication.endDate,
    })),
    ...standaloneReports.map((report) => ({
      id: `lab-report:${report._id}`,
      type: "LAB_REPORT",
      sourceId: String(report._id),
      documentId: report.reportFileId ? String(report.reportFileId) : null,
      title: report.testName,
      details: report.reportStatus,
      date: report.testDate,
      labValues: report.results || [],
    })),
    ...appointments.map((appointment) => ({
      id: `appointment:${appointment._id}`,
      type: "APPOINTMENT",
      sourceId: String(appointment._id),
      title: appointment.doctorName
        ? `Appointment with ${appointment.doctorName}`
        : appointment.reason || "Appointment",
      details: [
        appointment.status,
        appointment.hospitalName,
        appointment.confirmationStatus === "USER_MANAGED" ? "user-managed" : "",
      ].filter(Boolean).join(" · "),
      date: appointment.appointmentDate,
    })),
  ].sort((left, right) => new Date(right.date) - new Date(left.date));
}

module.exports = { buildHealthTimeline };
