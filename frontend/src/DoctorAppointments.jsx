import { useEffect, useState } from "react";
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, CalendarDays, Check, Clock3,
  FileHeart, Pencil, Plus, Search, Stethoscope, X,
} from "lucide-react";

const TABS = [
  ["upcoming", "Upcoming"],
  ["past", "Past appointments"],
  ["cancelled", "Cancelled"],
  ["confirmation", "Needs confirmation"],
];

function toLocalDateTime(value) {
  const date = value ? new Date(value) : new Date(Date.now() + 60_000);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function formatAppointmentDate(value, timeZone, withTime = true) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      ...(withTime ? { timeStyle: "short" } : {}),
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      ...(withTime ? { timeStyle: "short" } : {}),
    }).format(date);
  }
}

function appointmentName(appointment) {
  return appointment.doctorName || appointment.doctorId?.name || "Provider not recorded";
}

function selectedIds(value) {
  return (value || []).map((item) => typeof item === "string" ? item : item?._id).filter(Boolean);
}

function blankForm() {
  return {
    doctorName: "",
    specialization: "",
    hospitalName: "",
    location: "",
    meetingLink: "",
    appointmentDate: toLocalDateTime(),
    timeProvided: true,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    appointmentType: "IN_PERSON",
    reason: "",
    notes: "",
    followUpDate: "",
    reminderPreference: false,
    pastVisit: false,
    sourceDocumentIds: [],
    relatedMedicationIds: [],
  };
}

function formForAppointment(appointment) {
  return {
    doctorName: appointmentName(appointment) === "Provider not recorded" ? "" : appointmentName(appointment),
    specialization: appointment.specialization || "",
    hospitalName: appointment.hospitalName || "",
    location: appointment.location || "",
    meetingLink: appointment.meetingLink || "",
    appointmentDate: toLocalDateTime(appointment.appointmentDate),
    timeProvided: appointment.timeProvided !== false,
    timeZone: appointment.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    appointmentType: appointment.appointmentType || "IN_PERSON",
    reason: appointment.reason || "",
    notes: appointment.notes || "",
    followUpDate: appointment.followUpDate ? toLocalDateTime(appointment.followUpDate).slice(0, 10) : "",
    reminderPreference: Boolean(appointment.reminderPreference),
    pastVisit: appointment.status === "COMPLETED",
    sourceDocumentIds: selectedIds(appointment.sourceDocumentIds),
    relatedMedicationIds: selectedIds(appointment.relatedMedicationIds),
  };
}

function monthKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

function dateKeyInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isAppointmentUpcoming(appointment, now) {
  if (appointment.timeProvided === false) {
    return dateKeyInTimeZone(new Date(appointment.appointmentDate), "UTC") >= dateKeyInTimeZone(now, "UTC");
  }
  return new Date(appointment.appointmentDate) >= now;
}

function isAppointmentDue(appointment, now) {
  if (appointment.timeProvided === false) {
    return dateKeyInTimeZone(new Date(appointment.appointmentDate), "UTC") <= dateKeyInTimeZone(now, "UTC");
  }
  return new Date(appointment.appointmentDate) <= now;
}

