const RESOURCE_ID_PATTERN = /^[A-Za-z0-9.-]{1,64}$/;

function getId(value) {
  return value?._id?.toString() || value?.id?.toString();
}

function reference(resourceType, id) {
  return { reference: `${resourceType}/${id}` };
}

function patientResource(user) {
  const nameParts = (user?.name || "Patient").trim().split(/\s+/);
  return {
    resourceType: "Patient",
    id: getId(user),
    active: true,
    name: [{
      text: nameParts.join(" "),
      family: nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined,
      given: nameParts.length > 1 ? nameParts.slice(0, -1) : nameParts,
    }],
  };
}

function observationResource(id, subjectId, code, value, unit, effectiveDateTime, category, referenceRange, confirmed = false) {
  return {
    resourceType: "Observation",
    id,
    status: confirmed ? "final" : "preliminary",
    category: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/observation-category",
        code: category,
      }],
    }],
    code: { text: code },
    subject: reference("Patient", subjectId),
    ...(effectiveDateTime ? { effectiveDateTime: new Date(effectiveDateTime).toISOString() } : {}),
    ...(Number.isFinite(value)
      ? { valueQuantity: { value, ...(unit ? { unit } : {}) } }
      : {
          dataAbsentReason: {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/data-absent-reason",
              code: "unknown",
            }],
          },
        }),
    ...(referenceRange ? { referenceRange: [{ text: referenceRange }] } : {}),
  };
}

function medicationRequestResource(id, subjectId, medication, sourceRecord = false) {
  const status = sourceRecord
    ? "active"
    : ({
        ACTIVE: "active",
        COMPLETED: "completed",
        STOPPED: "stopped",
      }[medication.status] || "unknown");
  const dosageText = [
    medication.dosage,
    medication.frequency,
    medication.instructions,
    sourceRecord ? medication.details : "",
  ].filter(Boolean).join(" · ");
  const boundsPeriod = {
    ...(medication.startDate ? { start: new Date(medication.startDate).toISOString() } : {}),
    ...(medication.endDate ? { end: new Date(medication.endDate).toISOString() } : {}),
  };

  return {
    resourceType: "MedicationRequest",
    id,
    status,
    intent: "order",
    medicationCodeableConcept: { text: medication.medicineName || medication.title },
    subject: reference("Patient", subjectId),
    ...(medication.createdAt || medication.recordedAt
      ? { authoredOn: new Date(medication.createdAt || medication.recordedAt).toISOString() }
      : {}),
    ...(medication.prescribedBy
      ? { requester: { display: medication.prescribedBy } }
      : {}),
    ...(dosageText || Object.keys(boundsPeriod).length
      ? {
          dosageInstruction: [{
            ...(dosageText ? { text: dosageText } : {}),
            ...(Object.keys(boundsPeriod).length ? { timing: { repeat: { boundsPeriod } } } : {}),
          }],
        }
      : {}),
  };
}

