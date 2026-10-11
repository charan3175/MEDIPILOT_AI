import { useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  FileHeart,
  Languages,
  Pill,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const languages = [
  ["en", "English"],
  ["te", "తెలుగు"],
  ["hi", "हिंदी"],
  ["ta", "தமிழ்"],
];

function formatDate(value) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function PageHeading({ eyebrow, title, detail, action }) {
  return (
    <div className="workspace-heading">
      <div>
        <span className="workspace-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function LoadState({ error, loading, onRetry, empty, children }) {
  if (error) {
    return (
      <section className="panel overview-section-error" role="alert">
        <p>{error}</p>
        <button className="secondary-button compact-button" onClick={onRetry} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Retry
        </button>
      </section>
    );
  }
  if (loading) return <section className="panel overview-loading" role="status">Loading your saved health information…</section>;
  if (empty) return <section className="panel empty-state"><span><FileHeart size={21} /></span><strong>{empty.title}</strong><p>{empty.detail}</p></section>;
  return children;
}

export function HealthSummaryPage({
  documents,
  preferredLanguage,
  summary,
  loading,
  error,
  busy,
  onRetry,
  onSaveLanguage,
  onExplain,
  onReview,
  onDownload,
  onClearSummary,
}) {
  const [languageChoice, setLanguageChoice] = useState(null);
  const language = languageChoice ?? preferredLanguage ?? "";
  const [savingLanguage, setSavingLanguage] = useState(false);

  async function explain(document) {
    if (!language || busy || savingLanguage) return;
    setSavingLanguage(true);
    try {
      if (language !== preferredLanguage) {
        const saved = await onSaveLanguage(language);
        if (!saved) return;
      }
      await onExplain(document._id, language);
    } finally {
      setSavingLanguage(false);
    }
  }

  const confirmedDocuments = documents.filter((document) => document.reviewStatus === "CONFIRMED");
  const summaryDocument = summary?.documentId
    ? documents.find((document) => document._id === summary.documentId)
    : null;

  return (
    <>
      <PageHeading
        eyebrow="UNDERSTAND YOUR RECORDS"
        title="AI Health Summary"
        detail="Get a plain-language explanation of a report you have reviewed. Documented values and AI explanations remain clearly distinct."
        action={<span className="status-chip pending"><ShieldCheck size={13} /> Informational only</span>}
      />
      {!preferredLanguage && (
        <section className="panel language-picker-panel" aria-labelledby="preferred-language-heading">
          <div className="panel-heading">
            <div>
              <h2 id="preferred-language-heading"><Languages size={17} /> Choose your preferred language</h2>
              <p>Select a language before requesting your first report explanation. This preference is saved to your account.</p>
            </div>
          </div>
          <div className="summary-language-options">
            {languages.map(([code, name]) => (
              <button
                type="button"
                key={code}
                className={`summary-language-card ${language === code ? "selected" : ""}`}
                aria-pressed={language === code}
                onClick={() => setLanguageChoice(code)}
              >
                <strong>{name}</strong>
              </button>
            ))}
          </div>
        </section>
      )}
      {summary?.text && (
        <section className="panel summary-panel" aria-live="polite">
          <div className="panel-heading">
            <div>
              <h2><Sparkles size={17} /> {summaryDocument?.originalName || "Report explanation"}</h2>
              <p>AI explanation · {languages.find(([code]) => code === summary.language)?.[1] || "Selected language"}</p>
            </div>
            <button className="text-button" onClick={onClearSummary}>Close explanation</button>
          </div>
          <div className="summary-copy">{summary.text}</div>
          <p className="inline-help"><ShieldCheck size={13} /> This explanation is based on your reviewed source report. It is not a diagnosis or treatment recommendation.</p>
        </section>
      )}
      <LoadState
        error={error}
        loading={loading}
        onRetry={onRetry}
        empty={!documents.length ? {
          title: "No reports available yet",
          detail: "Upload a medical report in Health Records. Its saved information will appear here once processing is complete.",
        } : null}
      >
        <section className="panel records-panel">
          <div className="panel-heading">
            <div><h2>Reports available to explain</h2><p>Only patient-reviewed reports can be explained.</p></div>
            <label className="summary-language-select">Explanation language
              <select value={language} onChange={(event) => setLanguageChoice(event.target.value)}>
                <option value="" disabled>Select language</option>
                {languages.map(([code, name]) => <option value={code} key={code}>{name}</option>)}
              </select>
            </label>
          </div>
          {documents.length ? (
            <div className="workspace-list">
              {[...documents].sort((a, b) => new Date(b.reportDate || b.createdAt) - new Date(a.reportDate || a.createdAt)).map((document) => {
                const confirmed = document.reviewStatus === "CONFIRMED";
                return (
                  <article className="workspace-list-row" key={document._id}>
                    <span className="list-icon"><FileHeart size={17} /></span>
                    <span className="timeline-event-copy">
                      <strong>{document.originalName || "Medical report"}</strong>
                      <span>{document.documentType?.replaceAll("_", " ") || "Medical record"} · {document.reportDate ? `Report date ${formatDate(document.reportDate)}` : `Uploaded ${formatDate(document.createdAt)}`}</span>
                      <small>{document.demoSample ? "Fictional sample data" : confirmed ? "Reviewed by you" : "Review required"} · {(document.extractedData || []).length} lab finding{document.extractedData?.length === 1 ? "" : "s"} · {(document.extractedClinicalData || []).length} diagnosis/date detail{document.extractedClinicalData?.length === 1 ? "" : "s"}</small>
                    </span>
                    <span className={`status-chip ${confirmed ? "active" : "pending"}`}>{confirmed ? "REVIEWED" : "NEEDS REVIEW"}</span>
                    <div className="overview-report-actions">
                      <button className="secondary-button compact-button" onClick={() => onDownload(document._id)}><FileHeart size={14} /> Source</button>
                      {confirmed ? (
                        <button className="primary-button compact-button" disabled={!language || busy || savingLanguage} onClick={() => explain(document)}>
                          <Sparkles size={14} /> {busy || savingLanguage ? "Preparing…" : "Explain report"}
                        </button>
                      ) : (
                        <button className="secondary-button compact-button" onClick={() => onReview(document._id)}>Review in Health Records <ArrowRight size={14} /></button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="muted-copy">No uploaded reports are available.</p>
          )}
          {!confirmedDocuments.length && documents.length > 0 && (
            <p className="inline-help">Review extracted values in Health Records before requesting an explanation.</p>
          )}
        </section>
      </LoadState>
    </>
  );
}

export function HealthTimelinePage({ timeline, loading, error, onRetry, onDownload, onNavigate }) {
  const iconFor = (type) => ({
    APPOINTMENT: CalendarDays,
    MEDICATION: Pill,
    DOCUMENT: FileHeart,
    LAB_REPORT: Activity,
  })[type] || Activity;

  return (
    <>
      <PageHeading
        eyebrow="YOUR SAVED HEALTH HISTORY"
        title="Health Timeline"
        detail="A chronological view of saved records. Report dates and upload dates are labelled separately."
      />
      <LoadState
        error={error}
        loading={loading}
        onRetry={onRetry}
        empty={!timeline.length ? {
          title: "Your timeline is ready to begin",
          detail: "Uploaded reports, saved notes, medicines, and confirmed appointments will appear here.",
        } : null}
      >
        <section className="panel timeline-panel">
          <div className="panel-heading">
            <div><h2>Health events</h2><p>{timeline.length} saved event{timeline.length === 1 ? "" : "s"}</p></div>
          </div>
          <div className="workspace-list">
            {[...timeline].sort((a, b) => new Date(b.date) - new Date(a.date)).map((event) => {
              const Icon = iconFor(event.type);
              const sourceDocumentId = event.documentId || (event.type === "DOCUMENT" ? event.sourceId : null);
              const dateLabel = event.dateSource === "clinical"
                ? "Report date"
                : event.dateSource === "upload"
                  ? "Upload date"
                  : event.type === "APPOINTMENT"
                    ? "Appointment date"
                    : "Recorded date";
              return (
                <article className="workspace-list-row timeline-event-button" key={event.id}>
                  <span className="list-icon"><Icon size={17} /></span>
                  <span className="timeline-event-copy">
                    <strong>{event.title || "Health record event"}</strong>
                    <span>{event.documentType?.replaceAll("_", " ") || event.type?.replaceAll("_", " ")}{event.details ? ` · ${event.details}` : ""}</span>
                    <small>{dateLabel}: {formatDate(event.date)}{event.endDate ? ` · End date ${formatDate(event.endDate)}` : ""}</small>
                    {event.labValues?.length > 0 && (
                      <small>{event.labValues.map((value) => `${value.testName}: ${value.originalValue || value.value}${value.unit ? ` ${value.unit}` : ""} (${value.verificationStatus || "unverified"})`).join(" · ")}</small>
                    )}
                  </span>
                  {sourceDocumentId ? (
                    <button className="text-button" onClick={() => onDownload(sourceDocumentId)}>Open source <ArrowRight size={13} /></button>
                  ) : event.type === "APPOINTMENT" ? (
                    <button className="text-button" onClick={() => onNavigate("Appointments")}>Appointments <ArrowRight size={13} /></button>
                  ) : event.type === "MEDICATION" ? (
                    <button className="text-button" onClick={() => onNavigate("Medications")}>Medications <ArrowRight size={13} /></button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </LoadState>
    </>
  );
}

export function SettingsPage({ user, preferredLanguage, onSaveLanguage, onNavigate, onLogout, busy }) {
  const [languageChoice, setLanguageChoice] = useState(null);
  const language = languageChoice ?? preferredLanguage ?? "";
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function saveLanguage() {
    setNotice("");
    setError("");
    try {
      if (await onSaveLanguage(language)) setNotice("Preferred summary language saved to your account.");
      else setError("Your language preference could not be saved. Please try again.");
    } catch (saveError) {
      setError(saveError.message || "Your language preference could not be saved.");
    }
  }

  return (
    <>
      <PageHeading eyebrow="ACCOUNT" title="Profile & Settings" detail="Review your account profile, explanation language, privacy, and supported preferences." />
      <div className="workspace-columns">
        <section className="panel form-panel">
          <div className="panel-heading"><div><h2>Profile</h2><p>Details supplied to your account.</p></div></div>
          <div className="settings-user">
            <span className="profile-avatar large-avatar">{(user.name || user.email || "P").split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
            <div><strong>{user.name || "Patient"}</strong><span>{user.email}</span>{user.phone && <span>{user.phone}</span>}</div>
          </div>
          <p className="inline-help">Profile editing is not available in this version. These values are displayed from your authenticated account.</p>
          <button className="secondary-button danger-button" onClick={onLogout}>Sign out</button>
        </section>
        <section className="panel form-panel">
          <div className="panel-heading"><div><h2>Language preferences</h2><p>Used for report explanations. Changing language does not rerun OCR.</p></div></div>
          <label className="field-wide">Preferred explanation language
            <select
              value={language}
              onChange={(event) => setLanguageChoice(event.target.value)}
            >
              <option value="" disabled>Select a language</option>
              {languages.map(([code, name]) => <option value={code} key={code}>{name}</option>)}
            </select>
          </label>
          <button className="primary-button" onClick={saveLanguage} disabled={!language || busy}>Save language</button>
          {notice && <p className="form-alert success" role="status">{notice}</p>}
          {error && <p className="form-alert error" role="alert">{error}</p>}
        </section>
        <section className="panel form-panel">
          <div className="panel-heading"><div><h2>Privacy & security</h2><p>Your account-scoped data controls.</p></div><ShieldCheck size={19} /></div>
          <p>Medical records are loaded through authenticated, patient-scoped endpoints. Original documents are served only after server-side ownership checks.</p>
          <div className="settings-shortcuts">
            <button className="secondary-button" onClick={() => onNavigate("Share with Hospital")}>Review patient-controlled sharing</button>
            <button className="secondary-button" onClick={() => onNavigate("ABHA profile")}>Open ABHA prototype settings</button>
          </div>
          <p className="inline-help">Reminder delivery is not configured. Saved reminders remain in-app and do not guarantee a notification.</p>
        </section>
      </div>
    </>
  );
}