export default function DoctorAppointments({
  data,
  onCreate,
  onUpdate,
  onStatusChange,
  onConfirmSuggestion,
  onIgnoreSuggestion,
  onDownload,
  busy,
  loading,
  loadError,
  suggestionError,
}) {
  const [tab, setTab] = useState("upcoming");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [detailsId, setDetailsId] = useState("");
  const [form, setForm] = useState(blankForm);
  const [displayMonth, setDisplayMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const appointments = data.appointments || [];
  const suggestions = data.appointmentSuggestions || [];
  const normalizedQuery = query.trim().toLowerCase();
  const confirmed = appointments.filter((item) => item.status === "CONFIRMED");
  const upcoming = confirmed.filter((item) => isAppointmentUpcoming(item, now))
    .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
  const completed = appointments.filter((item) => item.status === "COMPLETED")
    .sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));
  const cancelled = appointments.filter((item) => item.status === "CANCELLED")
    .sort((a, b) => new Date(b.updatedAt || b.appointmentDate) - new Date(a.updatedAt || a.appointmentDate));
  const pending = appointments.filter((item) => item.status === "REQUESTED")
    .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate));
  const filteredSuggestions = suggestions.filter((suggestion) => !normalizedQuery || [
    suggestion.doctorName,
    suggestion.hospitalName,
    suggestion.suggestionType,
    suggestion.sourceDocumentId?.originalName,
    ...(suggestion.sourceEvidence || []),
  ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery)));
  const thisMonthCount = appointments.filter((item) =>
    ["CONFIRMED", "COMPLETED"].includes(item.status) &&
    monthKey(new Date(item.appointmentDate), item.timeProvided === false ? "UTC" : item.timeZone) ===
      monthKey(now, item.timeProvided === false ? "UTC" : item.timeZone)
  ).length;
  const followUpsDue = appointments.filter((item) =>
    item.followUpDate && item.status !== "CANCELLED" && new Date(item.followUpDate) <= now
  ).length;

  const sourceAppointments = tab === "upcoming" ? upcoming : tab === "past" ? completed : tab === "cancelled" ? cancelled : pending;
  const tabAppointments = sourceAppointments.filter((item) => !normalizedQuery || [
    appointmentName(item), item.specialization, item.hospitalName, item.reason, item.location,
  ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery)));

  const calendarMonthKey = `${displayMonth.getFullYear()}-${String(displayMonth.getMonth() + 1).padStart(2, "0")}`;
  const calendarEntries = confirmed.filter((item) =>
    monthKey(new Date(item.appointmentDate), item.timeProvided === false ? "UTC" : item.timeZone) ===
      calendarMonthKey
  );
  const calendarStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
  const gridStart = new Date(calendarStart);
  gridStart.setDate(1 - calendarStart.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const selectedDateEntries = selectedDay
    ? calendarEntries.filter((item) => dateKeyInTimeZone(new Date(item.appointmentDate), item.timeProvided === false ? "UTC" : item.timeZone) === selectedDay)
    : [];
  const details = appointments.find((item) => item._id === detailsId);
  const openNewForm = () => {
    setEditingId("");
    setForm(blankForm());
    setFormOpen(true);
  };
  const openEditForm = (appointment) => {
    setDetailsId("");
    setEditingId(appointment._id);
    setForm(formForAppointment(appointment));
    setFormOpen(true);
  };
  const openFollowUpForm = (appointment) => {
    const nextForm = formForAppointment(appointment);
    nextForm.appointmentDate = toLocalDateTime(appointment.followUpDate);
    nextForm.timeProvided = false;
    nextForm.pastVisit = false;
    nextForm.followUpDate = "";
    setDetailsId("");
    setEditingId("");
    setForm(nextForm);
    setFormOpen(true);
  };

  async function submit(event) {
    event.preventDefault();
    const selectedDate = form.timeProvided
      ? new Date(form.appointmentDate)
      : new Date(`${form.appointmentDate.slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(selectedDate.getTime())) return;
    const body = {
      doctorName: form.doctorName.trim(),
      specialization: form.specialization.trim(),
      hospitalName: form.hospitalName.trim(),
      location: form.location.trim(),
      meetingLink: form.meetingLink.trim(),
      appointmentDate: selectedDate.toISOString(),
      timeProvided: form.timeProvided,
      timeZone: form.timeZone,
      appointmentType: form.appointmentType,
      reason: form.reason.trim(),
      notes: form.notes.trim(),
      followUpDate: form.followUpDate ? new Date(`${form.followUpDate}T12:00:00`).toISOString() : null,
      reminderPreference: form.reminderPreference,
      sourceDocumentIds: form.sourceDocumentIds,
      relatedMedicationIds: form.relatedMedicationIds,
    };
    const saved = editingId
      ? await onUpdate(editingId, body)
      : await onCreate({ ...body, status: form.pastVisit ? "COMPLETED" : "CONFIRMED" });
    if (saved) {
      setFormOpen(false);
      setEditingId("");
    }
  }

  async function changeStatus(id, status) {
    if (status === "CANCELLED" && !window.confirm("Cancel this saved appointment? It will remain in your history.")) return;
    await onStatusChange(id, status);
  }

  return (
    <div className="appointments-page">
      <div className="appointments-page-heading">
        <div><span className="workspace-eyebrow">CARE SCHEDULE</span><h1>Doctor Appointments</h1><p>Keep track of your consultations, upcoming visits, and follow-up care.</p></div>
        <button className="primary-button" onClick={openNewForm}><Plus size={15} /> Add Appointment</button>
      </div>

      {loadError && <div className="appointment-error" role="alert">Appointments are currently unavailable: {loadError}</div>}
      <section className="appointment-summary-grid" aria-label="Appointment summary">
        {[
          ["Upcoming Appointments", upcoming.length],
          ["Completed Appointments", completed.length],
          ["Appointments This Month", thisMonthCount],
          ["Follow-ups Due", followUpsDue],
        ].map(([label, count]) => (
          <article className="appointment-summary-card" key={label}>
            <span>{label}</span><strong>{loadError ? "Unavailable" : loading ? "…" : count}</strong>
          </article>
        ))}
      </section>

      <section className="panel appointment-content-panel">
        <div className="appointment-toolbar">
          <div className="appointment-tabs" role="tablist" aria-label="Appointment categories">
            {TABS.map(([key, title]) => <button type="button" role="tab" aria-selected={tab === key} className={tab === key ? "selected" : ""} key={key} onClick={() => setTab(key)}>{title}{key === "confirmation" && pending.length > 0 ? ` (${pending.length})` : ""}</button>)}
          </div>
          <div className="appointment-toolbar-actions">
            <label className="appointment-search"><Search size={14} /><input aria-label="Search appointments" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search appointments" /></label>
            <button className="secondary-button compact-button" onClick={() => { setTab("past"); document.getElementById("appointment-history")?.scrollIntoView({ behavior: "smooth" }); }}><Clock3 size={14} /> Appointment History</button>
            <button className="secondary-button compact-button" aria-pressed={selectedDay !== ""} onClick={() => { setSelectedDay(""); setDisplayMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); document.getElementById("appointments-calendar")?.scrollIntoView({ behavior: "smooth" }); }}><CalendarDays size={14} /> Calendar View</button>
          </div>
        </div>

        {loading && !loadError && <div className="appointment-loading" role="status" aria-label="Loading appointments"><span /><span /><span /></div>}
        {!loading && tab === "confirmation" && (pending.length > 0 || suggestions.length > 0) && <p className="appointment-honesty-note">Possible details below were read from your uploaded records and are not confirmed until you review them. Pending clinic requests are separate and are not external bookings.</p>}
        {!loading && tab === "confirmation" && suggestionError && <div className="appointment-error" role="alert">Possible appointment details could not be loaded: {suggestionError}</div>}
        {!loading && tab === "confirmation" && filteredSuggestions.map((suggestion) => <AppointmentSuggestionCard key={suggestion._id} suggestion={suggestion} busy={busy} onConfirm={onConfirmSuggestion} onIgnore={onIgnoreSuggestion} onDownload={onDownload} />)}
        {!loading && tab === "upcoming" && <div className="appointment-list">
          {tabAppointments.length ? tabAppointments.map((appointment) => (
            <AppointmentCard key={appointment._id} appointment={appointment} now={now} onDetails={() => setDetailsId(appointment._id)} onEdit={() => openEditForm(appointment)} onCancel={() => changeStatus(appointment._id, "CANCELLED")} onComplete={() => changeStatus(appointment._id, "COMPLETED")} />
          )) : <AppointmentEmpty title={loadError ? "Appointments could not be loaded" : "No upcoming appointments"} detail={loadError ? "Please try again when the appointment service is available." : "Your user-managed visits will appear here. Add an appointment or review a pending clinic request."} action={!loadError && <button className="primary-button" onClick={openNewForm}><Plus size={14} /> Add Appointment</button>} />}
        </div>}
        {!loading && tab === "past" && <div className="appointment-list" id="appointment-history">
          {tabAppointments.length ? tabAppointments.map((appointment) => (
            <AppointmentCard key={appointment._id} appointment={appointment} onDetails={() => setDetailsId(appointment._id)} />
          )) : <AppointmentEmpty title="No past visits recorded" detail="Completed appointments you add or confirm will be shown here. No consultation details are inferred." />}
        </div>}
        {!loading && tab === "cancelled" && <div className="appointment-list">
          {tabAppointments.length ? tabAppointments.map((appointment) => (
            <AppointmentCard key={appointment._id} appointment={appointment} onDetails={() => setDetailsId(appointment._id)} />
          )) : <AppointmentEmpty title="No cancelled appointments" detail="Cancelled appointments remain in this history rather than being deleted." />}
        </div>}
        {!loading && tab === "confirmation" && <div className="appointment-list">
          {tabAppointments.length ? tabAppointments.map((appointment) => (
            <AppointmentCard key={appointment._id} appointment={appointment} onDetails={() => setDetailsId(appointment._id)} onEdit={() => openEditForm(appointment)} onCancel={() => changeStatus(appointment._id, "CANCELLED")} />
          )) : filteredSuggestions.length ? null : <AppointmentEmpty title="Nothing needs confirmation" detail={suggestionError ? "Possible appointment details could not be retrieved." : "No possible appointment details or pending clinic requests were found in your saved records."} />}
        </div>}
      </section>

      <section className="panel appointment-calendar-panel" id="appointments-calendar">
        <div className="panel-heading"><div><h2>Calendar</h2><p>Only user-confirmed saved appointments are shown.</p></div><div className="appointment-calendar-controls"><button className="secondary-button compact-button" onClick={() => { const date = new Date(); setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }}><CalendarDays size={14} /> Today</button><button className="icon-button" aria-label="Previous month" onClick={() => setDisplayMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}><ArrowLeft size={15} /></button><strong>{new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(displayMonth)}</strong><button className="icon-button" aria-label="Next month" onClick={() => setDisplayMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}><ArrowRight size={15} /></button></div></div>
        <div className="appointment-calendar-grid">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}
          {calendarDays.map((date) => {
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            const dayAppointments = calendarEntries.filter((item) => {
              return dateKeyInTimeZone(new Date(item.appointmentDate), item.timeProvided === false ? "UTC" : item.timeZone) === dateKey;
            });
            const isToday = date.toDateString() === now.toDateString();
            return <button type="button" key={dateKey} className={`appointment-calendar-day ${date.getMonth() !== displayMonth.getMonth() ? "outside-month" : ""} ${isToday ? "today" : ""} ${selectedDay === dateKey ? "chosen" : ""}`} onClick={() => setSelectedDay(dateKey)} aria-label={`${date.toLocaleDateString()}${dayAppointments.length ? `, ${dayAppointments.length} appointment${dayAppointments.length === 1 ? "" : "s"}` : ""}`}>
              <span>{date.getDate()}</span>{dayAppointments.length > 0 && <i aria-hidden="true" />}
            </button>;
          })}
        </div>
        {selectedDay && <div className="calendar-selected-day"><strong>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "full" })}</strong>{selectedDateEntries.length ? selectedDateEntries.map((appointment) => <button className="appointment-calendar-event" key={appointment._id} onClick={() => setDetailsId(appointment._id)}>{appointmentName(appointment)} · {formatAppointmentDate(appointment.appointmentDate, appointment.timeZone)}</button>) : <p>No confirmed appointments on this date.</p>}</div>}
      </section>

      {formOpen && <div className="appointment-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
        <section className="appointment-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-form-title">
          <div className="panel-heading"><div><h2 id="appointment-form-title">{editingId ? "Edit appointment" : "Add appointment"}</h2><p>These are personal records; saving does not book with a clinic.</p></div><button className="icon-button" aria-label="Close appointment form" onClick={() => setFormOpen(false)}><X size={16} /></button></div>
          <form className="appointment-form-grid" onSubmit={submit}>
            <label>Doctor or provider name<input required maxLength={150} value={form.doctorName} onChange={(event) => setForm({ ...form, doctorName: event.target.value })} /></label>
            <label>Specialization <span>(optional)</span><input maxLength={120} value={form.specialization} onChange={(event) => setForm({ ...form, specialization: event.target.value })} /></label>
            <label>Appointment date and time<input required type="datetime-local" value={form.appointmentDate} onChange={(event) => setForm({ ...form, appointmentDate: event.target.value })} /></label>
            <label>Appointment type<select value={form.appointmentType} onChange={(event) => setForm({ ...form, appointmentType: event.target.value })}><option value="IN_PERSON">In person</option><option value="ONLINE">Online</option><option value="PHONE">Phone</option><option value="OTHER">Other</option></select></label>
            <label>Hospital or clinic <span>(optional)</span><input maxLength={180} value={form.hospitalName} onChange={(event) => setForm({ ...form, hospitalName: event.target.value })} /></label>
            <label>Location or address <span>(optional)</span><input maxLength={500} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
            <label className="wide">Online meeting link <span>(optional)</span><input type="url" maxLength={1000} value={form.meetingLink} onChange={(event) => setForm({ ...form, meetingLink: event.target.value })} /></label>
            <label className="wide">Reason for visit <span>(optional)</span><input maxLength={1000} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
            <label className="wide">Notes <span>(optional)</span><textarea rows="3" maxLength={3000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <label>Follow-up date <span>(optional)</span><input type="date" value={form.followUpDate} onChange={(event) => setForm({ ...form, followUpDate: event.target.value })} /></label>
            <label>Time zone<input required maxLength={100} value={form.timeZone} readOnly aria-describedby="appointment-timezone-help" /><span id="appointment-timezone-help">The local time zone for this browser is used.</span></label>
            <label className="wide">Related medical documents <span>(optional; explicit links only)</span><select multiple value={form.sourceDocumentIds} onChange={(event) => setForm({ ...form, sourceDocumentIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>{data.documents.map((doc) => <option key={doc._id} value={doc._id}>{doc.originalName} · {doc.documentType?.replaceAll("_", " ") || "Document"}</option>)}</select></label>
            <label className="wide">Related medications <span>(optional; explicit links only)</span><select multiple value={form.relatedMedicationIds} onChange={(event) => setForm({ ...form, relatedMedicationIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>{data.medications.map((medication) => <option key={medication._id} value={medication._id}>{medication.medicineName}</option>)}</select></label>
            <label className="appointment-checkbox wide"><input type="checkbox" checked={!form.timeProvided} onChange={(event) => setForm({ ...form, timeProvided: !event.target.checked })} /> The source record does not specify an appointment time</label>
            <label className="appointment-checkbox wide"><input type="checkbox" checked={form.pastVisit} onChange={(event) => setForm({ ...form, pastVisit: event.target.checked })} /> This is a past/completed consultation</label>
            <label className="appointment-checkbox wide"><input type="checkbox" checked={form.reminderPreference} onChange={(event) => setForm({ ...form, reminderPreference: event.target.checked })} /> Save a reminder preference (no notification is sent automatically)</label>
            <div className="appointment-form-actions wide"><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button" disabled={busy}><Check size={15} />{busy ? "Saving…" : editingId ? "Save changes" : "Save appointment"}</button></div>
          </form>
        </section>
      </div>}

      {details && <div className="appointment-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsId(""); }}>
        <section className="appointment-modal appointment-details-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-details-title">
          <div className="panel-heading"><div><h2 id="appointment-details-title">{appointmentName(details)}</h2><p>{details.confirmationStatus === "USER_MANAGED" ? "User-managed record · Not booked with an external provider" : details.confirmationStatus === "CLINIC_PENDING" ? "Clinic request pending; external confirmation not recorded" : "Appointment details"}</p></div><button className="icon-button" aria-label="Close appointment details" onClick={() => setDetailsId("")}><X size={16} /></button></div>
          <div className="appointment-detail-grid">
            <DetailField title="Appointment ID" value={details._id} />
            <DetailField title="Date and time" value={formatAppointmentDate(details.appointmentDate, details.timeZone, details.timeProvided !== false)} />
            <DetailField title="Status" value={details.status?.replaceAll("_", " ")} />
            <DetailField title="Specialization" value={details.specialization} />
            <DetailField title="Hospital or clinic" value={details.hospitalName} />
            <DetailField title="Reason" value={details.reason} />
            <DetailField title="Location" value={details.location} />
            <DetailField title="Meeting link" value={details.meetingLink} />
            <DetailField title="Follow-up date" value={details.followUpDate ? formatAppointmentDate(details.followUpDate, details.timeZone, false) : ""} />
            <DetailField title="Notes" value={details.notes} />
            <DetailField title="Created" value={formatAppointmentDate(details.createdAt, details.timeZone)} />
            <DetailField title="Last updated" value={formatAppointmentDate(details.updatedAt, details.timeZone)} />
          </div>
          <h3>Linked medical records</h3>
          {details.sourceDocumentIds?.length ? <div className="appointment-linked-records">{details.sourceDocumentIds.map((doc) => <div className="appointment-linked-document" key={doc._id || doc}><span><FileHeart size={15} /> {doc.originalName || "Linked document"}{doc.reviewStatus && <small>{doc.reviewStatus === "CONFIRMED" ? "Patient-reviewed extraction" : "Unverified OCR extraction"}</small>}</span>{doc._id && <button className="secondary-button compact-button" onClick={() => onDownload(doc._id)}><ArrowDownToLine size={13} /> Download</button>}{doc.extractedData?.length > 0 && <ul>{doc.extractedData.map((finding, index) => <li key={`${doc._id}-${index}`}>{finding.testName}: {finding.originalValue || finding.value}{finding.unit ? ` ${finding.unit}` : ""} <em>({finding.verificationStatus || "UNVERIFIED"})</em></li>)}</ul>}</div>)}</div> : <p className="appointment-quiet">No documents explicitly linked; findings are not inferred from nearby records.</p>}
          <h3>Linked medicines</h3>
          {details.relatedMedicationIds?.length ? <div className="appointment-linked-records">{details.relatedMedicationIds.map((medication) => <div key={medication._id || medication}><span>{medication.medicineName || "Linked medication"}{medication.dosage ? ` · ${medication.dosage}` : ""}{medication.frequency ? ` · ${medication.frequency}` : ""}</span></div>)}</div> : <p className="appointment-quiet">No medicines explicitly linked.</p>}
          {details.followUpDate && <div className="appointment-followup-action"><p>Follow-up documented for {formatAppointmentDate(details.followUpDate, details.timeZone, false)}. Review the date and details before saving a new personal appointment.</p><button className="secondary-button compact-button" onClick={() => openFollowUpForm(details)}><CalendarDays size={14} /> Create follow-up appointment</button></div>}
          <div className="appointment-form-actions"><button className="secondary-button" onClick={() => openEditForm(details)} disabled={["COMPLETED", "CANCELLED"].includes(details.status)}><Pencil size={14} /> Edit / reschedule</button>{details.status === "CONFIRMED" && <button className="secondary-button danger-button" onClick={() => changeStatus(details._id, "CANCELLED")}>Cancel appointment</button>}</div>
        </section>
      </div>}
    </div>
  );
}

function AppointmentCard({ appointment, now, onDetails, onEdit, onCancel, onComplete }) {
  const statusLabel = appointment.status === "REQUESTED" ? "Clinic request pending" : appointment.status?.replaceAll("_", " ");
  return <article className="appointment-card">
    <div className="appointment-date-block"><strong>{new Intl.DateTimeFormat(undefined, { day: "2-digit", timeZone: appointment.timeProvided === false ? "UTC" : appointment.timeZone || undefined }).format(new Date(appointment.appointmentDate))}</strong><span>{new Intl.DateTimeFormat(undefined, { month: "short", timeZone: appointment.timeProvided === false ? "UTC" : appointment.timeZone || undefined }).format(new Date(appointment.appointmentDate))}</span></div>
    <div className="appointment-card-main"><div className="appointment-card-title-row"><strong>{appointmentName(appointment)}</strong><span className={`status-chip ${appointment.status?.toLowerCase()}`}>{statusLabel}</span></div><span>{formatAppointmentDate(appointment.appointmentDate, appointment.timeProvided === false ? "UTC" : appointment.timeZone, appointment.timeProvided !== false)}{appointment.specialization ? ` · ${appointment.specialization}` : ""}</span><small>{[appointment.hospitalName, appointment.reason].filter(Boolean).join(" · ") || (appointment.status === "REQUESTED" ? "Not confirmed by a clinic" : "Reason not recorded")}</small>{appointment.status === "CONFIRMED" && <small className="appointment-managed-label">User-managed record; not an external booking</small>}</div>
    <div className="appointment-card-actions"><button className="secondary-button compact-button" onClick={onDetails}>View details</button>{onEdit && <button className="icon-button" aria-label={`Edit appointment with ${appointmentName(appointment)}`} onClick={onEdit}><Pencil size={15} /></button>}{onComplete && isAppointmentDue(appointment, now) && <button className="icon-button" aria-label="Mark appointment completed" onClick={onComplete}><Check size={15} /></button>}{onCancel && <button className="icon-button danger-icon" aria-label="Cancel appointment" onClick={onCancel}><X size={15} /></button>}</div>
  </article>;
}

function AppointmentSuggestionCard({ suggestion, busy, onConfirm, onIgnore, onDownload }) {
  const [doctorName, setDoctorName] = useState(suggestion.doctorName || "");
  const [hospitalName, setHospitalName] = useState(suggestion.hospitalName || "");
  const [date, setDate] = useState(suggestion.appointmentDate ? new Date(suggestion.appointmentDate).toISOString().slice(0, 10) : "");
  const [time, setTime] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [duplicateChoice, setDuplicateChoice] = useState("");
  const source = suggestion.sourceDocumentId;
  const isFollowUp = suggestion.suggestionType === "FOLLOW_UP";
  const possibleDuplicates = suggestion.potentialDuplicateAppointments || [];

  async function confirm(event) {
    event.preventDefault();
    if (!date || !doctorName.trim()) return;
    if (possibleDuplicates.length > 0 && !duplicateChoice) return;
    const hasTime = Boolean(time);
    const appointmentDate = hasTime
      ? new Date(`${date}T${time}`).toISOString()
      : new Date(`${date}T12:00:00Z`).toISOString();
    await onConfirm(suggestion._id, {
      doctorName: doctorName.trim(),
      hospitalName: hospitalName.trim(),
      appointmentDate,
      timeProvided: hasTime,
      timeZone: hasTime ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC",
      appointmentType: "IN_PERSON",
      reason: isFollowUp ? "Follow-up noted in a medical record" : "",
      ...(!isFollowUp && suggestion.followUpDate ? { followUpDate: suggestion.followUpDate } : {}),
      reminderPreference: false,
      ...(duplicateChoice && duplicateChoice !== "separate" ? { linkToAppointmentId: duplicateChoice } : {}),
    });
  }

  return <article className="appointment-suggestion-card">
    <div className="appointment-suggestion-heading"><span className="suggestion-mark"><FileHeart size={16} /></span><div><strong>Possible {isFollowUp ? "follow-up" : "consultation"} detected</strong><small>Review the extracted evidence. It is not a confirmed appointment.</small></div>{suggestion.potentialDuplicate && <span className="status-chip pending">Possible duplicate</span>}</div>
    <div className="appointment-suggestion-evidence"><span>{doctorName || "Doctor not detected"}</span><span>{hospitalName || "Clinic not detected"}</span><span>{date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" }) : "Date not detected"} · time not provided</span></div>
    {source && <div className="appointment-suggestion-source"><span>Source: {source.originalName || "Uploaded medical record"}</span>{source._id && <button className="text-button" onClick={() => onDownload(source._id)}><ArrowDownToLine size={13} /> Download source</button>}</div>}
    {suggestion.sourceEvidence?.length > 0 && <details className="appointment-source-evidence"><summary>View extracted source lines</summary><ul>{suggestion.sourceEvidence.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul></details>}
    <button className="text-button suggestion-edit-toggle" onClick={() => setExpanded(!expanded)}>{expanded ? "Hide edit fields" : "Edit extracted details"}</button>
    {expanded && <form className="suggestion-confirm-form" onSubmit={confirm}>
      <label>Doctor or provider<input required maxLength={150} value={doctorName} onChange={(event) => setDoctorName(event.target.value)} /></label>
      <label>Clinic or hospital<input maxLength={180} value={hospitalName} onChange={(event) => setHospitalName(event.target.value)} /></label>
      <label>{isFollowUp ? "Follow-up date" : "Consultation date"}<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label>Time <span>(optional; not extracted)</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
      {possibleDuplicates.length > 0 && <label>Possible matching saved visit
        <span>Choose whether this source belongs to one of these visits or represents a separate appointment.</span>
        <select required value={duplicateChoice} onChange={(event) => setDuplicateChoice(event.target.value)}>
          <option value="">Choose an action</option>
          {possibleDuplicates.map((appointment) => <option key={appointment._id} value={appointment._id}>
            Link to {appointment.doctorName} · {appointment.hospitalName || "Clinic not recorded"} · {formatAppointmentDate(appointment.appointmentDate, appointment.timeProvided === false ? "UTC" : appointment.timeZone, appointment.timeProvided !== false)}
          </option>)}
          <option value="separate">Create a separate appointment</option>
        </select>
      </label>}
      <div className="appointment-form-actions"><button type="button" className="text-button" onClick={() => onIgnore(suggestion._id)} disabled={busy}>Ignore suggestion</button><button type="submit" className="primary-button" disabled={busy || !doctorName.trim() || (possibleDuplicates.length > 0 && !duplicateChoice)}><Check size={14} /> {duplicateChoice && duplicateChoice !== "separate" ? "Link source to visit" : "Confirm and save"}</button></div>
    </form>}
    {!expanded && <div className="appointment-form-actions"><button className="text-button" onClick={() => onIgnore(suggestion._id)} disabled={busy}>Ignore</button><button className="primary-button compact-button" onClick={() => setExpanded(true)}><Check size={14} /> Review and confirm</button></div>}
  </article>;
}

function DetailField({ title, value }) {
  return value ? <div><span>{title}</span><strong>{value}</strong></div> : null;
}

function AppointmentEmpty({ title, detail, action }) {
  return <div className="appointment-empty"><span><Stethoscope size={19} /></span><strong>{title}</strong><p>{detail}</p>{action}</div>;
}