function mapPatientData({ user, healthRecords = [], documents = [], medications = [] }) {
  const patientId = getId(user);
  const resources = [patientResource(user)];

  for (const record of healthRecords) {
    const sourceId = getId(record);
    if (record.recordType === "VITAL") {
      resources.push(observationResource(
        `obs-${sourceId}`,
        patientId,
        record.title,
        record.value,
        record.unit,
        record.recordedAt,
        "vital-signs"
      ));
    } else if (record.recordType === "MEDICATION") {
      resources.push(medicationRequestResource(`med-${sourceId}`, patientId, record, true));
    } else if (record.recordType === "CONDITION") {
      resources.push({
        resourceType: "Condition",
        id: `condition-${sourceId}`,
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
        code: { text: record.title },
        subject: reference("Patient", patientId),
        ...(record.recordedAt ? { recordedDate: new Date(record.recordedAt).toISOString() } : {}),
        ...(record.details ? { note: [{ text: record.details }] } : {}),
      });
    } else if (record.recordType === "ALLERGY") {
      resources.push({
        resourceType: "AllergyIntolerance",
        id: `allergy-${sourceId}`,
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] },
        verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", code: "unconfirmed" }] },
        code: { text: record.title },
        patient: reference("Patient", patientId),
        ...(record.details ? { note: [{ text: record.details }] } : {}),
      });
    } else {
      resources.push({
        resourceType: "DocumentReference",
        id: `note-${sourceId}`,
        status: "current",
        docStatus: "final",
        type: { text: "Personal health note" },
        subject: reference("Patient", patientId),
        ...(record.recordedAt || record.createdAt
          ? { date: new Date(record.recordedAt || record.createdAt).toISOString() }
          : {}),
        description: record.title,
        ...(record.details
          ? { content: [{ attachment: { contentType: "text/plain", title: record.title, data: Buffer.from(record.details).toString("base64") } }] }
          : {}),
      });
    }
  }

  for (const medication of medications) {
    resources.push(medicationRequestResource(`med-${getId(medication)}`, patientId, medication));
  }

  for (const document of documents) {
    const sourceId = getId(document);
    const observationIds = [];
    if (document.reviewStatus === "CONFIRMED") {
      for (const [index, fact] of (document.extractedClinicalData || []).entries()) {
        if (fact.fieldType !== "DIAGNOSIS" || fact.verificationStatus !== "CONFIRMED" || !fact.value) continue;
        resources.push({
          resourceType: "Condition",
          id: `diagnosis-${sourceId}-${index + 1}`,
          verificationStatus: {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
              code: "unconfirmed",
            }],
          },
          code: { text: fact.value },
          subject: reference("Patient", patientId),
          note: [{
            text: `Patient-reviewed extraction only; not clinician-verified. Source: ${fact.sourceLine || "source line unavailable"}`,
          }],
        });
      }
    }
    for (const [index, result] of (document.extractedData || []).entries()) {
      const id = `lab-${sourceId}-${index + 1}`;
      observationIds.push(id);
      resources.push(observationResource(
        id,
        patientId,
        result.testName,
        result.value,
        result.unit,
        document.reportDate,
        "laboratory",
        result.referenceRange,
        document.reviewStatus === "CONFIRMED" &&
          result.verificationStatus === "CONFIRMED"
      ));
    }

    resources.push({
      resourceType: "DiagnosticReport",
      id: `report-${sourceId}`,
      status: document.reviewStatus === "CONFIRMED" ? "final" : "preliminary",
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: "LAB" }] }],
      code: { text: document.originalName || document.documentType || "Uploaded health document" },
      subject: reference("Patient", patientId),
      ...(document.reportDate ? { effectiveDateTime: new Date(document.reportDate).toISOString() } : {}),
      result: observationIds.map((id) => reference("Observation", id)),
    });
    resources.push({
      resourceType: "DocumentReference",
      id: `document-${sourceId}`,
      status: "current",
      type: { text: document.documentType || "Uploaded health document" },
      subject: reference("Patient", patientId),
      ...(document.createdAt ? { date: new Date(document.createdAt).toISOString() } : {}),
      description: document.originalName || "Uploaded health document",
      content: [{
        attachment: {
          title: document.originalName || "Uploaded health document",
          ...(document.mimeType ? { contentType: document.mimeType } : {}),
        },
      }],
    });
  }

  return resources;
}

function validateResources(resources) {
  const errors = [];
  const warnings = [];

  resources.forEach((resource, index) => {
    const location = `entry[${index}].resource`;
    if (!resource || typeof resource !== "object") {
      errors.push(`${location} must be a resource object.`);
      return;
    }
    if (typeof resource.resourceType !== "string" || !resource.resourceType) {
      errors.push(`${location}.resourceType is required.`);
    }
    if (typeof resource.id !== "string" || !RESOURCE_ID_PATTERN.test(resource.id)) {
      errors.push(`${location}.id must use 1–64 letters, digits, periods, or hyphens.`);
    }
    if (["Observation", "DiagnosticReport", "MedicationRequest", "Condition", "DocumentReference"].includes(resource.resourceType)) {
      const patientReference = resource.subject?.reference || resource.patient?.reference;
      if (patientReference !== resources[0]?.resourceType + "/" + resources[0]?.id) {
        errors.push(`${location} must reference the bundle Patient.`);
      }
    }
    if (resource.resourceType === "Observation" && (
      !resource.code?.text ||
      (!Number.isFinite(resource.valueQuantity?.value) && !resource.dataAbsentReason)
    )) {
      errors.push(`${location} requires a code and either a numeric valueQuantity or dataAbsentReason.`);
    }
    if (resource.resourceType === "MedicationRequest" && (!resource.status || !resource.intent || !resource.medicationCodeableConcept?.text)) {
      errors.push(`${location} requires status, intent, and medicationCodeableConcept.text.`);
    }
  });

  if (!resources.some((resource) => resource.resourceType === "Observation")) {
    warnings.push("No observations were found in the selected records.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

function buildFhirBundle(data) {
  const resources = mapPatientData(data);
  const validation = validateResources(resources);
  return {
    bundle: {
      resourceType: "Bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: resources.map((resource) => ({ resource })),
    },
    validation,
  };
}

module.exports = { buildFhirBundle };
