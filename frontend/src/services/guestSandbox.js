import { createDemoHealthData } from "./demoHealthData.js";

const GUEST_DATA_KEY = "medipilot_guest_session";

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function currentTime() {
  return new Date().toISOString();
}

function createState(user) {
  const data = createDemoHealthData();
  return {
    ...data,
    profile: { ...data.profile, name: user.name },
    shares: [],
    healthId: null,
    accessRequests: [],
    nutritionProfile: data.nutrition.profile,
    nutritionEntries: data.nutrition.entries,
  };
}

function loadState(user) {
  const saved = sessionStorage.getItem(GUEST_DATA_KEY);
  if (!saved) return createState(user);

  try {
    const state = JSON.parse(saved);
    return {
      ...createState(user),
      ...state,
      profile: { ...state.profile, name: user.name },
    };
  } catch (error) {
    throw new Error(`Unable to read this guest session's local data: ${error.message}`);
  }
}

function saveState(state) {
  try {
    sessionStorage.setItem(GUEST_DATA_KEY, JSON.stringify(state));
  } catch (error) {
    throw new Error(`Unable to save guest data in this browser: ${error.message}`);
  }
}

function parseBody(options) {
  if (!options.body) return {};
  if (options.body instanceof FormData) return options.body;
  try {
    return JSON.parse(options.body);
  } catch (error) {
    throw new Error(`Invalid local guest request body: ${error.message}`);
  }
}

function refreshTimeline(state) {
  const documentEvents = state.documents.map((document) => ({
    id: `${document._id}:timeline`,
    type: "DOCUMENT",
    title: document.originalName,
    documentType: document.documentType,
    date: document.reportDate || document.createdAt,
    dateSource: document.reportDate ? "clinical" : "upload",
    documentId: document._id,
    sourceId: document._id,
    details: document.demoSample ? "Synthetic demonstration report" : "Guest-session document; OCR is unavailable locally",
    demoSample: Boolean(document.demoSample),
  }));
  state.timeline = [...documentEvents].sort(
    (left, right) => new Date(right.date) - new Date(left.date)
  );
}

function findById(items, id, label) {
  const item = items.find((record) => record._id === id);
  if (!item) throw new Error(`${label} was not found in this guest session.`);
  return item;
}

function fhirExport(state) {
  const patientId = "guest-demo-patient";
  const entry = [{
    resource: {
      resourceType: "Patient",
      id: patientId,
      name: [{ text: state.profile.name }],
    },
  }];

  for (const document of state.documents) {
    const observations = (document.extractedData || []).map((finding, index) => {
      const resource = {
        resourceType: "Observation",
        id: `${document._id}-observation-${index}`,
        status: "final",
        code: { text: finding.testName },
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: document.reportDate || document.createdAt,
        valueQuantity: { value: finding.value, unit: finding.unit || "" },
        referenceRange: [{ text: finding.referenceRange || "Not supplied" }],
        note: [{ text: "Guest-session demonstration data; not a real patient result." }],
      };
      entry.push({ resource });
      return resource;
    });
    entry.push({
      resource: {
        resourceType: "DiagnosticReport",
        id: `${document._id}-diagnostic-report`,
        status: "final",
        code: { text: document.originalName },
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: document.reportDate || document.createdAt,
        result: observations.map((resource) => ({
          reference: `Observation/${resource.id}`,
        })),
      },
    });
  }

  return {
    fhirVersion: "FHIR R4-style guest demonstration",
    profileValidation: "Basic structure only; this local sample is not an officially validated FHIR R4 profile.",
    validation: {
      valid: true,
      errors: [],
      warnings: ["Guest-session examples are synthetic and stay in this browser."],
    },
    bundle: { resourceType: "Bundle", type: "collection", entry },
  };
}

export function clearGuestSandbox() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(GUEST_DATA_KEY);
  }
}

