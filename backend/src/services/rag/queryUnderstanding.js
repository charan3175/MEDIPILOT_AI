const STOP_WORDS = new Set([
  "a",
  "about",
  "am",
  "an",
  "and",
  "are",
  "be",
  "blood",
  "can",
  "compare",
  "did",
  "do",
  "does",
  "for",
  "from",
  "give",
  "have",
  "health",
  "how",
  "i",
  "in",
  "is",
  "latest",
  "last",
  "level",
  "me",
  "medicine",
  "medication",
  "my",
  "of",
  "on",
  "one",
  "previous",
  "report",
  "result",
  "results",
  "show",
  "tell",
  "test",
  "trend",
  "difference",
  "the",
  "this",
  "to",
  "two",
  "was",
  "what",
  "when",
  "with",
]);

const TEST_ALIASES = new Map([
  ["hb", "hemoglobin"],
  ["hba1c", "hemoglobin a1c"],
  ["a1c", "hemoglobin a1c"],
  ["blood sugar", "glucose"],
  ["sugar", "glucose"],
  ["creatinine", "creatinine"],
]);

function normalizeTerm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function detectEmergency(text) {
  const query = normalizeTerm(text);
  const urgentPhrase =
    /\b(cannot breathe|can t breathe|shortness of breath|difficulty breathing|blue lips|severe bleeding|heavy bleeding|unconscious|not waking|can t wake|face drooping|suicid|want to die|kill myself|self harm|overdose|poisoning|anaphylaxis|severe allergic reaction|took too much|may have taken too much)\b/.test(
      query
    );
  const personalAcuteContext =
    /\b(i have|i m having|i am having|i feel|my|someone is|experiencing|right now|currently|help)\b/.test(
      query
    );
  const potentiallyCriticalSymptom =
    /\b(chest pain|heart attack|stroke symptoms|seizure|convulsions)\b/.test(
      query
    );
  return urgentPhrase || (personalAcuteContext && potentiallyCriticalSymptom);
}

function classifyQuestion(question) {
  const normalized = normalizeTerm(question);
  const allRecordsRequest =
    /\b(all|every|entire|complete|overall)\b.{0,50}\b(records?|reports?|documents?|health history)\b|\b(records?|reports?|documents?)\b.{0,50}\b(all|every|entire|complete)\b/.test(
      normalized
    );
  const asksToReviewRecords =
    /\b(records?|reports?|documents?|medical history|health history)\b/.test(normalized) &&
    /\b(analy[sz]e|summari[sz]e|review|look up|show|find|explain|tell|what|which|when)\b/.test(
      normalized
    );
  const hasPersonalReference =
    /\b(my|mine|i take|i am taking|i have|my records|my report|my result)\b/.test(
      normalized
    ) || allRecordsRequest || asksToReviewRecords;
  const comparison =
    /\b(compare|comparison|difference|change|trend|previous|prior|last two|before)\b/.test(
      normalized
    );
  const medication =
    /\b(medicine|medicines|medication|medications|drug|drugs|prescription|dose|dosage|frequency)\b/.test(
      normalized
    );
  const appointments =
    /\b(appointment|appointments|consultation|consultations|doctor visit|doctor visits|follow up|follow up date)\b/.test(
      normalized
    );
  const reminders = /\b(reminder|reminders)\b/.test(normalized);
  const lab =
    /\b(lab|laboratory|test|result|results|level|glucose|hemoglobin|haemoglobin|hba1c|cholesterol|creatinine|vitamin|platelet|wbc|rbc|blood count)\b/.test(
      normalized
    );
  const timeline =
    /\b(timeline|history|latest report|last report|when was|most recent)\b/.test(
      normalized
    );
  const health =
    /\b(health|medical|symptom|symptoms|headache|fever|pain|cough|nausea|dizz(?:y|iness)|rash|sick|seizure|diagnos|treatment|disease|condition|side effect|normal range|reference range)\b/.test(
      normalized
    );

  let intent = "GENERAL_CHAT";
  if (allRecordsRequest || asksToReviewRecords) intent = "PATIENT_RECORD_REVIEW";
  else if (comparison && hasPersonalReference) intent = "COMPARISON";
  else if (reminders && hasPersonalReference) intent = "PATIENT_REMINDERS";
  else if (appointments && hasPersonalReference) intent = "PATIENT_APPOINTMENTS";
  else if (medication && hasPersonalReference) intent = "PATIENT_MEDICATION";
  else if (lab && hasPersonalReference) intent = "PATIENT_LAB_RESULT";
  else if (timeline && hasPersonalReference) intent = "PATIENT_TIMELINE";
  else if (health || lab || medication) intent = "GENERAL_MEDICAL";

  return {
    intent,
    hasPersonalReference,
    needsPatientRecords:
      hasPersonalReference ||
      intent === "PATIENT_LAB_RESULT" ||
      intent === "PATIENT_MEDICATION" ||
      intent === "PATIENT_APPOINTMENTS" ||
      intent === "PATIENT_REMINDERS" ||
      intent === "PATIENT_TIMELINE" ||
      intent === "PATIENT_RECORD_REVIEW" ||
      (intent === "COMPARISON" && hasPersonalReference),
    needsMedicalKnowledge:
      intent === "GENERAL_MEDICAL" ||
      (hasPersonalReference && health),
    comparison,
    medical: intent !== "GENERAL_CHAT",
  };
}

function extractTestTerms(question) {
  const normalized = normalizeTerm(question);
  const aliases = [...TEST_ALIASES.keys()].sort(
    (left, right) => right.length - left.length
  );
  for (const alias of aliases) {
    if (normalized.includes(alias)) {
      return TEST_ALIASES.get(alias).split(" ");
    }
  }

  return normalized
    .split(" ")
    .filter((term) => term && !STOP_WORDS.has(term) && !/^\d/.test(term));
}

function matchTestName(testName, terms) {
  if (!terms.length) return false;
  let normalizedName = normalizeTerm(testName);
  for (const [alias, canonical] of TEST_ALIASES) {
    normalizedName = normalizedName.split(alias).join(canonical);
  }
  const nameTerms = normalizedName.split(" ");
  if (terms.every((term) => nameTerms.includes(term))) return true;
  if (terms.join(" ") && normalizedName.includes(terms.join(" "))) return true;
  return false;
}

function detectEmergencyAnswer() {
  return "Your message may describe an emergency. Contact your local emergency number or seek emergency care now. Do not wait for an AI response.";
}

module.exports = {
  classifyQuestion,
  detectEmergency,
  detectEmergencyAnswer,
  extractTestTerms,
  matchTestName,
  normalizeTerm,
};
