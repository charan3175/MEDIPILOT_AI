export const DEMO_MODE_KEY = "medipilot_demo_data";
export const DEMO_PATIENT_NAME = "MediPilot Demo Patient";

const reportDate = "2026-10-08T08:30:00.000Z";
const uploadedDate = "2026-10-08T09:00:00.000Z";
const demoAppointmentDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const demoReminderDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

function demoResult(testName, value, unit, referenceRange, reportedFlag, sourceLine) {
  return {
    testName,
    value,
    originalValue: String(value),
    unit,
    referenceRange,
    reportedFlag,
    confidence: 1,
    verificationStatus: "CONFIRMED",
    sourceLine,
    demoSample: true,
  };
}

const demoDocuments = [
  {
    _id: "demo-report-thyroid-001",
    originalName: "[DEMO SAMPLE] Thyroid panel.pdf",
    documentType: "LAB_REPORT",
    mimeType: "application/pdf",
    processingStatus: "COMPLETED",
    reviewStatus: "CONFIRMED",
    reportDate,
    createdAt: uploadedDate,
    extractedText: [
      "MEDIPILOT AI — FICTIONAL DEMONSTRATION REPORT",
      "This is synthetic sample data. It is not a real person's medical record.",
      "Collection date: 2026-10-08",
      "TSH: 6.2 mIU/L (sample reference interval: 0.40–4.00 mIU/L) — HIGH",
      "Free T4: 1.1 ng/dL (sample reference interval: 0.80–1.80 ng/dL) — NORMAL",
      "Demonstration note: A result outside a sample interval is not a diagnosis.",
    ].join("\n"),
    extractedData: [
      demoResult(
        "TSH",
        6.2,
        "mIU/L",
        "0.40-4.00 mIU/L",
        "HIGH",
        "TSH: 6.2 mIU/L (sample reference interval: 0.40–4.00 mIU/L) — HIGH"
      ),
      demoResult(
        "Free T4",
        1.1,
        "ng/dL",
        "0.80-1.80 ng/dL",
        "NORMAL",
        "Free T4: 1.1 ng/dL (sample reference interval: 0.80–1.80 ng/dL) — NORMAL"
      ),
    ],
    extractedClinicalData: [],
    demoSample: true,
  },
  {
    _id: "demo-report-metabolic-002",
    originalName: "[DEMO SAMPLE] Basic metabolic panel.pdf",
    documentType: "LAB_REPORT",
    mimeType: "application/pdf",
    processingStatus: "COMPLETED",
    reviewStatus: "CONFIRMED",
    reportDate: "2026-10-06T08:15:00.000Z",
    createdAt: "2026-10-06T08:45:00.000Z",
    extractedText: [
      "MEDIPILOT AI — FICTIONAL DEMONSTRATION REPORT",
      "This is synthetic sample data. It is not a real person's medical record.",
      "Collection date: 2026-10-06",
      "Glucose, fasting: 92 mg/dL (sample reference interval: 70–99 mg/dL) — NORMAL",
      "Demonstration note: Sample intervals are illustrative and are not individualized.",
    ].join("\n"),
    extractedData: [
      demoResult(
        "Glucose, fasting",
        92,
        "mg/dL",
        "70-99 mg/dL",
        "NORMAL",
        "Glucose, fasting: 92 mg/dL (sample reference interval: 70–99 mg/dL) — NORMAL"
      ),
    ],
    extractedClinicalData: [],
    demoSample: true,
  },
];

const demoNutritionDate = (() => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
})();

export function createDemoHealthData() {
  const documents = demoDocuments.map((document) => ({
    ...document,
    extractedData: document.extractedData.map((item) => ({ ...item })),
    extractedClinicalData: [],
  }));
  const timeline = documents.map((document) => ({
    id: `${document._id}:timeline`,
    type: "DOCUMENT",
    title: document.originalName,
    documentType: document.documentType,
    date: document.reportDate,
    dateSource: "clinical",
    documentId: document._id,
    sourceId: document._id,
    details: "Synthetic demonstration report",
    demoSample: true,
  }));

  return {
    profile: {
      name: DEMO_PATIENT_NAME,
      role: "PATIENT",
      preferredLanguage: "en",
      demoSample: true,
    },
    documents,
    timeline,
    records: [],
    appointments: [{
      _id: "demo-appointment-sample",
      doctorName: "Example clinician (fictional)",
      hospitalName: "MediPilot Demo Clinic",
      appointmentDate: demoAppointmentDate,
      timeProvided: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      appointmentType: "IN_PERSON",
      status: "CONFIRMED",
      reason: "Sample follow-up visit; no clinical recommendation is implied.",
      notes: "Synthetic calendar entry for interface demonstration only.",
      demoSample: true,
    }],
    appointmentSuggestions: [],
    medications: [],
    medicationSuggestions: [],
    labReports: [],
    reminders: [{
      _id: "demo-reminder-sample",
      title: "Example hydration check-in",
      message: "Sample reminder entry; no notification will be delivered.",
      reminderType: "GENERAL",
      scheduledAt: demoReminderDate,
      isActive: true,
      isPaused: false,
      isCompleted: false,
      demoSample: true,
    }],
    conversations: [{
      _id: "demo-conversation-report-review",
      title: "Demo report review",
      messages: [
        {
          _id: "demo-message-question",
          sender: "USER",
          content: "What does the sample thyroid report show?",
          createdAt: reportDate,
        },
        {
          _id: "demo-message-answer",
          sender: "ASSISTANT",
          content: "This fictional sample lists TSH at 6.2 mIU/L, above the sample interval printed on that report, and Free T4 at 1.1 ng/dL, within its sample interval. These demonstration values are not a diagnosis and do not describe a real person.",
          createdAt: reportDate,
          sources: [{
            id: "demo-report-thyroid-001",
            kind: "PATIENT_HEALTH_RECORD",
            title: "[DEMO SAMPLE] Thyroid panel.pdf",
            type: "LAB_REPORT",
            excerpt: "TSH 6.2 mIU/L; sample interval 0.40-4.00 mIU/L. Free T4 1.1 ng/dL; sample interval 0.80-1.80 ng/dL.",
            date: reportDate,
          }],
        },
      ],
      demoSample: true,
    }],
    abha: null,
    aiStatus: null,
    nutrition: {
      profile: {
        dietaryPreference: "",
        allergies: [],
        restrictions: [],
        healthGoals: [],
        waterGoalMl: 2000,
        exerciseGoalMinutes: 30,
        sleepGoalHours: 8,
        foodAllergiesReviewed: true,
        demoSample: true,
      },
      healthRecordAllergies: [],
      entries: [
        {
          _id: "demo-nutrition-water-001",
          entryDate: demoNutritionDate,
          entryType: "WATER",
          title: "Water",
          amountMl: 500,
          demoSample: true,
        },
        {
          _id: "demo-nutrition-walk-002",
          entryDate: demoNutritionDate,
          entryType: "EXERCISE",
          title: "Walk",
          details: "Example activity entry",
          durationMinutes: 20,
          demoSample: true,
        },
        {
          _id: "demo-nutrition-sleep-003",
          entryDate: demoNutritionDate,
          entryType: "SLEEP",
          title: "Sleep",
          durationMinutes: 450,
          demoSample: true,
        },
      ],
    },
  };
}

export const demoReportSummary =
  "Demo report only: the sample TSH value is above the illustrative reference interval shown on the sample report, while Free T4 and fasting glucose are within their respective sample intervals. Reference intervals vary by laboratory and person. This demonstration does not establish a diagnosis or provide treatment advice; consult a qualified clinician about real results.";
