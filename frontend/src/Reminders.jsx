import { useEffect, useState } from "react";
import {
  Bell, CalendarDays, Check, Clock3, FileHeart, Pause, Pencil,
  Play, Plus, Search, ShieldCheck, Trash2, X,
} from "lucide-react";

const FILTERS = [
  ["all", "All"],
  ["today", "Today"],
  ["upcoming", "Upcoming"],
  ["completed", "Completed"],
  ["attention", "Needs attention"],
];

const REMINDER_TYPES = [
  ["MEDICATION", "Medication"],
  ["APPOINTMENT", "Doctor appointment"],
  ["FOLLOW_UP", "Follow-up"],
  ["GENERAL", "Health task"],
  ["WATER", "Other"],
];
const EMPTY_REMINDERS = [];

const freshForm = () => ({
  title: "",
  message: "",
  reminderType: "GENERAL",
  scheduledLocal: "",
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  repeat: "ONCE",
  medicationId: "",
  appointmentId: "",
  sourceDocumentId: "",
  appointmentLeadMinutes: 60,
});

function localDateTime(value) {
  const date = value ? new Date(value) : new Date(Date.now() + 60_000);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function localDateKey(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timeZone || undefined,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDateTime(value, timeZone) {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timeZone || undefined,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
}

function reminderStatus(reminder, now) {
  if (reminder.isCompleted) return "Completed";
  if (reminder.dismissedAt) return "Dismissed";
  if (!reminder.isActive && reminder.cancelledAt) return "Cancelled";
  if (!reminder.isActive) return "Inactive";
  if (reminder.isPaused) return "Paused";
  const dueAt = new Date(reminder.scheduledAt);
  if (dueAt < now) return "Due · action needed";
  return "Saved in app";
}

function reminderMatchesFilter(reminder, filter, now, today, userTimeZone) {
  if (filter === "all") return true;
  if (filter === "completed") return reminder.isCompleted === true;
  const actionable = reminder.isActive && !reminder.isPaused && !reminder.isCompleted && !reminder.dismissedAt;
  if (filter === "today") return actionable && localDateKey(reminder.scheduledAt, userTimeZone) === today;
  if (filter === "upcoming") return actionable && new Date(reminder.scheduledAt) > now;
  if (filter === "attention") return actionable && new Date(reminder.scheduledAt) <= now;
  return true;
}

function relatedTitle(reminder) {
  if (reminder.medicationId?.medicineName) return `Medicine: ${reminder.medicationId.medicineName}`;
  if (reminder.appointmentId) {
    const appointment = reminder.appointmentId;
    return `Appointment${appointment.doctorName ? ` with ${appointment.doctorName}` : ""}`;
  }
  if (reminder.sourceDocumentId?.originalName) return `Source: ${reminder.sourceDocumentId.originalName}`;
  return "";
}

export default function Reminders({
  data,
  loadError,
  loading,
  onRetry,
  onNavigate,
  onCreate,
  onUpdate,
  onComplete,
  onDismiss,
  onPause,
  onResume,
  onCancel,
  onDownload,
  busy,
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = localDateKey(now, userTimeZone);
  const reminders = data.reminders || EMPTY_REMINDERS;
  const active = reminders.filter((item) => item.isActive && !item.isPaused && !item.isCompleted && !item.dismissedAt);
  const dueToday = active.filter((item) => localDateKey(item.scheduledAt, userTimeZone) === today);
  const upcoming = active.filter((item) => new Date(item.scheduledAt) > now);
  const needsAttention = active.filter((item) => new Date(item.scheduledAt) <= now);
  const completed = reminders.filter((item) => item.isCompleted);
  const filtered = reminders
    .filter((item) => reminderMatchesFilter(item, filter, now, today, userTimeZone))
    .filter((item) => !query.trim() || [
      item.title,
      item.message,
      item.reminderType,
      item.medicationId?.medicineName,
      item.appointmentId?.doctorName,
      item.appointmentId?.hospitalName,
      item.sourceDocumentId?.originalName,
    ].some((value) => String(value || "").toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const medications = (data.medications || []).filter((item) => item.status === "ACTIVE");
  const appointments = (data.appointments || []).filter((item) =>
    item.status === "CONFIRMED" && new Date(item.appointmentDate) >= now
  );
  const documents = (data.documents || []).filter((item) => item.documentType === "PRESCRIPTION" || item.documentType === "DISCHARGE_SUMMARY");

  function editReminder(reminder) {
    setForm({
      ...freshForm(),
      ...reminder,
      scheduledLocal: localDateTime(reminder.scheduledAt),
      medicationId: reminder.medicationId?._id || "",
      appointmentId: reminder.appointmentId?._id || "",
      sourceDocumentId: reminder.sourceDocumentId?._id || "",
      appointmentLeadMinutes: reminder.appointmentLeadMinutes ?? 0,
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!form?.scheduledLocal) return;
    const selectedAppointment = appointments.find((item) => item._id === form.appointmentId);
    const scheduledAt = selectedAppointment
      ? new Date(new Date(selectedAppointment.appointmentDate).getTime() - Number(form.appointmentLeadMinutes || 0) * 60_000)
      : new Date(form.scheduledLocal);
    if (Number.isNaN(scheduledAt.getTime())) return;
    const body = {
      title: form.title.trim(),
      message: form.message.trim(),
      reminderType: form.reminderType,
      scheduledAt: scheduledAt.toISOString(),
      timeZone: selectedAppointment?.timeZone || form.timeZone,
      repeat: form.repeat,
      medicationId: form.medicationId || null,
      appointmentId: form.appointmentId || null,
      sourceDocumentId: form.sourceDocumentId || null,
      ...(form.appointmentId ? { appointmentLeadMinutes: Number(form.appointmentLeadMinutes || 0) } : {}),
    };
    const result = form._id
      ? await onUpdate(form._id, body)
      : await onCreate(body);
    if (result) setForm(null);
  }

  function setReminderType(reminderType) {
    setForm((current) => ({
      ...current,
      reminderType,
      medicationId: reminderType === "MEDICATION" ? current.medicationId : "",
      appointmentId: reminderType === "APPOINTMENT" ? current.appointmentId : "",
    }));
  }
  const selectedAppointment = form?.appointmentId
    ? appointments.find((item) => item._id === form.appointmentId)
    : null;
  const calculatedAppointmentTime = selectedAppointment
    ? new Date(
      new Date(selectedAppointment.appointmentDate).getTime() -
      Number(form.appointmentLeadMinutes || 0) * 60_000
    )
    : "";

  return <div className="reminders-page">
    <header className="reminders-heading">
      <div><span className="workspace-eyebrow">YOUR REMINDER CENTER</span><h1>Reminders</h1><p>Stay organized with your medication schedule, upcoming appointments, and follow-up care.</p></div>
      <button className="primary-button" onClick={() => setForm(freshForm())}><Plus size={15} /> Create Reminder</button>
    </header>

    {loadError && <div className="appointment-error" role="alert">We couldn't load your reminders. Please try again. <button className="text-button" onClick={onRetry}>Retry</button></div>}
    <div className="reminder-delivery-note"><ShieldCheck size={16} /><span>Reminders are stored in your account. Automatic browser, email, push, and background delivery are not configured; a saved reminder is not a delivered notification.</span></div>

    <section className="reminder-summary-grid" aria-label="Reminder summary">
      <Summary label="Due Today" count={loadError ? "Unavailable" : loading ? "…" : dueToday.length} />
      <Summary label="Upcoming" count={loadError ? "Unavailable" : loading ? "…" : upcoming.length} />
      <Summary label="Needs Attention" count={loadError ? "Unavailable" : loading ? "…" : needsAttention.length} />
      <Summary label="Completed" count={loadError ? "Unavailable" : loading ? "…" : completed.length} />
    </section>

    <section className="panel reminders-today-panel">
      <div className="reminder-section-heading"><div><h2>Today's Reminders</h2><p>Saved reminder configurations for your local date. Due items still need your action.</p></div><CalendarDays size={18} /></div>
      {loading ? <div className="appointment-loading" role="status" aria-label="Loading today's reminders"><span /><span /><span /></div>
        : dueToday.length ? <div className="reminder-timeline">
          {[...dueToday].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)).map((item) => <ReminderCard key={item._id} reminder={item} now={now} onComplete={() => onComplete(item._id)} onDismiss={() => onDismiss(item._id)} onEdit={() => editReminder(item)} onPause={() => onPause(item._id)} onResume={() => onResume(item._id)} onCancel={() => onCancel(item._id)} onDownload={onDownload} onNavigate={onNavigate} busy={busy} compact />)}
        </div> : <Empty title="No reminders due today" detail="Create a reminder or check upcoming appointments and medication records. No dose or notification activity is inferred." actions={<><button className="secondary-button" onClick={() => onNavigate("Appointments")}><CalendarDays size={14} /> View Appointments</button><button className="secondary-button" onClick={() => onNavigate("Medications")}><Bell size={14} /> View Medications</button></>} />}
    </section>

    <section className="panel reminders-list-panel">
      <div className="reminder-list-toolbar">
        <div className="reminder-filter-tabs" role="tablist" aria-label="Reminder filters">
          {FILTERS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? "selected" : ""} onClick={() => setFilter(key)}>{label}</button>)}
        </div>
        <label className="appointment-search"><Search size={14} /><input aria-label="Search reminders" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reminders" /></label>
      </div>
      {loading ? <div className="appointment-loading" role="status" aria-label="Loading reminders"><span /><span /><span /></div>
        : filtered.length ? <div className="reminder-record-list">
          {filtered.map((item) => <ReminderCard key={item._id} reminder={item} now={now} onComplete={() => onComplete(item._id)} onDismiss={() => onDismiss(item._id)} onEdit={() => editReminder(item)} onPause={() => onPause(item._id)} onResume={() => onResume(item._id)} onCancel={() => onCancel(item._id)} onDownload={onDownload} onNavigate={onNavigate} busy={busy} />)}
        </div> : <Empty title={reminders.length ? "No matching reminders" : "No reminders yet"} detail={reminders.length ? "Try a different filter or search term." : "Create reminders for your medication schedule, doctor appointments, and follow-up care."} actions={!reminders.length && <><button className="primary-button" onClick={() => setForm(freshForm())}><Plus size={14} /> Create Reminder</button><button className="secondary-button" onClick={() => onNavigate("Appointments")}><CalendarDays size={14} /> View Appointments</button><button className="secondary-button" onClick={() => onNavigate("Medications")}><Bell size={14} /> View Medications</button></>} />}
    </section>

    {form && <div className="appointment-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setForm(null); }}>
      <section className="appointment-modal reminder-modal" role="dialog" aria-modal="true" aria-labelledby="reminder-form-title">
        <div className="panel-heading"><div><h2 id="reminder-form-title">{form._id ? "Edit reminder" : "Create Reminder"}</h2><p>Saving stores an in-app reminder; no notification is sent automatically.</p></div><button className="icon-button" aria-label="Close reminder form" onClick={() => setForm(null)}><X size={16} /></button></div>
        <form className="appointment-form-grid" onSubmit={submit}>
          <label className="wide">Reminder title<input required maxLength={150} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>Category<select value={form.reminderType} onChange={(event) => setReminderType(event.target.value)}>{REMINDER_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Repeat<select value={form.repeat} onChange={(event) => setForm({ ...form, repeat: event.target.value })}><option value="ONCE">One time</option>{form.repeat !== "ONCE" && <option value={form.repeat}>{form.repeat} · existing config</option>}</select><span>Recurring delivery is unavailable until a background scheduling service is configured.</span></label>
          {form.reminderType === "MEDICATION" && <label className="wide">Active medication<select required value={form.medicationId} onChange={(event) => setForm({ ...form, medicationId: event.target.value })}><option value="">Choose medication</option>{medications.map((med) => <option key={med._id} value={med._id}>{med.medicineName} · {[med.dosage, med.frequency].filter(Boolean).join(" · ") || "instructions not recorded"}</option>)}</select><span>Enter a reminder time below; a dose schedule is never invented.</span></label>}
          {form.reminderType === "APPOINTMENT" && <label className="wide">Confirmed appointment<select required value={form.appointmentId} onChange={(event) => setForm({ ...form, appointmentId: event.target.value })}><option value="">Choose appointment</option>{appointments.map((appointment) => <option key={appointment._id} value={appointment._id}>{appointment.doctorName || "Provider not recorded"} · {formatDateTime(appointment.appointmentDate, appointment.timeZone)}</option>)}</select></label>}
          {form.reminderType === "APPOINTMENT" && <label>Reminder lead time<select value={form.appointmentLeadMinutes} onChange={(event) => setForm({ ...form, appointmentLeadMinutes: event.target.value })}><option value="0">At appointment time</option><option value="15">15 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select></label>}
          <label>{form.reminderType === "APPOINTMENT" ? "Calculated reminder time" : "Date and time"}{selectedAppointment
            ? <output className="reminder-calculated-time">{formatDateTime(calculatedAppointmentTime, selectedAppointment.timeZone)}</output>
            : <input type="datetime-local" required value={form.scheduledLocal} min={localDateTime()} onChange={(event) => setForm({ ...form, scheduledLocal: event.target.value })} />}</label>
          <label>Time zone<input readOnly value={selectedAppointment?.timeZone || form.timeZone} aria-label="Reminder time zone" /></label>
          {form.reminderType === "FOLLOW_UP" && <label className="wide">Source record<select value={form.sourceDocumentId} onChange={(event) => setForm({ ...form, sourceDocumentId: event.target.value })}><option value="">No linked source</option>{documents.map((doc) => <option key={doc._id} value={doc._id}>{doc.originalName}</option>)}</select><span>Select only when the source explicitly records the follow-up.</span></label>}
          <label className="wide">Notes<textarea rows="3" maxLength={500} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
          <p className="wide reminder-form-honesty"><ShieldCheck size={14} /> Status after save: configured in this account. Delivery is not scheduled or guaranteed.</p>
          <div className="appointment-form-actions wide"><button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancel</button><button className="primary-button" disabled={busy || (form.reminderType === "APPOINTMENT" && !form.appointmentId) || (form.reminderType === "MEDICATION" && !form.medicationId)}><Check size={14} /> {busy ? "Saving…" : "Save Reminder"}</button></div>
        </form>
      </section>
    </div>}
  </div>;
}

function Summary({ label, count }) {
  return <article className="reminder-summary-card"><span>{label}</span><strong>{count}</strong></article>;
}

function ReminderCard({ reminder, now, onComplete, onDismiss, onEdit, onPause, onResume, onCancel, onDownload, onNavigate, busy, compact = false }) {
  const status = reminderStatus(reminder, now);
  const sourceTitle = relatedTitle(reminder);
  const due = reminder.isActive && !reminder.isPaused && !reminder.isCompleted && !reminder.dismissedAt && new Date(reminder.scheduledAt) <= now;
  const typeLabel = REMINDER_TYPES.find(([value]) => value === reminder.reminderType)?.[1] || "Reminder";
  return <article className={`reminder-record-card ${compact ? "compact" : ""}`}>
    <div className="reminder-time"><Clock3 size={14} /><time>{formatDateTime(reminder.scheduledAt, reminder.timeZone)}</time></div>
    <div className="reminder-main">
      <div className="reminder-title-line"><strong>{reminder.title}</strong><span className={`status-chip ${reminder.isCompleted ? "completed" : due ? "pending" : reminder.isActive ? "active" : "stopped"}`}>{status}</span></div>
      <span className="reminder-category">{typeLabel}{reminder.repeat !== "ONCE" ? ` · ${reminder.repeat.toLowerCase()} recurrence stored` : ""}</span>
      {sourceTitle && <small>{sourceTitle}</small>}
      {reminder.medicationId && <small>Recorded instructions: {[reminder.medicationId.dosage, reminder.medicationId.frequency].filter(Boolean).join(" · ") || "Not recorded"}</small>}
      {reminder.message && <p>{reminder.message}</p>}
      <small className="reminder-delivery-state">Configured and saved · Delivery not configured</small>
    </div>
    <div className="reminder-actions">
      {reminder.sourceDocumentId?._id && <button className="icon-button" aria-label="Open linked source document" onClick={() => onDownload(reminder.sourceDocumentId._id)}><FileHeart size={14} /></button>}
      {reminder.appointmentId && <button className="text-button" onClick={() => onNavigate("Appointments")}>View appointment</button>}
      {!reminder.isCompleted && !reminder.dismissedAt && reminder.isActive && <button className="icon-button" aria-label={`Edit ${reminder.title}`} onClick={onEdit}><Pencil size={14} /></button>}
      {due && <button className="secondary-button compact-button" onClick={onComplete} disabled={busy}><Check size={14} /> Mark reminder complete</button>}
      {reminder.isActive && !reminder.isCompleted && !reminder.dismissedAt && (reminder.isPaused
        ? <button className="icon-button" aria-label={`Resume ${reminder.title}`} onClick={onResume} disabled={busy}><Play size={14} /></button>
        : <button className="icon-button" aria-label={`Pause ${reminder.title}`} onClick={onPause} disabled={busy}><Pause size={14} /></button>)}
      {reminder.isActive && !reminder.isCompleted && !reminder.dismissedAt && <button className="text-button" onClick={onDismiss} disabled={busy}>Dismiss</button>}
      {reminder.isActive && !reminder.isCompleted && !reminder.dismissedAt && <button className="icon-button danger-icon" aria-label={`Cancel ${reminder.title}`} onClick={onCancel} disabled={busy}><Trash2 size={14} /></button>}
      {reminder.dismissedAt && <span className="reminder-dismissed-label">Dismissed by you</span>}
      {reminder.reminderType === "MEDICATION" && <small className="reminder-dose-disclaimer">Completing this reminder does not change medication records or verify a dose.</small>}
    </div>
  </article>;
}

function Empty({ title, detail, actions }) {
  return <div className="reminder-empty"><span><Bell size={19} /></span><strong>{title}</strong><p>{detail}</p>{actions && <div>{actions}</div>}</div>;
}