export async function guestRequest(endpoint, options, user) {
  if (typeof sessionStorage === "undefined") {
    throw new Error("Guest mode requires browser session storage.");
  }

  const url = new URL(endpoint, "http://localhost");
  const path = url.pathname.replace(/^\/api/, "");
  const method = options.method || "GET";
  const body = parseBody(options);
  const state = loadState(user);

  if (method === "GET") {
    if (path === "/dashboard/me") {
      return { success: true, user: state.profile, profile: state.profile };
    }
    if (path === "/documents/my") return { success: true, documents: state.documents };
    if (path === "/documents/timeline") return { success: true, timeline: state.timeline };
    if (path === "/health-records/my") return { success: true, records: state.records };
    if (path === "/appointments/my") return { success: true, appointments: state.appointments };
    if (path === "/appointments/suggestions/my") return { success: true, suggestions: state.appointmentSuggestions };
    if (path === "/medications/my") return { success: true, medications: state.medications };
    if (path === "/medications/suggestions/my") return { success: true, suggestions: state.medicationSuggestions };
    if (path === "/lab-reports/my") return { success: true, reports: state.labReports };
    if (path === "/reminders/my") return { success: true, reminders: state.reminders };
    if (path === "/conversations/my") return { success: true, conversations: state.conversations };
    if (path === "/conversations/status") {
      return {
        connected: false,
        chatModelAvailable: false,
        embeddingModelAvailable: false,
        error: "AI is not connected in a guest session.",
      };
    }
    if (path === "/abha/my") return { success: true, data: state.abha };
    if (path === "/shares") return { success: true, shares: state.shares };
    if (path === "/health-id/my") {
      return state.healthId;
    }
    if (path === "/health-id/requests") {
      return { success: true, requests: [], identityEvents: [] };
    }
    if (path === "/fhir/export") return fhirExport(state);
    if (path === "/nutrition/my") {
      return {
        success: true,
        profile: state.nutritionProfile,
        entries: state.nutritionEntries,
        healthRecordAllergies: [],
        weekStart: url.searchParams.get("date") || "",
      };
    }
    const documentMatch = path.match(/^\/documents\/([^/]+)$/);
    if (documentMatch) {
      return { success: true, document: findById(state.documents, documentMatch[1], "Document") };
    }
  }

  if (method === "POST") {
    if (path === "/documents/upload") {
      if (!(body instanceof FormData)) throw new Error("Choose a file before uploading.");
      const file = body.get("file");
      if (!file || typeof file.name !== "string") throw new Error("Choose a supported report file.");
      const document = {
        _id: createId("guest-document"),
        originalName: file.name,
        documentType: body.get("documentType") || "OTHER",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        processingStatus: "REVIEW_REQUIRED",
        reviewStatus: "REVIEW_REQUIRED",
        reportDate: null,
        createdAt: currentTime(),
        extractedText: "",
        extractedData: [],
        extractedClinicalData: [],
        processingMessage: "Local guest mode stores the report entry only; OCR is unavailable without the backend.",
        guestSession: true,
      };
      state.documents.unshift(document);
      refreshTimeline(state);
      saveState(state);
      return {
        success: true,
        document,
        message: "Report added to this guest session.",
        extractionMessage: "OCR was not run in local guest mode; no values were inferred.",
      };
    }
    if (path === "/health-records") {
      const record = {
        ...body,
        _id: createId("guest-record"),
        recordedAt: currentTime(),
        guestSession: true,
      };
      state.records.unshift(record);
      saveState(state);
      return { success: true, record };
    }
    if (path === "/appointments") {
      const appointment = {
        ...body,
        _id: createId("guest-appointment"),
        status: "CONFIRMED",
        createdAt: currentTime(),
        guestSession: true,
      };
      state.appointments.unshift(appointment);
      saveState(state);
      return { success: true, appointment };
    }
    if (path === "/medications") {
      const medication = {
        ...body,
        _id: createId("guest-medication"),
        status: body.status || "ACTIVE",
        createdAt: currentTime(),
        guestSession: true,
      };
      state.medications.unshift(medication);
      saveState(state);
      return { success: true, medication };
    }
    if (path === "/reminders") {
      const reminder = {
        ...body,
        _id: createId("guest-reminder"),
        isActive: true,
        isPaused: false,
        isCompleted: false,
        createdAt: currentTime(),
        guestSession: true,
      };
      state.reminders.unshift(reminder);
      saveState(state);
      return { success: true, reminder };
    }
    if (path === "/nutrition/entries") {
      const entry = { ...body, _id: createId("guest-nutrition"), guestSession: true };
      state.nutritionEntries.unshift(entry);
      saveState(state);
      return { success: true, entry };
    }
    if (path === "/nutrition/diet-plan") {
      throw new Error("AI diet planning needs the connected AI service. Your guest-session data has not been sent anywhere.");
    }
    if (/^\/documents\/[^/]+\/summarize$/.test(path)) {
      throw new Error("Report explanations need the connected AI service. No medical interpretation was generated in guest mode.");
    }
    if (path === "/conversations") {
      const conversation = {
        ...body,
        _id: createId("guest-conversation"),
        messages: [],
        createdAt: currentTime(),
        guestSession: true,
      };
      state.conversations.unshift(conversation);
      saveState(state);
      return { success: true, conversation };
    }
    const messageMatch = path.match(/^\/conversations\/([^/]+)\/messages$/);
    if (messageMatch) {
      const conversation = findById(state.conversations, messageMatch[1], "Conversation");
      const userMessage = {
        _id: createId("guest-message"),
        sender: "USER",
        content: String(body.content || ""),
        createdAt: currentTime(),
      };
      const assistantMessage = {
        _id: createId("guest-message"),
        sender: "ASSISTANT",
        content: "Guest mode does not connect to the AI/RAG service. I have not analyzed this question or your records. Turn guest mode off and sign in to use the connected Copilot.",
        createdAt: currentTime(),
        sources: [],
      };
      conversation.messages.push(userMessage, assistantMessage);
      saveState(state);
      return { success: true, conversation, userMessage, assistantMessage, sources: [] };
    }
    if (path === "/shares") {
      throw new Error("Secure hospital links are unavailable in guest mode. Sign in to create an authenticated, revocable share.");
    }
    if (path === "/documents") {
      throw new Error("Use the document upload form to add a report to this guest session.");
    }
  }

  if (method === "PUT" && path === "/nutrition/preferences") {
    state.nutritionProfile = { ...state.nutritionProfile, ...body };
    saveState(state);
    return { success: true, profile: state.nutritionProfile };
  }
  if (method === "PUT" && path === "/abha/my") {
    state.abha = { ...(state.abha || {}), ...body, verificationStatus: "NOT_VERIFIED", guestSession: true };
    saveState(state);
    return { success: true, profile: state.abha };
  }
  if (method === "PATCH") {
    if (path === "/dashboard/language") {
      state.profile.preferredLanguage = body.preferredLanguage;
      saveState(state);
      return { success: true, preferredLanguage: body.preferredLanguage };
    }
    if (path === "/abha/consent") {
      state.abha = { ...(state.abha || {}), consent: body, guestSession: true };
      saveState(state);
      return { success: true, profile: state.abha };
    }
    const documentReviewMatch = path.match(/^\/documents\/([^/]+)\/review$/);
    if (documentReviewMatch) {
      const document = findById(state.documents, documentReviewMatch[1], "Document");
      document.documentType = body.documentType || document.documentType;
      document.extractedData = (body.extractedData || []).map((item) => ({
        ...item,
        value: Number(item.value),
        originalValue: String(item.value),
        verificationStatus: "CONFIRMED",
      }));
      document.extractedClinicalData = body.extractedClinicalData || [];
      document.reviewStatus = "CONFIRMED";
      document.processingStatus = "COMPLETED";
      saveState(state);
      return { success: true, document: { ...document } };
    }
    const nutritionMatch = path.match(/^\/nutrition\/entries\/([^/]+)$/);
    if (nutritionMatch) {
      const entry = findById(state.nutritionEntries, nutritionMatch[1], "Nutrition entry");
      Object.assign(entry, body);
      saveState(state);
      return { success: true, entry };
    }
    const appointmentMatch = path.match(/^\/appointments\/([^/]+)(?:\/status)?$/);
    if (appointmentMatch) {
      const appointment = findById(state.appointments, appointmentMatch[1], "Appointment");
      Object.assign(appointment, body, { updatedAt: currentTime() });
      saveState(state);
      return { success: true, appointment };
    }
    const medicationMatch = path.match(/^\/medications\/([^/]+)$/);
    if (medicationMatch) {
      const medication = findById(state.medications, medicationMatch[1], "Medication");
      Object.assign(medication, body, { updatedAt: currentTime() });
      saveState(state);
      return { success: true, medication };
    }
    const reminderMatch = path.match(/^\/reminders\/([^/]+)(?:\/(dismiss|pause|resume|cancel))?$/);
    if (reminderMatch) {
      const reminder = findById(state.reminders, reminderMatch[1], "Reminder");
      const action = reminderMatch[2];
      if (action === "dismiss") reminder.dismissedAt = currentTime();
      else if (action === "pause") reminder.isPaused = true;
      else if (action === "resume") reminder.isPaused = false;
      else if (action === "cancel") reminder.isActive = false;
      else Object.assign(reminder, body);
      saveState(state);
      return { success: true, reminder };
    }
    const suggestionMatch = path.match(/^\/(appointments|medications)\/suggestions\/([^/]+)\/(confirm|ignore)$/);
    if (suggestionMatch) {
      throw new Error("This guest session has no OCR-generated suggestions to review.");
    }
  }
  if (method === "DELETE") {
    const nutritionMatch = path.match(/^\/nutrition\/entries\/([^/]+)$/);
    if (nutritionMatch) {
      state.nutritionEntries = state.nutritionEntries.filter((entry) => entry._id !== nutritionMatch[1]);
      saveState(state);
      return { success: true };
    }
  }

  throw new Error(`This feature is not available in local guest mode: ${method} ${path}`);
}
