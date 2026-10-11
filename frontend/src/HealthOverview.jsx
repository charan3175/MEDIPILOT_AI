import { lazy, Suspense, useState } from "react";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  Check,
  Clock3,
  Eye,
  FileHeart,
  FlaskConical,
  Plus,
  Pill,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

const AnatomyViewer = lazy(() => import("./app/components/AnatomyViewer"));

function formatDate(value) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function EmptyState({ title, detail, action }) {
  return (
    <div className="overview-empty-state">
      <strong>{title}</strong>
      <p>{detail}</p>
      {action}
    </div>
  );
}

export function HealthVisualizerPage({ findings, onOpenDocument }) {
  return (
    <>
      <div className="workspace-heading">
        <div>
          <span className="workspace-eyebrow">OPTIONAL HEALTH TOOL</span>
          <h1>AI Health Visualizer</h1>
          <p>Illustrative anatomy only. A finding is shown only when its anatomical mapping is supported.</p>
        </div>
        <span className="status-chip pending">NOT A DIAGNOSTIC TOOL</span>
      </div>
      <Suspense fallback={<div className="body-map-loading" role="status">Loading anatomy illustration…</div>}>
        <AnatomyViewer findings={findings} onOpenDocument={onOpenDocument} />
      </Suspense>
      {!findings.length && (
        <p className="inline-help"><ShieldCheck size={13} /> No verified anatomical mappings are available in your saved findings.</p>
      )}
    </>
  );
}

