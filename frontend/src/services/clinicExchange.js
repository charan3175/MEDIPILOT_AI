const clinicOneRecord = {
  facility: "Harborview Clinic",
  patient: { localId: "HV-2048", displayName: "Simulation patient" },
  laboratoryPanel: {
    name: "Basic chemistry",
    collectedAt: "2026-10-02T09:15:00.000Z",
    results: [{ label: "Glucose", reading: 92, units: "mg/dL", range: "70–99 mg/dL" }],
  },
};

const clinicTwoRecord = {
  organization: "Cedar Grove Family Practice",
  person: { chartNumber: "CG-771", name: "Simulation patient" },
  observations: [{
    display: "Body weight",
    amount: 68.2,
    unitDisplay: "kg",
    measuredOn: "2026-10-05T14:40:00.000Z",
  }],
};

export function getClinicExchangeTimeline() {
  const patientId = "simulation-patient";
  const firstLab = clinicOneRecord.laboratoryPanel.results[0];
  const firstObservationId = "obs-harborview-glucose";
  const firstObservation = {
    resourceType: "Observation",
    id: firstObservationId,
    status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
    code: { text: firstLab.label },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: clinicOneRecord.laboratoryPanel.collectedAt,
    valueQuantity: { value: firstLab.reading, unit: firstLab.units },
    referenceRange: [{ text: firstLab.range }],
  };
  const firstReport = {
    resourceType: "DiagnosticReport",
    id: "report-harborview-chemistry",
    status: "final",
    code: { text: clinicOneRecord.laboratoryPanel.name },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: clinicOneRecord.laboratoryPanel.collectedAt,
    result: [{ reference: `Observation/${firstObservationId}` }],
  };
  const secondObservation = {
    resourceType: "Observation",
    id: "obs-cedargrove-weight",
    status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
    code: { text: clinicTwoRecord.observations[0].display },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: clinicTwoRecord.observations[0].measuredOn,
    valueQuantity: {
      value: clinicTwoRecord.observations[0].amount,
      unit: clinicTwoRecord.observations[0].unitDisplay,
    },
  };

  return [
    {
      date: firstObservation.effectiveDateTime,
      facility: clinicOneRecord.facility,
      sourceFormat: "Local laboratory panel",
      resource: firstObservation,
      report: firstReport,
    },
    {
      date: secondObservation.effectiveDateTime,
      facility: clinicTwoRecord.organization,
      sourceFormat: "Local observation feed",
      resource: secondObservation,
    },
  ].sort((left, right) => new Date(right.date) - new Date(left.date));
}
