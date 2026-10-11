import { useState } from "react";
import {
  ArrowDownToLine, Check, Clock3, FileHeart, Pencil,
  Pill, Plus, Search, ShieldCheck, X,
} from "lucide-react";

const TABS = [
  ["current", "Current"],
  ["starting", "Starting soon"],
  ["ending", "Ending soon"],
  ["past", "Completed / past"],
  ["review", "Needs review"],
  ["history", "Prescription history"],
];

const blankForm = () => ({
  medicineName: "",
  strength: "",
  dosage: "",
  dosageForm: "",
  route: "",
  frequency: "",
  duration: "",
  foodInstructions: "",
  startDate: "",
  endDate: "",
  prescribedFor: "",
  prescribedBy: "",
  prescriptionDate: "",
  instructions: "",
  sourceDocumentId: "",
  status: "ACTIVE",
});

function dateOnly(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function utcDate(value) {
  return value ? new Date(`${value}T12:00:00Z`).toISOString() : null;
}

function displayDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function medicationBucket(medication, today) {
  const start = dateOnly(medication.startDate);
  const end = dateOnly(medication.endDate);
  const remaining = end
    ? Math.ceil((new Date(`${end}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86_400_000)
    : null;
  if (medication.status === "COMPLETED" || medication.status === "STOPPED") return "past";
  if (start && start > today) return "starting";
  if (end && remaining >= 0 && remaining <= 7) return "ending";
  if (medication.status === "ACTIVE") return "current";
  return "past";
}

function medicationLabel(medication, today) {
  const bucket = medicationBucket(medication, today);
  if (bucket === "starting") return "Starting soon";
  if (bucket === "ending") return "Ending soon";
  if (bucket === "past") return medication.status === "STOPPED" ? "Stopped" : medication.status === "COMPLETED" ? "Completed" : "End date passed · review";
  return "Active";
}

function medicationForm(medication) {
  return {
    ...blankForm(),
    ...medication,
    startDate: dateOnly(medication.startDate),
    endDate: dateOnly(medication.endDate),
    prescriptionDate: dateOnly(medication.prescriptionDate),
    sourceDocumentId: typeof medication.sourceDocumentId === "string"
      ? medication.sourceDocumentId
      : medication.sourceDocumentId?._id || "",
  };
}

export default function Medications({
  data,
  loadError,
  loading,
  onRetry,
  onNavigate,
  onCreate,
  onUpdate,
  onConfirmSuggestion,
  onIgnoreSuggestion,
  onDownload,
  busy,
}) {
  const [tab, setTab] = useState("current");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const [detailsId, setDetailsId] = useState("");
  const today = todayKey();
  const medications = data.medications || [];
  const suggestions = data.medicationSuggestions || [];
  const prescriptions = (data.documents || []).filter((doc) => doc.documentType === "PRESCRIPTION");
  const completedCount = medications.filter((item) => item.status === "COMPLETED").length;
  const activeCount = medications.filter((item) => medicationBucket(item, today) === "current").length;
  const endingCount = medications.filter((item) => medicationBucket(item, today) === "ending").length;
  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (item) => [
    item.medicineName,
    item.strength,
    item.dosage,
    item.frequency,
    item.prescribedBy,
    item.sourceDocumentId?.originalName,
  ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
  const filtered = medications.filter((item) =>
    medicationBucket(item, today) === tab && (!normalizedQuery || matchesQuery(item))
  );
  const selected = medications.find((item) => item._id === detailsId);

  async function save(event) {
    event.preventDefault();
    const body = {
      ...form,
      startDate: utcDate(form.startDate),
      endDate: utcDate(form.endDate),
      prescriptionDate: utcDate(form.prescriptionDate),
      sourceDocumentId: form.sourceDocumentId || null,
    };
    const result = form._id
      ? await onUpdate(form._id, body)
      : await onCreate(body);
    if (result) setForm(null);
  }

  return <div className="medications-page">
    <header className="medications-heading">
      <div><span className="workspace-eyebrow">MEDICATION RECORDS</span><h1>My Medications</h1><p>Your recorded medicines, prescription instructions, and daily medication information—all in one place.</p></div>
      <div className="medications-heading-actions">
        <button className="secondary-button" onClick={() => onNavigate("Health records")}><FileHeart size={15} /> Import From Prescription</button>
        <button className="primary-button" onClick={() => setForm(blankForm())}><Plus size={15} /> Add Medicine</button>
      </div>
    </header>

    {loadError && <div className="appointment-error" role="alert">
      We couldn't load your medication records. Please try again. <button className="text-button" onClick={onRetry}>Retry</button>
    </div>}

    <section className="medication-summary-grid" aria-label="Medication summary">
      <Summary label="Active Medications" value={loadError ? "Unavailable" : loading ? "…" : activeCount} />
      <Summary label="Today's Scheduled Doses" value="Not tracked" detail="Dose tracking is not enabled" />
      <Summary label="Ending Soon" value={loadError ? "Unavailable" : loading ? "…" : endingCount} />
      <Summary label="Completed Medications" value={loadError ? "Unavailable" : loading ? "…" : completedCount} />
    </section>

    <section className="panel medication-schedule-note">
      <div className="medication-section-heading"><div><h2>Today's Medication Schedule</h2><p>Only timing explicitly saved in a medication record can appear here.</p></div><Clock3 size={19} /></div>
      <p>No dose schedule or dose-confirmation tracking is configured. Recorded frequency is shown as written; this page will not infer dose times or mark medicines taken.</p>
    </section>

    <section className="panel medication-content-panel">
      <div className="medication-toolbar">
        <div className="medication-tabs" role="tablist" aria-label="Medication categories">
          {TABS.map(([key, label]) => <button key={key} role="tab" type="button" aria-selected={tab === key} className={tab === key ? "selected" : ""} onClick={() => setTab(key)}>
            {label}{key === "review" && suggestions.length ? ` (${suggestions.length})` : ""}
          </button>)}
        </div>
        <label className="appointment-search"><Search size={14} /><input aria-label="Search medications" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search medicines" /></label>
      </div>

      {loading && <div className="appointment-loading" role="status" aria-label="Loading medication records"><span /><span /><span /></div>}
      {!loading && tab === "review" && <div className="medication-suggestions">
        {suggestions.map((suggestion) => <MedicationSuggestion key={suggestion._id} suggestion={suggestion} busy={busy} onConfirm={onConfirmSuggestion} onIgnore={onIgnoreSuggestion} onDownload={onDownload} />)}
        {!suggestions.length && <MedicationEmpty title="Nothing needs review" detail="Medicine details explicitly labelled in uploaded prescriptions will appear here for review. They are not active medication records until you confirm them." action={<button className="secondary-button" onClick={() => onNavigate("Health records")}><FileHeart size={14} /> Review Medical Records</button>} />}
      </div>}
      {!loading && tab === "history" && <div className="medication-history-list">
        {prescriptions.map((document) => <article className="medication-history-card" key={document._id}>
          <FileHeart size={17} /><div><strong>{document.originalName}</strong><span>{displayDate(document.reportDate || document.createdAt)} · {document.reviewStatus === "CONFIRMED" ? "Patient-reviewed document" : "Document extraction needs review"}</span></div>
          <button className="secondary-button compact-button" onClick={() => onDownload(document._id)}><ArrowDownToLine size={14} /> Open prescription</button>
        </article>)}
        {!prescriptions.length && <MedicationEmpty title="No prescription history" detail="Uploaded prescriptions will be listed here. Upload one in Health Records to review its recorded details." action={<button className="secondary-button" onClick={() => onNavigate("Health records")}><FileHeart size={14} /> Go to Health Records</button>} />}
      </div>}
      {!loading && ["current", "starting", "ending", "past"].includes(tab) && <div className="medication-card-list">
        {filtered.map((medication) => <MedicationCard key={medication._id} medication={medication} today={today} onDetails={() => setDetailsId(medication._id)} onEdit={() => setForm(medicationForm(medication))} onDownload={onDownload} onStatus={(status) => onUpdate(medication._id, { status })} busy={busy} />)}
        {!filtered.length && <MedicationEmpty title={tab === "current" && medications.length === 0 ? "No medications yet" : `No ${TABS.find(([key]) => key === tab)?.[1].toLowerCase()} medicines`} detail={tab === "current" && medications.length === 0 ? "Your confirmed medicines will appear here when you add them or review medicines extracted from your prescriptions." : "No saved medication records match this view."} action={<><button className="primary-button" onClick={() => setForm(blankForm())}><Plus size={14} /> Add Medicine</button><button className="secondary-button" onClick={() => onNavigate("Health records")}><FileHeart size={14} /> Import From Prescription</button></>} />}
      </div>}
    </section>

    {selected && <div className="appointment-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsId(""); }}>
      <section className="appointment-modal medication-detail-modal" role="dialog" aria-modal="true" aria-labelledby="medication-details-title">
        <div className="panel-heading"><div><h2 id="medication-details-title">{selected.medicineName}</h2><p>{medicationLabel(selected, today)} · {selected.verificationStatus?.replaceAll("_", " ") || "User-entered"}</p></div><button className="icon-button" aria-label="Close medication details" onClick={() => setDetailsId("")}><X size={16} /></button></div>
        <div className="medication-detail-grid">
          <Detail label="Strength" value={selected.strength} />
          <Detail label="Dose instructions" value={selected.dosage} />
          <Detail label="Dosage form" value={selected.dosageForm} />
          <Detail label="Route" value={selected.route} />
          <Detail label="Frequency" value={selected.frequency} />
          <Detail label="Duration" value={selected.duration} />
          <Detail label="Food instructions" value={selected.foodInstructions} />
          <Detail label="Start date" value={displayDate(selected.startDate)} />
          <Detail label="End date" value={displayDate(selected.endDate)} />
          <Detail label="Prescribing clinician" value={selected.prescribedBy} />
          <Detail label="Prescription date" value={displayDate(selected.prescriptionDate)} />
          <Detail label="Purpose" value={selected.prescribedFor} />
          <Detail label="Additional instructions" value={selected.instructions} />
          <Detail label="Source" value={selected.source === "PRESCRIPTION_REPORT" ? "Uploaded prescription" : "User entered"} />
          <Detail label="Verification" value={selected.verificationStatus?.replaceAll("_", " ") || "User entered"} />
        </div>
        <section className="medication-source-detail"><h3>Prescription source</h3>
          {selected.sourceDocumentId ? <><p>{selected.sourceDocumentId.originalName || "Linked prescription"} · {displayDate(selected.sourceDocumentId.reportDate || selected.sourceDocumentId.createdAt)}</p><button className="secondary-button compact-button" onClick={() => onDownload(selected.sourceDocumentId._id)}><ArrowDownToLine size={14} /> Open original prescription</button></> : <p>No prescription source is linked.</p>}
        </section>
        <div className="appointment-form-actions"><button className="secondary-button" onClick={() => { setDetailsId(""); setForm(medicationForm(selected)); }}><Pencil size={14} /> Edit details</button></div>
      </section>
    </div>}

    {form && <div className="appointment-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setForm(null); }}>
      <section className="appointment-modal medication-form-modal" role="dialog" aria-modal="true" aria-labelledby="medication-form-title">
        <div className="panel-heading"><div><h2 id="medication-form-title">{form._id ? "Edit medication details" : "Add medicine"}</h2><p>Only enter instructions that are documented or that you personally know.</p></div><button className="icon-button" aria-label="Close medication form" onClick={() => setForm(null)}><X size={16} /></button></div>
        <form className="appointment-form-grid" onSubmit={save}>
          <MedicationInput label="Medicine name" name="medicineName" required form={form} setForm={setForm} />
          <MedicationInput label="Strength" name="strength" form={form} setForm={setForm} />
          <MedicationInput label="Dose instructions" name="dosage" form={form} setForm={setForm} />
          <MedicationInput label="Dosage form" name="dosageForm" form={form} setForm={setForm} />
          <MedicationInput label="Route" name="route" form={form} setForm={setForm} />
          <MedicationInput label="Frequency" name="frequency" form={form} setForm={setForm} />
          <MedicationInput label="Duration" name="duration" form={form} setForm={setForm} />
          <MedicationInput label="Food instructions" name="foodInstructions" form={form} setForm={setForm} />
          <label>Start date<input type="date" value={form.startDate || ""} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
          <label>End date<input type="date" value={form.endDate || ""} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
          <MedicationInput label="Purpose (if documented)" name="prescribedFor" form={form} setForm={setForm} />
          <MedicationInput label="Prescribed by" name="prescribedBy" form={form} setForm={setForm} />
          <label>Prescription date<input type="date" value={form.prescriptionDate || ""} onChange={(event) => setForm({ ...form, prescriptionDate: event.target.value })} /></label>
          {form._id && <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="STOPPED">Stopped</option></select></label>}
          <label className="wide">Source prescription<select value={form.sourceDocumentId || ""} onChange={(event) => setForm({ ...form, sourceDocumentId: event.target.value })}><option value="">No linked prescription</option>{prescriptions.map((doc) => <option key={doc._id} value={doc._id}>{doc.originalName} · {displayDate(doc.reportDate || doc.createdAt)}</option>)}</select></label>
          <label className="wide">Additional instructions<textarea rows="3" maxLength={1000} value={form.instructions || ""} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label>
          <p className="wide medication-source-note"><ShieldCheck size={14} /> User-entered details are not clinician-verified. OCR-derived values remain review-only until saved by you.</p>
          <div className="appointment-form-actions wide"><button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancel</button><button className="primary-button" disabled={busy}><Check size={14} /> {busy ? "Saving…" : form._id ? "Save changes" : "Save medicine"}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}

function Summary({ label, value, detail }) {
  return <article className="medication-summary-card"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}

function MedicationCard({ medication, today, onDetails, onEdit, onDownload, onStatus, busy }) {
  const bucket = medicationBucket(medication, today);
  return <article className="medication-record-card">
    <span className="medication-record-icon"><Pill size={18} /></span>
    <div className="medication-record-main">
      <div className="medication-record-title"><strong>{medication.medicineName}</strong><span className={`status-chip ${bucket === "past" ? "completed" : bucket === "ending" ? "pending" : "active"}`}>{medicationLabel(medication, today)}</span></div>
      <p>{[medication.strength, medication.dosage, medication.frequency].filter(Boolean).join(" · ") || "Dose instructions not recorded"}</p>
      <small>{medication.sourceDocumentId?.originalName ? `Prescription: ${medication.sourceDocumentId.originalName}` : "No prescription linked"} · {medication.verificationStatus?.replaceAll("_", " ") || "User entered"}</small>
      {medication.endDate && dateOnly(medication.endDate) < today && medication.status === "ACTIVE" && <small className="medication-review-note">Recorded end date has passed; medication status was not changed automatically.</small>}
    </div>
    <div className="medication-card-actions">
      <button className="secondary-button compact-button" onClick={onDetails}>View details</button>
      <button className="icon-button" aria-label={`Edit ${medication.medicineName}`} onClick={onEdit}><Pencil size={14} /></button>
      {medication.sourceDocumentId?._id && <button className="icon-button" aria-label={`Open prescription for ${medication.medicineName}`} onClick={() => onDownload(medication.sourceDocumentId._id)}><ArrowDownToLine size={14} /></button>}
      {medication.status === "ACTIVE" && <button className="text-button" onClick={() => onStatus("COMPLETED")} disabled={busy}>Mark completed</button>}
    </div>
  </article>;
}

function MedicationSuggestion({ suggestion, busy, onConfirm, onIgnore, onDownload }) {
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState(() => ({
    medicineName: suggestion.medicineName || "",
    strength: suggestion.strength || "",
    dosage: suggestion.dosage || "",
    dosageForm: suggestion.dosageForm || "",
    route: suggestion.route || "",
    frequency: suggestion.frequency || "",
    duration: suggestion.duration || "",
    foodInstructions: suggestion.foodInstructions || "",
    startDate: dateOnly(suggestion.startDate),
    endDate: dateOnly(suggestion.endDate),
    prescribedBy: suggestion.prescribedBy || "",
    prescriptionDate: dateOnly(suggestion.prescriptionDate),
    instructions: suggestion.instructions || "",
  }));
  const source = suggestion.sourceDocumentId;
  async function confirm(event) {
    event.preventDefault();
    const body = {
      ...fields,
      startDate: utcDate(fields.startDate),
      endDate: utcDate(fields.endDate),
      prescriptionDate: utcDate(fields.prescriptionDate),
    };
    await onConfirm(suggestion._id, body);
  }
  function update(field, value) {
    setFields((current) => ({ ...current, [field]: value }));
  }
  return <article className="medication-suggestion-card">
    <div className="medication-suggestion-heading"><span className="medication-record-icon"><Pill size={17} /></span><div><strong>{suggestion.medicineName || "Medicine not detected"}</strong><span>Extracted from a prescription · Needs your review</span></div><span className="status-chip pending">Needs review</span></div>
    <p>{[suggestion.strength, suggestion.dosage, suggestion.frequency, suggestion.duration].filter(Boolean).join(" · ") || "Dose, frequency, or duration not detected"}</p>
    {source && <div className="medication-source-row"><span>Source: {source.originalName || "Uploaded prescription"}</span>{source._id && <button className="text-button" onClick={() => onDownload(source._id)}><ArrowDownToLine size={13} /> Open original</button>}</div>}
    {suggestion.sourceEvidence?.length > 0 && <details className="appointment-source-evidence"><summary>View extracted lines</summary><ul>{suggestion.sourceEvidence.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul></details>}
    <button className="text-button" onClick={() => setExpanded(!expanded)}>{expanded ? "Close review fields" : "Review and edit details"}</button>
    {expanded && <form className="appointment-form-grid medication-review-form" onSubmit={confirm}>
      {Object.entries({
        medicineName: "Medicine name",
        strength: "Strength",
        dosage: "Dose instructions",
        dosageForm: "Dosage form",
        route: "Route",
        frequency: "Frequency",
        duration: "Duration",
        foodInstructions: "Food instructions",
        prescribedBy: "Prescribing clinician",
      }).map(([key, label]) => <MedicationInput key={key} label={label} name={key} required={key === "medicineName"} form={fields} setForm={(next) => setFields(next)} />)}
      <label>Start date<input type="date" value={fields.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
      <label>End date<input type="date" value={fields.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
      <label>Prescription date<input type="date" value={fields.prescriptionDate} onChange={(event) => update("prescriptionDate", event.target.value)} /></label>
      <label className="wide">Additional instructions<textarea maxLength={1000} rows="2" value={fields.instructions} onChange={(event) => update("instructions", event.target.value)} /></label>
      <p className="wide medication-source-note"><ShieldCheck size={14} /> Review every field against the original. Missing instructions are left blank; confirming does not verify clinical correctness.</p>
      <div className="appointment-form-actions wide"><button type="button" className="text-button" onClick={() => onIgnore(suggestion._id)} disabled={busy}>Ignore suggestion</button><button type="submit" className="primary-button" disabled={busy || !fields.medicineName.trim()}><Check size={14} /> Confirm and add</button></div>
    </form>}
    {!expanded && <div className="appointment-form-actions"><button className="text-button" onClick={() => onIgnore(suggestion._id)} disabled={busy}>Ignore</button><button className="primary-button compact-button" onClick={() => setExpanded(true)}><Check size={14} /> Review medicine</button></div>}
  </article>;
}

function MedicationInput({ label, name, form, setForm, required = false }) {
  return <label>{label}<input
    required={required}
    maxLength={name === "medicineName" ? 200 : name === "instructions" ? 1000 : 500}
    value={form[name] || ""}
    onChange={(event) => setForm({ ...form, [name]: event.target.value })}
  /></label>;
}

function Detail({ label, value }) {
  return <div><span>{label}</span><strong>{value || "Not recorded"}</strong></div>;
}

function MedicationEmpty({ title, detail, action }) {
  return <div className="medication-empty-state"><span><Pill size={19} /></span><strong>{title}</strong><p>{detail}</p>{action && <div className="medication-empty-actions">{action}</div>}</div>;
}