export default function HealthOverview({
  data,
  findings,
  user,
  goTo,
  reload,
  refreshing,
  loading,
  errors,
  onDownload,
  onRequestSummary,
  onViewTimeline,
  onViewReport,
  demoDataEnabled,
  onToggleDemoData,
}) {
  const documents = data.documents || [];
  const timeline = data.timeline || [];
  const recentDocuments = [...documents]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .slice(0, 4);
  const latestDocument = recentDocuments[0];
  const confirmedDocument = documents.find(
    (document) => document.reviewStatus === "CONFIRMED"
  );
  const findingsForReview = documents.reduce(
    (count, document) =>
      count +
      (document.extractedData || []).filter(
        (item) => item.verificationStatus !== "CONFIRMED"
      ).length,
    0
  );
  const firstName = (data.profile?.name || user?.name || "").trim().split(/\s+/)[0];
  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  });
  const summaryLanguage = {
    en: "English",
    te: "Telugu",
    hi: "Hindi",
    ta: "Tamil",
  }[data.profile?.preferredLanguage];
  const documentType = (type) =>
    ({
      LAB_REPORT: "Lab report",
      PRESCRIPTION: "Prescription",
      DIAGNOSTIC_REPORT: "Diagnostic report",
      DISCHARGE_SUMMARY: "Discharge summary",
      OTHER: "Medical record",
    })[type] || "Medical record";
  const processingLabel = (status) =>
    ({
      UPLOADED: "Uploaded",
      PROCESSING: "Processing",
      REVIEW_REQUIRED: "Needs review",
      COMPLETED: "Completed",
      FAILED: "Failed",
    })[status] || "Status unavailable";
  const findingStatus = (finding) =>
    ({
      needs_review: "Needs review",
      critical: "Critical",
      above: "High",
      below: "Low",
      within: "Normal",
      unknown: "Unknown",
    })[finding.status] || "Unknown";
  const retry = (message) => (
    <div className="overview-section-error" role="alert">
      <p>{message}</p>
      <button className="secondary-button compact-button" onClick={reload} disabled={refreshing}>
        <RefreshCw size={14} className={refreshing ? "spin" : ""} /> Retry
      </button>
    </div>
  );

  return (
    <>
      <header className="overview-welcome">
        <div>
          <span className="workspace-eyebrow">{greeting}{firstName ? `, ${firstName}` : ""} · YOUR HEALTH, IN ONE PLACE</span>
          <h1>Health Overview</h1>
          <p>{demoDataEnabled ? "Explore two fictional sample reports and their illustrative anatomy mapping." : "Your medical records, important findings, and health history—all in one place."}</p>
        </div>
        <div className="overview-welcome-actions">
          <button className="secondary-button" onClick={onViewTimeline}>
            <Activity size={15} /> View Health Timeline
          </button>
          <button
            className={`secondary-button demo-data-button${demoDataEnabled ? " active" : ""}`}
            type="button"
            onClick={onToggleDemoData}
            aria-pressed={demoDataEnabled}
          >
            <Sparkles size={15} /> Demo data {demoDataEnabled ? "On" : "Off"}
          </button>
          <button className="primary-button" onClick={() => goTo("Health records")}>
            <Plus size={15} /> Upload Medical Report
          </button>
        </div>
      </header>

      {errors.profile && errors.documents && errors.timeline ? (
        <section className="panel overview-full-error" role="alert">
          <strong>We couldn't load your health overview.</strong>
          <p>Please check your connection and try again. Your saved records have not been changed.</p>
          <button className="primary-button" onClick={reload} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? "spin" : ""} /> Try again
          </button>
        </section>
      ) : (
        <>
          <section className="overview-metrics" aria-label="Health records summary">
            {[
              {
                label: "Total medical records",
                value: errors.documents ? null : documents.length,
                detail: data.profile?.demoSample ? "Synthetic examples only" : "Saved to your account",
                Icon: FileHeart,
              },
              {
                label: "Reports processed",
                value: errors.documents
                  ? null
                  : documents.filter((item) => item.processingStatus === "COMPLETED").length,
                detail: "Successfully completed",
                Icon: Check,
              },
              {
                label: "Findings for review",
                value: errors.documents ? null : findingsForReview,
                detail: "Extracted values awaiting confirmation",
                Icon: FlaskConical,
              },
              {
                label: "Recent activity",
                value: errors.documents ? null : latestDocument ? formatDate(latestDocument.createdAt) : "—",
                detail: latestDocument ? "Most recent upload" : "No reports uploaded yet",
                Icon: Clock3,
              },
            ].map(({ label, value, detail, Icon }) => (
              <article className="overview-metric-card" key={label}>
                <span className="overview-metric-icon"><Icon size={18} /></span>
                <span className="overview-metric-label">{label}</span>
                <strong>{loading ? "…" : value ?? "No data available"}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </section>

          <div className="overview-report-layout">
            <aside className="panel overview-anatomy-panel">
              <div className="overview-anatomy-heading">
                <div>
                  <span className="workspace-eyebrow">INTERACTIVE 3D</span>
                  <h2>Explore Anatomy</h2>
                  <p>Illustrative only, not a diagnostic tool.</p>
                </div>
                <button className="text-button" onClick={() => goTo("AI Health Visualizer")}>
                  Full view <ArrowRight size={14} />
                </button>
              </div>
              <Suspense fallback={<div className="body-map-loading" role="status">Loading anatomy illustration…</div>}>
                <AnatomyViewer compact findings={findings} onOpenDocument={onDownload} />
              </Suspense>
            </aside>

            <section className="panel overview-section overview-reports-panel">
              <div className="overview-section-heading">
                <div>
                  <span className="workspace-eyebrow">YOUR RECORD LIBRARY</span>
                  <h2>Recent Medical Reports</h2>
                  <p>Check processing status, review extracted information, or open the source report.</p>
                </div>
                <button className="text-button" onClick={() => goTo("Health records")}>
                  All records <ArrowRight size={14} />
                </button>
              </div>
              {errors.documents
                ? retry("We couldn't load your medical reports. Please try again.")
                : loading
                  ? <div className="overview-loading" role="status">Loading your saved reports…</div>
                  : recentDocuments.length
                    ? <div className="overview-report-list">
                      {recentDocuments.map((document) => (
                        <article className="overview-report-card" key={document._id}>
                          <span className="overview-report-icon"><FileHeart size={18} /></span>
                          <div className="overview-report-content">
                            <strong>{document.originalName || "Medical report"}</strong>
                            <span>{documentType(document.documentType)} · {document.reportDate ? `Report date ${formatDate(document.reportDate)} · ` : ""}Uploaded {formatDate(document.createdAt)}</span>
                            <small>{(document.extractedData || []).length} extracted result{document.extractedData?.length === 1 ? "" : "s"} · {document.demoSample ? "Fictional sample values" : document.reviewStatus === "CONFIRMED" ? "Patient reviewed" : "Review may be needed"}</small>
                          </div>
                          <span className={`overview-status-chip ${String(document.processingStatus || "").toLowerCase()}`}>
                            {processingLabel(document.processingStatus)}
                          </span>
                          <div className="overview-report-actions">
                            <button className="secondary-button compact-button" onClick={() => onViewReport(document._id)}>
                              <Eye size={14} /> View Report
                            </button>
                            <button className="text-button" onClick={() => onRequestSummary(document._id)}>
                              Understand Report <ArrowRight size={13} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    : <EmptyState
                      title="No medical reports yet"
                      detail="Upload a report to organize your medical information and receive a simple explanation."
                      action={<button className="primary-button" onClick={() => goTo("Health records")}><Upload size={15} /> Upload Your First Report</button>}
                    />}
            </section>
          </div>

          <section className="panel overview-section">
            <div className="overview-section-heading">
              <div>
                <span className="workspace-eyebrow">FROM YOUR SAVED REPORTS</span>
                <h2>Important Findings</h2>
                <p>Values are shown with source context; an out-of-range result is not a diagnosis.</p>
              </div>
              <button className="text-button" onClick={() => goTo("Health records")}>
                Review records <ArrowRight size={14} />
              </button>
            </div>
            {(errors.documents || errors.labReports) && retry("Some report findings couldn't be loaded. Please try again.")}
            {loading
              ? <div className="overview-loading" role="status">Loading report findings…</div>
              : findings.length
                ? <div className="overview-finding-list">
                    {findings.slice(0, 6).map((finding) => (
                      <article className="overview-finding-card" key={finding.id}>
                        <span className={`overview-finding-status ${finding.status}`}>{findingStatus(finding)}</span>
                        <div className="overview-finding-details">
                          <strong>{finding.testName}</strong>
                          <span>{finding.value}{finding.unit ? ` ${finding.unit}` : ""}{finding.referenceRange ? ` · Reported range: ${finding.referenceRange}` : ""}</span>
                          <small>{formatDate(finding.date)}{finding.uploadDate && finding.date !== finding.uploadDate ? ` · Uploaded ${formatDate(finding.uploadDate)}` : ""} · {finding.demoSample ? "Synthetic sample, not a patient result" : finding.verificationStatus === "CONFIRMED" ? "Confirmed" : "Unverified extraction"}</small>
                          <small>Source: {finding.sourceTitle}</small>
                        </div>
                        <button className="text-button" onClick={() => finding.documentId ? onViewReport(finding.documentId) : goTo("Health records")}>
                          Open source <ArrowRight size={13} />
                        </button>
                      </article>
                    ))}
                  </div>
                : !errors.documents && !errors.labReports && <EmptyState
                  title="No structured findings yet"
                  detail="When readable report values are extracted, they will appear here with their source and verification status."
                  action={<button className="secondary-button" onClick={() => goTo("Health records")}><FileHeart size={15} /> Open My Medical Records</button>}
                />}
          </section>

          <section className="overview-summary-card">
            <span className="overview-summary-icon"><Sparkles size={22} /></span>
            <div className="overview-summary-copy">
              <span className="workspace-eyebrow">SIMPLE HEALTH SUMMARY</span>
              <h2>Understand Your Health Reports</h2>
              <p>Turn complex medical information into clear, easy-to-understand explanations grounded in your reviewed report.</p>
              <small>{summaryLanguage ? `Preferred language: ${summaryLanguage}` : "Choose a language when you explain your first report."}</small>
            </div>
            <button
              className="primary-button"
              onClick={() => confirmedDocument ? onRequestSummary(confirmedDocument._id) : latestDocument ? onRequestSummary(latestDocument._id) : goTo("Health records")}
              disabled={Boolean(errors.documents) || loading}
            >
              <Sparkles size={15} /> Explain a Report
            </button>
            <p className="overview-summary-safety"><ShieldCheck size={13} /> Informational support only. Not a diagnosis or treatment plan.</p>
          </section>

          <section className="panel overview-section">
            <div className="overview-section-heading">
              <div>
                <span className="workspace-eyebrow">YOUR SAVED HEALTH HISTORY</span>
                <h2>Your Health Timeline</h2>
                <p>Recent events from your records, sorted by recorded date.</p>
              </div>
              <button className="text-button" onClick={onViewTimeline}>
                View Full Timeline <ArrowRight size={14} />
              </button>
            </div>
            {errors.timeline
              ? retry("We couldn't load your health timeline. Please try again.")
              : loading
                ? <div className="overview-loading" role="status">Loading your health timeline…</div>
                : timeline.length
                  ? <div className="overview-timeline">
                    {timeline.slice(0, 5).map((event) => (
                      <article className="overview-timeline-event" key={event.id}>
                        <span className="overview-timeline-dot" />
                        <div>
                          <strong>{event.title || "Health record event"}</strong>
                          <span>{event.documentType?.replaceAll("_", " ") || event.type?.replaceAll("_", " ") || "Health record"}{event.details ? ` · ${event.details}` : ""}</span>
                          <small>{formatDate(event.date)}{event.dateSource ? ` · ${event.dateSource === "clinical" ? "Report date" : "Upload date"}` : ""}</small>
                        </div>
                        {(event.documentId || event.type === "DOCUMENT") && (
                          <button className="text-button" onClick={() => onViewReport(event.documentId || event.sourceId)}>
                            View source <ArrowRight size={13} />
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                  : <EmptyState
                    title="Your timeline is ready to begin"
                    detail="Uploaded reports and saved health records will appear here in date order."
                    action={<button className="primary-button" onClick={() => goTo("Health records")}><Upload size={15} /> Upload Medical Report</button>}
                  />}
          </section>

          <section className="panel overview-section">
            <div className="overview-section-heading">
              <div><span className="workspace-eyebrow">NEXT STEPS</span><h2>Quick Actions</h2></div>
            </div>
            <div className="overview-action-grid">
              <button onClick={() => goTo("Health records")}><Upload size={17} /><span><strong>Upload Medical Report</strong><small>Add a report to your records</small></span><ArrowRight size={15} /></button>
              <button onClick={() => goTo("Health records")}><FileHeart size={17} /><span><strong>Open My Medical Records</strong><small>Review documents and notes</small></span><ArrowRight size={15} /></button>
              <button onClick={() => confirmedDocument ? onRequestSummary(confirmedDocument._id) : latestDocument ? onRequestSummary(latestDocument._id) : goTo("Health records")}><Sparkles size={17} /><span><strong>Explain a Report</strong><small>Use your preferred language</small></span><ArrowRight size={15} /></button>
              <button onClick={onViewTimeline}><Activity size={17} /><span><strong>View Health Timeline</strong><small>See your saved history</small></span><ArrowRight size={15} /></button>
              <button onClick={() => goTo("Medications")}><Pill size={17} /><span><strong>My Medications</strong><small>Review saved medicines</small></span><ArrowRight size={15} /></button>
              <button onClick={() => goTo("Appointments")}><CalendarDays size={17} /><span><strong>Appointments</strong><small>Manage your schedule</small></span><ArrowRight size={15} /></button>
              <button onClick={() => goTo("AI assistant")}><BrainCircuit size={17} /><span><strong>AI Copilot</strong><small>Ask about saved records</small></span><ArrowRight size={15} /></button>
            </div>
          </section>

        </>
      )}
    </>
  );
}
