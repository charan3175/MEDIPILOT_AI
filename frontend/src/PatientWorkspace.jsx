import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowRight, Bell, BrainCircuit, CalendarDays,
  Building2, Check, Clock3, Download, Eye, EyeOff, FileHeart, FileJson,
  HeartPulse, Home, Languages, LogOut, Menu, MessageCircle, Moon,
  Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Pill, Plus, Printer,
  QrCode, RefreshCw, RotateCcw, Search, Send, Share2, ShieldCheck, Sparkles,
  Sun, Upload, UserRound, X,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useAuth } from "./context/AuthContext";
import { api } from "./services/api";
import { filterHealthDocuments } from "./services/healthDocuments";
import { buildBodyFindings } from "./services/healthInsights";
import { getClinicExchangeTimeline } from "./services/clinicExchange";
import {
  createDemoHealthData,
  DEMO_MODE_KEY,
  demoReportSummary,
} from "./services/demoHealthData";
import FoodDailyHabits from "./FoodDailyHabits";
import DoctorAppointments from "./DoctorAppointments";
import Medications from "./Medications";
import RemindersPage from "./Reminders";
import HealthOverview, { HealthVisualizerPage } from "./HealthOverview";
import {
  HealthSummaryPage,
  HealthTimelinePage,
  SettingsPage,
} from "./HealthJourneyPages";
import "./App.css";

const navigationGroups = [
  {
    title: "YOUR HEALTH",
    items: [
      ["Overview", "Health Overview", Home],
      ["Health records", "Health Records", FileHeart],
      ["AI Health Summary", "AI Health Summary", Sparkles],
      ["Food & Daily Habits", "Food & Daily Habits", Activity],
      ["Medications", "My Medications", Pill],
      ["Appointments", "Appointments", CalendarDays],
      ["Reminders", "Reminders", Bell],
      ["AI assistant", "AI Copilot", BrainCircuit],
    ],
  },
  {
    title: "HEALTH TOOLS",
    items: [
      ["AI Health Visualizer", "AI Health Visualizer", Activity],
      ["Clinic exchange", "Cross-facility exchange (simulation)", Building2, "SIMULATION"],
    ],
  },
  {
    title: "HOSPITAL SHARING",
    items: [
      ["Share with Hospital", "Share with Hospital", Building2, "PROTOTYPE"],
    ],
  },
  {
    title: "HEALTH DATA",
    items: [
      ["FHIR export", "FHIR-ready health records", FileJson],
      ["ABHA profile", "ABHA profile (prototype)", ShieldCheck, "PROTOTYPE"],
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      ["Settings", "Profile & Settings", UserRound],
    ],
  },
];

const labels = {
  hi: {
    "Health Overview": "स्वास्थ्य अवलोकन",
    "Health Records": "स्वास्थ्य रिकॉर्ड",
    "Food & Daily Habits": "भोजन और दैनिक आदतें",
    "My Medications": "दवाइयाँ",
    Appointments: "अपॉइंटमेंट",
    Reminders: "रिमाइंडर",
    "AI Copilot": "AI सहायक",
    "Profile & Settings": "प्रोफ़ाइल और सेटिंग्स",
  },
};

const workspaceRoutes = {
  Overview: "overview",
  "Health records": "health-records",
  "AI Health Summary": "ai-health-summary",
  "Health Timeline": "health-timeline",
  "Food & Daily Habits": "food-daily-habits",
  Medications: "medications",
  Appointments: "appointments",
  Reminders: "reminders",
  "AI assistant": "ai-copilot",
  "AI Health Visualizer": "ai-health-visualizer",
  "Clinic exchange": "cross-facility-exchange",
  "FHIR export": "fhir-ready-health-records",
  "Share with Hospital": "share-with-hospital",
  "ABHA profile": "abha-profile",
  Settings: "settings",
};

function pageFromHash(hash) {
  const route = hash.replace(/^#/, "");
  if (route === "my-health-id" || route === "patient-controlled-sharing") return "Share with Hospital";
  if (route === "health-timeline") return "Overview";
  return Object.entries(workspaceRoutes).find(([, slug]) => slug === route)?.[0] || "Overview";
}

function requesterRoleLabel(role) {
  return ({
    physician: "Physician",
    nurse: "Nurse",
    technician: "Technician",
    administrator: "Administrator",
    other: "Other role",
  })[role] || "Role not provided";
}

function purposeLabel(purpose) {
  return ({
    care: "Care consultation",
    "diagnostic-review": "Diagnostic review",
    "follow-up": "Follow-up care",
    other: "Other",
  })[purpose] || "Purpose not provided";
}

const freshData = {
  profile: null,
  documents: [],
  timeline: [],
  records: [],
  appointments: [],
  appointmentSuggestions: [],
  medications: [],
  medicationSuggestions: [],
  labReports: [],
  reminders: [],
  conversations: [],
  abha: null,
  aiStatus: null,
};

function formatDate(value, withTime = false) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

function messageFrom(error) {
  return error?.message || "Something went wrong. Please try again.";
}

const welcomeSlides = [
  {
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1500&q=85",
    alt: "Clinician reviewing health information on a tablet",
    label: "Your records, in context",
  },
  {
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1500&q=85",
    alt: "Care team discussing a patient's health",
    label: "A clearer conversation with your care team",
  },
  {
    image: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=1500&q=85",
    alt: "Healthcare professional preparing patient records",
    label: "The details that matter, together",
  },
];

const welcomeQuotes = [
  { quote: "When your health details are organized, better questions have room to emerge.", source: "A note from MEDIPILOT AI" },
  { quote: "Clarity can turn a stack of reports into a more thoughtful conversation.", source: "A note from MEDIPILOT AI" },
  { quote: "Your health story deserves context, care, and your voice.", source: "A note from MEDIPILOT AI" },
];

function AuthScreen({ onLogin, onGoogleLogin, onRegister, onForgotPassword, onResetPassword, onStartDemo }) {
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get("resetToken") || "");
  const [authMode, setAuthMode] = useState(() => resetToken ? "reset" : "");
  const [slide, setSlide] = useState(0);
  const [quote, setQuote] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const googleButtonRef = useRef(null);
  const registering = authMode === "register";

  useEffect(() => {
    if (!resetToken) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("resetToken");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [resetToken]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      setSlide((current) => (current + 1) % welcomeSlides.length);
      setQuote((current) => (current + 1) % welcomeQuotes.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authMode) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setAuthMode("");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [authMode]);

  useEffect(() => {
    if (authMode !== "login" || !import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      setGoogleReady(false);
      return undefined;
    }

    let cancelled = false;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    function renderGoogleButton() {
      const google = window.google;
      if (
        cancelled ||
        !googleButtonRef.current ||
        !google?.accounts?.id
      ) {
        return;
      }

      google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          if (!credential) {
            setError("Google sign-in did not return a credential. Please try again.");
            return;
          }

          setError("");
          setBusy(true);
          try {
            await onGoogleLogin(credential);
          } catch (requestError) {
            setError(messageFrom(requestError));
          } finally {
            setBusy(false);
          }
        },
      });
      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 380,
      });
      setGoogleReady(true);
    }

    let script = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else if (script) {
      script.addEventListener("load", renderGoogleButton);
      script.addEventListener("error", handleScriptError);
    } else {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderGoogleButton);
      script.addEventListener("error", handleScriptError);
      document.head.appendChild(script);
    }

    function handleScriptError() {
      if (!cancelled) {
        setError("Google sign-in could not load. Check your connection and try again.");
      }
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", renderGoogleButton);
      script?.removeEventListener("error", handleScriptError);
    };
  }, [authMode, onGoogleLogin]);

  function openAuth(mode) {
    setAuthMode(mode);
    setError("");
    setSuccess("");
    setShowPassword(false);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());

    if (!registering && !values.email && !values.password) {
      setAuthMode("guest");
      return;
    }

    if (!registering && (!values.email || !values.password)) {
      setError("Enter both your email and password, or leave both blank for the local demo.");
      return;
    }

    setBusy(true);
    try {
      if (registering) {
        await onRegister({
          name: values.name,
          email: values.email,
          password: values.password,
          phone: values.phone,
        });
        setAuthMode("login");
        setSuccess("Account created. Sign in to open your health workspace.");
      } else {
        await onLogin(values.email, values.password);
      }
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function submitDemo(event) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();

    if (!name) {
      setError("Enter your name to continue.");
      return;
    }

    onStartDemo(name.slice(0, 100));
  }

  async function submitForgotPassword(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    const form = new FormData(event.currentTarget);

    try {
      await onForgotPassword(form.get("email"));
      setSuccess("If an account exists with this email, a password reset link will be sent.");
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function submitPasswordReset(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const password = form.get("password");

    if (password !== form.get("confirmPassword")) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await onResetPassword(resetToken, password);
      setResetToken("");
      setAuthMode("login");
      setSuccess("Password updated. Sign in with your new password.");
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="welcome-page">
      <header className="welcome-header">
        <a className="welcome-brand" href="#top" aria-label="MEDIPILOT AI home"><span><HeartPulse size={21} /></span><strong>MEDIPILOT <i>AI</i></strong></a>
        <nav className="welcome-nav" aria-label="Main navigation"><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#care-values">Our approach</a></nav>
        <div className="welcome-actions"><button className="welcome-signin" onClick={() => openAuth("login")}>Sign in</button><button className="welcome-register" onClick={() => openAuth("register")}>Create account <ArrowRight size={15} /></button></div>
      </header>

      <section className="welcome-hero" id="top">
        <div className="welcome-hero-copy">
          <div className="welcome-kicker"><span /> A PERSONAL HEALTH COPILOT</div>
          <h1>Your health story,<br /><em>all in one place.</em></h1>
          <p>Bring reports, prescriptions, appointments, and everyday health notes together. Understand what your records say and keep the next conversation moving.</p>
          <div className="welcome-hero-actions"><button className="welcome-register large" onClick={() => openAuth("register")}>Create your private space <ArrowRight size={16} /></button><a href="#features">Explore the features <span>↓</span></a></div>
          <div className="welcome-proof"><ShieldCheck size={16} /><span>Private patient workspace</span><i /> <span>Record-based explanations</span></div>
        </div>
        <div className="welcome-visual" aria-label="Healthcare image slideshow">
          {welcomeSlides.map((item, index) => <img key={item.image} className={`welcome-slide ${slide === index ? "active" : ""}`} src={item.image} alt={item.alt} aria-hidden={slide !== index} />)}
          <div className="welcome-visual-shade" />
          <div className="welcome-image-caption"><span>MEDIPILOT AI, IN YOUR CORNER</span><strong>{welcomeSlides[slide].label}</strong></div>
          <div className="welcome-slide-controls" aria-label="Image slideshow controls">{welcomeSlides.map((item, index) => <button key={item.image} className={slide === index ? "active" : ""} aria-label={`Show image ${index + 1}: ${item.label}`} aria-pressed={slide === index} onClick={() => setSlide(index)} />)}</div>
          <div className="welcome-visual-mark"><Activity size={19} /><span>CARE, CONNECTED</span></div>
        </div>
        <div className="welcome-hero-foot"><span>ONE CALMER PLACE FOR THE DETAILS</span><span>01 — 03</span></div>
      </section>

      <section className="welcome-feature-section" id="features">
        <div className="welcome-section-heading"><span className="welcome-kicker">BUILT AROUND YOUR CARE JOURNEY</span><h2>Less searching.<br /><em>More understanding.</em></h2><p>Useful context for the everyday work of looking after your health, grounded in the information you choose to save.</p></div>
        <div className="welcome-feature-grid">
          <article className="welcome-feature"><span className="welcome-feature-icon mint"><FileHeart size={20} /></span><small>01 / RECORDS</small><h3>One health timeline</h3><p>Keep lab reports, prescriptions, and personal notes together, with dates and source details close at hand.</p></article>
          <article className="welcome-feature"><span className="welcome-feature-icon coral"><Sparkles size={20} /></span><small>02 / EXPLANATIONS</small><h3>Plain-language summaries</h3><p>Ask about saved information and review report values with source-linked context, not invented conclusions.</p></article>
          <article className="welcome-feature"><span className="welcome-feature-icon blue"><CalendarDays size={20} /></span><small>03 / NEXT STEPS</small><h3>Care details in reach</h3><p>Keep appointments, medication lists, and reminders together so the practical details are easier to revisit.</p></article>
        </div>
      </section>

      <section className="welcome-quote-section" id="care-values" aria-live="polite">
        <div className="welcome-quote-mark">“</div><div><span className="welcome-kicker">A THOUGHT TO CARRY WITH YOU</span><blockquote>{welcomeQuotes[quote].quote}</blockquote><p>{welcomeQuotes[quote].source}</p></div>
        <div className="welcome-quote-controls">{welcomeQuotes.map((item, index) => <button key={item.quote} className={quote === index ? "active" : ""} aria-label={`Show quote ${index + 1}`} aria-pressed={quote === index} onClick={() => setQuote(index)} />)}</div>
      </section>

      <section className="welcome-how" id="how-it-works"><div><span className="welcome-kicker">A SIMPLE PLACE TO BEGIN</span><h2>Bring the pieces together.<br /><em>Take your time with the rest.</em></h2></div><button className="welcome-register" onClick={() => openAuth("register")}>Start with your records <ArrowRight size={15} /></button><p>Upload a document, review what was extracted, and use your saved records as context for your questions. Your care team remains the source for medical decisions.</p></section>

      <footer className="welcome-footer"><a className="welcome-brand" href="#top"><span><HeartPulse size={18} /></span><strong>MEDIPILOT <i>AI</i></strong></a><span>Informational support, not a diagnosis or treatment plan.</span><a href="#top">Back to top ↑</a></footer>

      {authMode && <div className="auth-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthMode(""); }}>
        <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button type="button" className="auth-modal-close" aria-label="Close account form" onClick={() => setAuthMode("")}><X size={19} /></button>
          <div className="auth-modal-brand"><span><HeartPulse size={19} /></span><strong>MEDIPILOT <i>AI</i></strong></div>
          <span className="welcome-kicker">{authMode === "forgot" ? "ACCOUNT ACCESS" : authMode === "guest" ? "LOCAL PROTOTYPE" : "YOUR PRIVATE HEALTH SPACE"}</span>
          <h2 id="auth-title">{authMode === "forgot" ? "Password recovery" : authMode === "reset" ? "Set a new password." : authMode === "guest" ? "What should we call you?" : registering ? "Create your account." : "Welcome back."}</h2>
          {authMode === "guest" ? <>
            <p className="auth-modal-intro">Enter only your name. Guest records stay in this browser tab and are deleted when you log out. Connected AI, OCR, and secure external sharing require an account.</p>
            <form className="auth-form" onSubmit={submitDemo}>
              <label>Your name<input name="name" autoComplete="name" autoFocus required maxLength={100} /></label>
              {error && <p className="form-alert error" role="alert">{error}</p>}
              <button className="welcome-register auth-submit" type="submit">Continue as guest <ArrowRight size={15} /></button>
            </form>
            <button className="auth-modal-switch" onClick={() => { setAuthMode("login"); setError(""); }}>Back to sign in</button>
          </> : authMode === "forgot" ? <>
            <p className="auth-modal-intro">Enter the email address linked to your account. If it is registered, we’ll send a secure, time-limited reset link.</p>
            <form className="auth-form" onSubmit={submitForgotPassword}>
              <label>Email address<input name="email" type="email" autoComplete="email" autoFocus required /></label>
              {error && <p className="form-alert error" role="alert">{error}</p>}
              {success && <p className="form-alert success" role="status">{success}</p>}
              <button className="welcome-register auth-submit" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"} <ArrowRight size={15} /></button>
            </form>
            <button className="auth-modal-switch" onClick={() => { setAuthMode("login"); setSuccess(""); }}>Back to sign in</button>
          </> : authMode === "reset" ? <>
            <p className="auth-modal-intro">Choose a new password for your account. Reset links expire after 30 minutes.</p>
            <form className="auth-form" onSubmit={submitPasswordReset}>
              <label className="auth-password-label"><span>New password</span><span className="auth-password-control"><input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" autoFocus minLength={8} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
              <small className="auth-password-hint">Use at least 8 characters.</small>
              <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
              {error && <p className="form-alert error" role="alert">{error}</p>}
              <button className="welcome-register auth-submit" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"} <ArrowRight size={15} /></button>
            </form>
            <button className="auth-modal-switch" onClick={() => { setAuthMode("forgot"); setResetToken(""); setError(""); setSuccess(""); }}>Request another reset link</button>
          </> : <>
            <p className="auth-modal-intro">{registering ? "Start with the basics. You can add health records after sign-in." : "Sign in with your account, or leave both fields blank to continue with the local prototype."}</p>
            <form className="auth-form" onSubmit={submit}>
              {registering && <label>Full name<input name="name" autoComplete="name" autoFocus required maxLength={100} /></label>}
              {registering && <label>Mobile number<input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="e.g. +91 98765 43210" required /></label>}
              <label>Email address<input name="email" type="email" autoComplete="email" autoFocus={!registering} required={registering} /></label>
              <label className="auth-password-label"><span>Password</span><span className="auth-password-control"><input name="password" type={showPassword ? "text" : "password"} autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 8 : undefined} required={registering} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
              {registering && <small className="auth-password-hint">Use at least 8 characters.</small>}
              {!registering && <button type="button" className="auth-forgot" onClick={() => { setAuthMode("forgot"); setError(""); setSuccess(""); }}>Forgot password?</button>}
              {error && <p className="form-alert error" role="alert">{error}</p>}
              {success && <p className="form-alert success" role="status">{success}</p>}
              <button className="welcome-register auth-submit" disabled={busy}>{busy ? "Please wait…" : registering ? "Create patient account" : "Sign in securely"}<ArrowRight size={15} /></button>
            </form>
              {!registering && import.meta.env.VITE_GOOGLE_CLIENT_ID && <div className="google-signin">
                <span>or continue with</span>
                <div ref={googleButtonRef} className="google-signin-button" aria-busy={!googleReady || busy} />
              </div>}
              {!registering && <button className="auth-modal-switch" onClick={() => { setAuthMode("guest"); setError(""); setSuccess(""); }}>Continue as guest with name only</button>}
              <button className="auth-modal-switch" onClick={() => openAuth(registering ? "login" : "register")}>{registering ? "Already have an account? Sign in" : "New to MEDIPILOT AI? Create an account"}</button>
          </>}
          <p className="auth-modal-safety"><ShieldCheck size={14} /> {authMode === "guest" ? "Guest data stays in this tab and is deleted when you log out." : "Medical information appears only after sign-in."}</p>
        </section>
      </div>}
    </main>
  );
}

function PageHeading({ eyebrow, title, detail, action }) {
  return (
    <div className="workspace-heading">
      <div><span className="workspace-eyebrow">{eyebrow}</span><h1>{title}</h1>{detail && <p>{detail}</p>}</div>
      {action}
    </div>
  );
}

function EmptyState({ icon: Icon = FileHeart, title, detail, action }) {
  return <div className="empty-state"><span><Icon size={21} /></span><strong>{title}</strong><p>{detail}</p>{action}</div>;
}

function HealthRecords({ data, onUpload, onCreateRecord, onSummarize, onReviewDocument, onSaveReview, onSaveLanguage, onDownload, onViewReport, busy, summary, clearSummary, initialSummaryDocumentId, onConsumeInitialSummary, initialDocumentId, onConsumeInitialDocument, demoDataEnabled }) {
  const [file, setFile] = useState(null);
  const [documentType, setDocumentType] = useState("LAB_REPORT");
  const [ocrLanguage, setOcrLanguage] = useState("eng");
  const [recordOpen, setRecordOpen] = useState(false);
  const [reviewedDocuments, setReviewedDocuments] = useState({});
  const [editingDocumentId, setEditingDocumentId] = useState("");
  const [reviewDraft, setReviewDraft] = useState([]);
  const [reviewClinicalDraft, setReviewClinicalDraft] = useState([]);
  const [reviewDocumentType, setReviewDocumentType] = useState("OTHER");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentCategory, setDocumentCategory] = useState("ALL");
  const [processingFilter, setProcessingFilter] = useState("ALL");
  const [reviewFilter, setReviewFilter] = useState("ALL");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [documentSort, setDocumentSort] = useState("newest");
  const [recordListView, setRecordListView] = useState("list");
  const [languageDocumentId, setLanguageDocumentId] = useState("");
  const [summaryLanguage, setSummaryLanguage] = useState(data.profile?.preferredLanguage || "");
  const [summaryLanguageBusy, setSummaryLanguageBusy] = useState(false);
  const initialSummaryAction = useRef(null);
  const initialDocumentAction = useRef(null);

  useEffect(() => {
    if (data.profile?.preferredLanguage) {
      setSummaryLanguage(data.profile.preferredLanguage);
    }
  }, [data.profile?.preferredLanguage]);

  async function reviewDocument(id) {
    const result = await onReviewDocument(id);
    if (result) {
      setReviewedDocuments((current) => ({ ...current, [id]: result }));
      setReviewDraft((result.extractedData || []).map((item) => ({
        testName: item.testName || "",
        value: item.originalValue || String(item.value ?? ""),
        unit: item.unit || "",
        referenceRange: item.referenceRange || "",
      })));
      setReviewClinicalDraft((result.extractedClinicalData || []).map((item) => ({
        fieldType: item.fieldType,
        label: item.label || "",
        value: item.value || "",
      })));
      setReviewDocumentType(result.documentType || "OTHER");
    }
    return result;
  }

  function beginReview(doc) {
    setEditingDocumentId(doc._id);
    const detail = reviewedDocuments[doc._id] || doc;
    setReviewDraft((detail.extractedData || []).map((item) => ({
      testName: item.testName || "",
      value: item.originalValue || String(item.value ?? ""),
      unit: item.unit || "",
      referenceRange: item.referenceRange || "",
    })));
    setReviewClinicalDraft((detail.extractedClinicalData || []).map((item) => ({
      fieldType: item.fieldType,
      label: item.label || "",
      value: item.value || "",
    })));
    setReviewDocumentType(detail.documentType || "OTHER");
    if (!detail.extractedText) reviewDocument(doc._id);
  }

  useEffect(() => {
    initialSummaryAction.current = () => {
      if (!initialSummaryDocumentId) return;
      const document = data.documents.find((item) => item._id === initialSummaryDocumentId);
      if (document?.reviewStatus === "CONFIRMED") {
        setSummaryLanguage(data.profile?.preferredLanguage || "");
        setLanguageDocumentId(initialSummaryDocumentId);
      } else if (document) {
        beginReview(document);
      }
      onConsumeInitialSummary();
    };
  });

  useEffect(() => {
    initialSummaryAction.current?.();
  }, [initialSummaryDocumentId]);

  useEffect(() => {
    initialDocumentAction.current = () => {
      if (!initialDocumentId) return;
      const document = data.documents.find((item) => item._id === initialDocumentId);
      if (document) {
        setSelectedDocumentId(initialDocumentId);
        if (!document.extractedText) reviewDocument(initialDocumentId);
      }
      onConsumeInitialDocument();
    };
  });

  useEffect(() => {
    initialDocumentAction.current?.();
  }, [initialDocumentId]);

  async function saveReview(id) {
    const saved = await onSaveReview(id, reviewDraft, reviewDocumentType, reviewClinicalDraft);
    if (saved?.document) {
      setReviewedDocuments((current) => ({
        ...current,
        [id]: { ...current[id], ...saved.document },
      }));
      setEditingDocumentId("");
    }
  }

  async function generateSummary(id) {
    if (!summaryLanguage) {
      setLanguageDocumentId(id);
      return;
    }
    await onSummarize(id, summaryLanguage);
  }

  async function selectSummaryLanguage() {
    if (!languageDocumentId || !summaryLanguage) return;
    setSummaryLanguageBusy(true);
    try {
      const saved = await onSaveLanguage(summaryLanguage);
      if (saved) {
        const docId = languageDocumentId;
        setLanguageDocumentId("");
        await onSummarize(docId, summaryLanguage);
      }
    } finally {
      setSummaryLanguageBusy(false);
    }
  }

  async function upload(event) {
    event.preventDefault();
    if (!file) return;
    const formElement = event.currentTarget;
    const form = new FormData();
    form.append("file", file);
    form.append("documentType", documentType);
    form.append("ocrLanguage", ocrLanguage);
    const uploaded = await onUpload(form);
    if (uploaded) {
      setFile(null);
      formElement.reset();
    }
  }

  async function saveRecord(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = form.get("value");
    const saved = await onCreateRecord({
      recordType: form.get("recordType"),
      title: form.get("title"),
      details: form.get("details"),
      ...(value ? { value: Number(value), unit: form.get("unit") } : {}),
    });
    if (saved) {
      formElement.reset();
      setRecordOpen(false);
    }
  }

  const documents = data.documents || [];
  const filteredDocuments = filterHealthDocuments(documents, {
    search: documentSearch,
    category: documentCategory,
    processing: processingFilter,
    review: reviewFilter,
    dateFrom: reportDateFrom,
    dateTo: reportDateTo,
    sort: documentSort,
  });
  const needsReviewCount = documents.filter(
    (document) => document.reviewStatus === "REVIEW_REQUIRED"
  ).length;
  const selectedDocument = documents.find((document) => document._id === selectedDocumentId);
  const selectedDetail = selectedDocument
    ? reviewedDocuments[selectedDocumentId] || selectedDocument
    : null;
  const documentTypeLabel = (type) => ({
    LAB_REPORT: "Lab report",
    PRESCRIPTION: "Prescription",
    DIAGNOSTIC_REPORT: "Diagnostic report",
    DISCHARGE_SUMMARY: "Discharge summary",
    OTHER: "Unclassified document",
  })[type] || "Unclassified document";
  const processingStatusLabel = (status) => ({
    UPLOADED: "Uploaded",
    PROCESSING: "Processing",
    REVIEW_REQUIRED: "Needs Review",
    COMPLETED: "Completed",
    FAILED: "Failed",
  })[status] || "Status unavailable";
  const ocrLanguageLabel = (value) => ({
    eng: "English",
    "eng+hin": "English + Hindi",
    "eng+tel": "English + Telugu",
    "eng+tam": "English + Tamil",
  })[value] || "Language unavailable";

  return <>
    <PageHeading eyebrow="YOUR HEALTH HISTORY" title="Health records" detail="Upload a report, review extracted text, and keep important details together." action={<button className="secondary-button" onClick={() => setRecordOpen(!recordOpen)} disabled={demoDataEnabled}><Plus size={15} /> Add a note</button>} />
    {demoDataEnabled && <div className="sharing-prototype-note"><ShieldCheck size={15} /> The reports below are synthetic examples with illustrative values and reference intervals. They are read-only and are not real patient records.</div>}
    <section className="panel upload-panel"><form className="upload-form" onSubmit={upload}><label className="upload-drop"><input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0] || null)} required /><span className="upload-icon"><Upload size={20} /></span><strong>{file?.name || "Choose a medical document"}</strong><small>PDF, JPG or PNG · Maximum 10 MB · Scanned PDFs are not yet supported</small></label><label className="field-label">Document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option value="LAB_REPORT">Lab report</option><option value="PRESCRIPTION">Prescription</option><option value="DIAGNOSTIC_REPORT">Diagnostic report</option><option value="DISCHARGE_SUMMARY">Discharge summary</option><option value="OTHER">Other medical record</option></select></label><label className="field-label">Image OCR language<select value={ocrLanguage} onChange={(event) => setOcrLanguage(event.target.value)}><option value="eng">English</option><option value="eng+hin">English + Hindi</option><option value="eng+tel">English + Telugu</option><option value="eng+tam">English + Tamil</option></select></label><button className="primary-button" disabled={!file || busy}><Upload size={15} />{busy ? "Uploading and extracting…" : "Upload and extract"}</button></form><p className="inline-help"><ShieldCheck size={13} /> OCR runs locally on the server. Handwriting recognition is best-effort; compare every extracted detail with the original. Extracted values require your review before they can be explained.</p></section>
    {recordOpen && <section className="panel form-panel"><div className="panel-heading"><div><h2>Add a health note</h2><p>Record a condition, allergy, vital, medication, or personal note.</p></div><button className="icon-button" aria-label="Close form" onClick={() => setRecordOpen(false)}><X size={16} /></button></div><form className="form-grid" onSubmit={saveRecord}><label>Record type<select name="recordType"><option value="NOTE">Personal note</option><option value="CONDITION">Condition</option><option value="ALLERGY">Allergy</option><option value="VITAL">Vital</option><option value="MEDICATION">Medication</option></select></label><label>Title<input name="title" required maxLength={160} placeholder="e.g. Seasonal allergy" /></label><label className="field-wide">Details<textarea name="details" rows="3" maxLength={2000} placeholder="Add context that may help you or your care team." /></label><label>Value <span className="optional-label">Optional</span><input name="value" type="number" step="any" /></label><label>Unit <span className="optional-label">Optional</span><input name="unit" maxLength={40} placeholder="e.g. mmHg" /></label><div className="field-wide"><button className="primary-button" disabled={busy}>Save health note</button></div></form></section>}
    {languageDocumentId && <section className="panel language-picker-panel" aria-labelledby="summary-language-heading"><div className="panel-heading"><div><h2 id="summary-language-heading">Choose Your Preferred Language</h2><p>Select the language in which you want us to explain your health report.</p></div><button className="icon-button" aria-label="Cancel language selection" onClick={() => setLanguageDocumentId("")}><X size={16} /></button></div><div className="summary-language-options">{[["en", "English", "Explain my report in English"], ["te", "తెలుగు", "నా రిపోర్ట్‌ను తెలుగులో వివరించండి"], ["hi", "हिंदी", "मेरी रिपोर्ट हिंदी में समझाएं"], ["ta", "தமிழ்", "என் அறிக்கையை தமிழில் விளக்குங்கள்"]].map(([code, name, subtitle]) => <button type="button" key={code} className={`summary-language-card ${summaryLanguage === code ? "selected" : ""}`} aria-pressed={summaryLanguage === code} onClick={() => setSummaryLanguage(code)}><strong>{name}</strong><span>{subtitle}</span></button>)}</div><button className="primary-button" disabled={!summaryLanguage || summaryLanguageBusy || busy} onClick={selectSummaryLanguage}>{summaryLanguageBusy ? "Preparing explanation…" : "Continue"}</button></section>}
    {summary && <section className="panel summary-panel"><div className="panel-heading"><div><h2><Sparkles size={17} /> Plain-language explanation</h2><p>Source-grounded informational support · {({ en: "English", te: "తెలుగు", hi: "हिंदी", ta: "தமிழ்" })[summary.language] || "Selected language"}</p></div><div className="summary-actions"><button className="secondary-button compact-button" onClick={() => { setLanguageDocumentId(summary.documentId); setSummaryLanguage(summary.language || ""); }}>Change language</button><button className="icon-button" aria-label="Close summary" onClick={clearSummary}><X size={16} /></button></div></div><div className="summary-copy">{summary.text}</div><p className="inline-help"><ShieldCheck size={13} /> This explanation uses reported values from the source and is not a diagnosis or treatment recommendation. Discuss personal decisions with a qualified clinician.</p></section>}
    <section className="panel records-panel">
      <div className="panel-heading"><div><h2>Uploaded documents</h2><p>{documents.length} document{documents.length === 1 ? "" : "s"} in your private library</p></div></div>
      <div className="record-summary-grid">
        <div><strong>{documents.length}</strong><span>Total documents</span></div>
        <div><strong>{documents.filter((doc) => doc.processingStatus === "COMPLETED").length}</strong><span>Processed</span></div>
        <div><strong>{needsReviewCount}</strong><span>Needs your review</span></div>
      </div>
      <div className="record-view-toggle" role="group" aria-label="Document layout">
        <button type="button" className={recordListView === "list" ? "active" : ""} aria-pressed={recordListView === "list"} onClick={() => setRecordListView("list")}>List</button>
        <button type="button" className={recordListView === "grid" ? "active" : ""} aria-pressed={recordListView === "grid"} onClick={() => setRecordListView("grid")}>Grid</button>
      </div>
      <div className="record-filter-toolbar">
        <label className="record-search"><Search size={15} /><input value={documentSearch} onChange={(event) => setDocumentSearch(event.target.value)} placeholder="Search file name or extracted result" aria-label="Search health documents" />{documentSearch && <button type="button" aria-label="Clear document search" onClick={() => setDocumentSearch("")}><X size={14} /></button>}</label>
        <label>Category<select value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value)}><option value="ALL">All categories</option><option value="LAB_REPORT">Lab report</option><option value="PRESCRIPTION">Prescription</option><option value="DIAGNOSTIC_REPORT">Diagnostic report</option><option value="DISCHARGE_SUMMARY">Discharge summary</option><option value="OTHER">Unclassified</option></select></label>
        <label>Processing<select value={processingFilter} onChange={(event) => setProcessingFilter(event.target.value)}><option value="ALL">Any status</option><option value="UPLOADED">Uploaded</option><option value="PROCESSING">Processing</option><option value="REVIEW_REQUIRED">Needs review</option><option value="COMPLETED">Completed</option><option value="FAILED">Failed</option></select></label>
        <label>Review<select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}><option value="ALL">Any review state</option><option value="REVIEW_REQUIRED">Needs review</option><option value="CONFIRMED">Patient reviewed</option><option value="NOT_REQUIRED">Not required</option></select></label>
        <label>From<input type="date" value={reportDateFrom} onChange={(event) => setReportDateFrom(event.target.value)} aria-label="Filter from report date" /></label>
        <label>To<input type="date" value={reportDateTo} onChange={(event) => setReportDateTo(event.target.value)} aria-label="Filter to report date" /></label>
        <label>Sort<select value={documentSort} onChange={(event) => setDocumentSort(event.target.value)}><option value="newest">Newest upload</option><option value="oldest">Oldest upload</option><option value="report-date">Newest report date</option></select></label>
        <button className="text-button" type="button" onClick={() => { setDocumentSearch(""); setDocumentCategory("ALL"); setProcessingFilter("ALL"); setReviewFilter("ALL"); setReportDateFrom(""); setReportDateTo(""); setDocumentSort("newest"); }}>Clear filters</button>
      </div>
      <div className="record-results-count">Showing {filteredDocuments.length} of {documents.length} documents</div>
      {documents.length ? filteredDocuments.length ? <div className={`document-list ${recordListView === "grid" ? "document-list-grid" : ""}`}>{filteredDocuments.map((doc) => {
        const detail = reviewedDocuments[doc._id] || doc;
        return <article className="document-card" key={doc._id}>
          <div className="document-icon"><FileHeart size={18} /></div>
          {editingDocumentId === doc._id && <label className="document-category-editor">Category<select value={reviewDocumentType} onChange={(event) => setReviewDocumentType(event.target.value)}><option value="LAB_REPORT">Lab report</option><option value="PRESCRIPTION">Prescription</option><option value="DIAGNOSTIC_REPORT">Diagnostic report</option><option value="DISCHARGE_SUMMARY">Discharge summary</option><option value="OTHER">Unclassified</option></select></label>}
          <div className="document-main">
            <strong>{doc.originalName}</strong>
            <span>{documentTypeLabel(doc.documentType)} · Uploaded {formatDate(doc.createdAt)}{doc.reportDate ? ` · Report date ${formatDate(doc.reportDate)}` : ""}{doc.mimeType !== "application/pdf" && doc.ocrLanguage ? ` · OCR ${ocrLanguageLabel(doc.ocrLanguage)}` : ""} · {processingStatusLabel(doc.processingStatus)}</span>
            <small className={`review-state ${detail.reviewStatus === "CONFIRMED" ? "confirmed" : "pending"}`}>{doc.demoSample ? "Fictional sample values — not patient-reviewed" : detail.reviewStatus === "CONFIRMED" ? "Patient-reviewed extraction" : doc.processingMessage || "Review required before explanation"}</small>
            {doc.extractedData?.length > 0 && <div className="lab-value-list">{doc.extractedData.map((result, index) => <div key={`${result.testName}-${index}`}><span>{result.testName}</span><strong>{result.originalValue || result.value} {result.unit || ""}</strong>{result.referenceRange && <small>Reported range: {result.referenceRange}</small>}{result.confidence !== null && result.confidence !== undefined && <small>OCR confidence: {Math.round(result.confidence * 100)}%</small>}</div>)}</div>}
            {doc.extractedClinicalData?.length > 0 && <div className="lab-value-list">{doc.extractedClinicalData.map((fact, index) => <div key={`${fact.fieldType}-${fact.label}-${index}`}><span>{fact.label}</span><strong>{fact.value}</strong><small>{fact.fieldType === "DATE" ? "Explicit clinical date" : "Documented diagnosis candidate"} · {fact.verificationStatus || "UNVERIFIED"}</small>{fact.sourceLine && <small>Source: {fact.sourceLine}</small>}</div>)}</div>}
            {detail.extractedText && <details className="extracted-details"><summary>Review extracted text</summary><pre>{detail.extractedText}</pre></details>}
            {!detail.extractedText && <button className="text-button" onClick={() => reviewDocument(doc._id)}>Load extracted text <ArrowRight size={13} /></button>}
            {editingDocumentId === doc._id && <div className="extraction-review-editor"><strong>Review extracted results against the original</strong>{reviewDraft.map((result, index) => <div className="extraction-review-row" key={`${doc._id}-${index}`}><label>Test name<input value={result.testName} onChange={(event) => setReviewDraft((current) => current.map((item, row) => row === index ? { ...item, testName: event.target.value } : item))} /></label><label>Reported value<input inputMode="decimal" value={result.value} onChange={(event) => setReviewDraft((current) => current.map((item, row) => row === index ? { ...item, value: event.target.value } : item))} /></label><label>Unit<input value={result.unit} onChange={(event) => setReviewDraft((current) => current.map((item, row) => row === index ? { ...item, unit: event.target.value } : item))} /></label><label>Reference range<input value={result.referenceRange} onChange={(event) => setReviewDraft((current) => current.map((item, row) => row === index ? { ...item, referenceRange: event.target.value } : item))} /></label></div>)}{reviewClinicalDraft.length > 0 && <><strong>Review diagnosis and date candidates</strong>{reviewClinicalDraft.map((fact, index) => <div className="extraction-review-row" key={`${doc._id}-clinical-${index}`}><label>Type / source label<input value={`${fact.fieldType} · ${fact.label}`} readOnly /></label><label className="field-wide">{fact.fieldType === "DATE" ? "Reported date (YYYY-MM-DD; clear to reject)" : "Reported diagnosis (clear to reject)"}<input type="text" value={fact.value} onChange={(event) => setReviewClinicalDraft((current) => current.map((item, row) => row === index ? { ...item, value: event.target.value } : item))} /></label></div>)}</>}{reviewDraft.length === 0 && reviewClinicalDraft.length === 0 && <p>No structured details were detected. Confirm the extracted document text was reviewed.</p>}<div className="document-actions"><button className="primary-button compact-button" onClick={() => saveReview(doc._id)} disabled={busy}>Confirm reviewed data</button><button className="secondary-button compact-button" onClick={() => setEditingDocumentId("")}>Cancel</button></div></div>}
          </div>
          <div className="document-actions">
            <button className="secondary-button compact-button" onClick={() => { setSelectedDocumentId(doc._id); if (!doc.extractedText) reviewDocument(doc._id); }}>Details</button>
            <button className="secondary-button compact-button" onClick={() => onViewReport(doc._id)}><Eye size={14} /> View report</button>
            {!doc.demoSample && <button className="icon-button" title="Download original" aria-label={`Download ${doc.originalName}`} onClick={() => onDownload(doc._id)}><ArrowDownToLine size={16} /></button>}
            <button className="secondary-button compact-button" onClick={() => generateSummary(doc._id)} disabled={busy || detail.reviewStatus !== "CONFIRMED"}>{doc.aiSummary && doc.aiSummaryLanguage === summaryLanguage ? "View explanation" : "Explain report"}</button>
            {!doc.demoSample && <button className="text-button" onClick={() => editingDocumentId === doc._id ? setEditingDocumentId("") : beginReview(detail)}>Review / correct</button>}
          </div>
        </article>;
      })}</div> : <EmptyState title="No matching documents" detail="Try changing or clearing your search and filters." icon={Search} /> : <EmptyState title="No documents yet" detail="Upload a lab report, prescription, or discharge summary to begin." icon={Upload} />}
    </section>
    {selectedDetail && <section className="panel selected-document-panel"><div className="panel-heading"><div><h2>{selectedDetail.originalName || selectedDocument?.originalName}</h2><p>{documentTypeLabel(selectedDetail.documentType)} · Uploaded {formatDate(selectedDetail.createdAt)}</p></div><button className="icon-button" aria-label="Close document details" onClick={() => setSelectedDocumentId("")}><X size={16} /></button></div>{selectedDetail.demoSample && <p className="sharing-prototype-note"><ShieldCheck size={15} /> Fictional sample report — all values, dates, and reference intervals shown here are illustrative.</p>}{selectedDetail.guestSession && <p className="sharing-prototype-note"><ShieldCheck size={15} /> Guest mode stores the report entry only. No file content or OCR results are saved in this local session.</p>}<div className="selected-document-meta"><span>Processing: {processingStatusLabel(selectedDetail.processingStatus)}</span><span>Review: {selectedDetail.reviewStatus === "CONFIRMED" ? "Patient reviewed" : "Needs review"}</span><span>Report date: {selectedDetail.reportDate ? formatDate(selectedDetail.reportDate) : "Not detected"}</span><span>Patient: Not detected</span><span>Clinician: Not detected</span></div><h3>Extracted results</h3>{selectedDetail.extractedData?.length ? <div className="lab-value-list">{selectedDetail.extractedData.map((result, index) => <div key={`${result.testName}-${index}`}><span>{result.testName}</span><strong>{result.originalValue || result.value} {result.unit || ""}</strong><small>Verification: {result.verificationStatus || "UNVERIFIED"}</small><small>Source: {result.sourceLine || "Source line unavailable"}</small><small>{result.confidence == null ? "OCR confidence unavailable" : `OCR confidence: ${Math.round(result.confidence * 100)}%`}</small>{result.referenceRange && <small>Reported range: {result.referenceRange}</small>}</div>)}</div> : <p className="muted-copy">No structured results were detected in this document.</p>}<h3>Extracted document text</h3>{selectedDetail.extractedText ? <details className="extracted-details" open><summary>{selectedDetail.demoSample ? "Sample report text" : "OCR text (may contain errors; verify against the original)"}</summary><pre>{selectedDetail.extractedText}</pre></details> : <p className="muted-copy">{selectedDetail.guestSession ? "OCR is not available in local guest mode; no document text was inferred." : "Loading OCR text… If this remains empty, the document may not contain extractable text."}</p>}<div className="document-actions">{!selectedDetail.demoSample && !selectedDetail.guestSession && <button className="secondary-button compact-button" onClick={() => onDownload(selectedDocumentId)}><ArrowDownToLine size={14} /> Download original</button>}<button className="secondary-button compact-button" onClick={() => onViewReport(selectedDocumentId)}><Eye size={14} /> View report</button><button className="secondary-button compact-button" disabled={busy || selectedDetail.reviewStatus !== "CONFIRMED"} onClick={() => generateSummary(selectedDocumentId)}>Explain report</button>{!selectedDetail.demoSample && <button className="text-button" onClick={() => beginReview(selectedDetail)}>Review / correct</button>}</div></section>}
    <section id="health-record-timeline" className="panel timeline-panel" tabIndex="-1"><div className="panel-heading"><div><h2>Unified health timeline</h2><p>Documents, lab reports, medicines, notes, and appointments with recorded dates.</p></div></div>{data.timeline?.length ? <div className="workspace-list">{data.timeline.map((event) => <button className="workspace-list-row timeline-event-button" key={event.id} onClick={() => event.documentId || event.type === "DOCUMENT" ? reviewDocument(event.documentId || event.sourceId) : undefined}><span className="list-icon"><Activity size={17} /></span><span className="timeline-event-copy"><strong>{event.title}</strong><span>{event.documentType?.replaceAll("_", " ") || event.type?.replaceAll("_", " ")}{event.details ? ` · ${event.details}` : ""}{event.documentId ? " · Open source document" : ""}</span></span><time>{formatDate(event.date)}</time></button>)}</div> : <p className="muted-copy">No health history has been saved yet.</p>}</section>
  </>;
}

function Assistant({ data, onCreate, onSend, busy, demoMode = false }) {
  const [conversationId, setConversationId] = useState("");
  const [question, setQuestion] = useState("");
  const [localStatus, setLocalStatus] = useState(null);
  const [sources, setSources] = useState([]);
  const current = data.conversations.find((item) => item._id === conversationId) || data.conversations[0];
  const lastAssistantMessage = current?.messages
    ?.filter((message) => message.sender === "ASSISTANT")
    .at(-1);
  const visibleSources = Array.isArray(lastAssistantMessage?.sources)
    ? lastAssistantMessage.sources
    : sources;

  useEffect(() => {
    if (demoMode) {
      setLocalStatus({ connected: false, error: "Demo mode is showing a saved sample conversation; no AI request was made." });
      return undefined;
    }

    let active = true;
    api.get("/conversations/status")
      .then((status) => { if (active) setLocalStatus(status); })
      .catch((error) => { if (active) setLocalStatus({ connected: false, error: error.message }); });
    return () => { active = false; };
  }, [demoMode]);

  async function create() {
    const conversation = await onCreate();
    if (conversation?._id) {
      setConversationId(conversation._id);
      setSources([]);
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (!question.trim()) return;
    const content = question.trim();
    const sent = await onSend(current?._id, content);
    if (sent) {
      setQuestion("");
      setSources(sent.sources || []);
    }
  }

  return <>
    <PageHeading eyebrow="SOURCE-GROUNDED HEALTH CHAT" title="AI health assistant" detail={demoMode ? "Review the saved fictional conversation. Live AI is not contacted while demo data is on." : "Search across your uploaded reports, saved health records, prescriptions, medicines, appointments, reminders, and food and habit entries. Only records belonging to your signed-in account are used; answers cite the records retrieved for your question."} action={<button className="secondary-button" onClick={create} disabled={busy || demoMode}><Plus size={15} /> New chat</button>} />
    <div className={`local-model-status ${localStatus?.connected && localStatus?.chatModelAvailable && localStatus?.embeddingModelAvailable ? "ready" : "offline"}`} role="status">
      <span className="status-live-dot" />
      {demoMode
        ? "DEMO CONVERSATION · AI service not contacted"
        : localStatus ? localStatus.connected
        ? `Ollama connected · Chat: ${localStatus.chatModelAvailable ? "ready" : `missing ${localStatus.chatModel}`} · Embeddings: ${localStatus.embeddingModelAvailable ? "ready" : `missing ${localStatus.embeddingModel}`}`
        : `Ollama unavailable · ${localStatus.error || "Start the local Ollama service."}`
        : "Checking local Ollama…"}
    </div>
    <div className="assistant-layout">
      <aside className="panel chat-history"><div className="panel-heading"><div><h2>Conversations</h2><p>Your saved chats</p></div></div>{data.conversations.map((chat) => <button key={chat._id} className={`chat-history-item ${current?._id === chat._id ? "selected" : ""}`} onClick={() => { setConversationId(chat._id); setSources([]); }}><MessageCircle size={15} /><span>{chat.title || "Health Assistant Chat"}</span></button>)}{!data.conversations.length && <p className="muted-copy">Your conversations will appear here.</p>}</aside>
      <section className="panel chat-panel">
        <div className="chat-messages">{current?.messages?.length ? current.messages.map((message, index) => <article className={`chat-bubble ${message.sender === "USER" ? "from-user" : "from-assistant"}`} key={`${message._id || message.createdAt || index}`}><strong>{message.sender === "USER" ? "You" : "Health Copilot"}</strong><p>{message.content}</p>{message.retrievalLimited && <small className="retrieval-limited-note" role="status">Partial review: at most 30 saved-record sources and one passage per source were included. Long reports may have additional details not shown.</small>}</article>) : <EmptyState icon={BrainCircuit} title="Ask about your health records" detail="For example: “What does my latest glucose result say?” or “Review all my reports.”" />}</div>
        {visibleSources.length > 0 && <section className="rag-sources"><h3><FileHeart size={14} /> Answer sources</h3>{visibleSources.map((source) => <details key={`${source.kind}:${source.id}`}><summary>{source.title} <span>{source.kind === "TRUSTED_MEDICAL_KNOWLEDGE" ? "Reviewed medical reference" : "Your health record"}{source.type ? ` · ${source.type}` : ""}</span></summary><p>{source.excerpt || (source.date ? new Date(source.date).toLocaleDateString() : "Source cited in this answer.")}</p>{source.url && <a href={source.url} target="_blank" rel="noreferrer">Open reference source</a>}</details>)}</section>}
        <form className="chat-composer" onSubmit={submit}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows="2" maxLength={5000} placeholder="Ask in English or Hindi…" aria-label="Your health question" disabled={demoMode} /><button className="primary-button" disabled={busy || demoMode || !question.trim()}><ArrowRight size={16} /> Send</button></form>
        <p className="inline-help"><ShieldCheck size={13} /> Prompts are processed by the configured Ollama service. No diagnosis or medication-change advice; emergencies need urgent human care.</p>
      </section>
    </div>
  </>;
}

function FloatingCopilot({ data, onCreate, onSend, busy }) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState("compact");
  const [position, setPosition] = useState(() => ({
    x: Math.max(12, window.innerWidth - 76),
    y: Math.max(12, window.innerHeight - 76),
  }));
  const [conversationId, setConversationId] = useState("");
  const [question, setQuestion] = useState("");
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const messageListRef = useRef(null);
  const current = data.conversations.find((item) => item._id === conversationId)
    || data.conversations[0];

  useEffect(() => {
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [current?.messages]);

  useEffect(() => {
    function moveWidget(event) {
      if (!drag.current) return;
      const deltaX = event.clientX - drag.current.pointerX;
      const deltaY = event.clientY - drag.current.pointerY;
      if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.current.moved = true;
      setPosition({
        x: Math.min(Math.max(8, drag.current.x + deltaX), window.innerWidth - 64),
        y: Math.min(Math.max(8, drag.current.y + deltaY), window.innerHeight - 64),
      });
    }
    function finishMove() {
      if (drag.current?.moved && drag.current.suppressClick) {
        suppressClick.current = true;
      }
      drag.current = null;
    }
    function keepWidgetOnscreen() {
      setPosition((currentPosition) => ({
        x: Math.min(Math.max(8, currentPosition.x), window.innerWidth - 64),
        y: Math.min(Math.max(8, currentPosition.y), window.innerHeight - 64),
      }));
    }
    window.addEventListener("pointermove", moveWidget);
    window.addEventListener("pointerup", finishMove);
    window.addEventListener("pointercancel", finishMove);
    window.addEventListener("resize", keepWidgetOnscreen);
    return () => {
      window.removeEventListener("pointermove", moveWidget);
      window.removeEventListener("pointerup", finishMove);
      window.removeEventListener("pointercancel", finishMove);
      window.removeEventListener("resize", keepWidgetOnscreen);
    };
  }, []);

  function startMove(event, suppressLauncherClick = false) {
    if (event.button !== 0) return;
    event.preventDefault();
    drag.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: position.x,
      y: position.y,
      moved: false,
      suppressClick: suppressLauncherClick,
    };
  }

  function toggleOpen() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setOpen((wasOpen) => !wasOpen);
  }

  async function startConversation() {
    const conversation = await onCreate();
    if (conversation?._id) setConversationId(conversation._id);
  }

  async function submit(event) {
    event.preventDefault();
    if (!question.trim() || busy) return;
    const content = question.trim();
    let activeConversationId = current?._id;
    if (!activeConversationId) {
      const conversation = await onCreate();
      activeConversationId = conversation?._id;
      if (activeConversationId) setConversationId(activeConversationId);
    }
    if (!activeConversationId) return;
    const sent = await onSend(activeConversationId, content);
    if (sent) setQuestion("");
  }

  const panelWidth = Math.min(size === "expanded" ? 540 : 360, window.innerWidth - 24);
  const panelHeight = Math.min(size === "expanded" ? 680 : 480, window.innerHeight - 24);
  const panelX = Math.min(
    Math.max(12, position.x + 56 - panelWidth),
    window.innerWidth - panelWidth - 12,
  );
  const panelY = Math.min(
    Math.max(12, position.y - panelHeight - 12 >= 12
      ? position.y - panelHeight - 12
      : position.y + 68),
    window.innerHeight - panelHeight - 12,
  );

  return <div className="floating-copilot">
    {open && <section
      className={`floating-copilot-panel ${size}`}
      style={{ left: `${panelX}px`, top: `${panelY}px` }}
      aria-label="AI Copilot chat"
    >
      <header className="floating-copilot-header">
        <div
          className="floating-copilot-drag-handle"
          onPointerDown={(event) => startMove(event)}
          title="Drag to move the copilot"
        >
          <span className="floating-copilot-icon"><BrainCircuit size={17} /></span>
          <span><strong>AI Copilot</strong><small>Grounded in your health records</small></span>
        </div>
        <div className="floating-copilot-controls">
          <button
            className="icon-button"
            type="button"
            aria-label={size === "compact" ? "Use expanded chat" : "Use compact chat"}
            title={size === "compact" ? "Expanded chat" : "Compact chat"}
            onClick={() => setSize((currentSize) => currentSize === "compact" ? "expanded" : "compact")}
          >{size === "compact" ? <Maximize2 size={15} /> : <Minimize2 size={15} />}</button>
          <button className="icon-button" type="button" aria-label="Close AI Copilot" onClick={() => setOpen(false)}><X size={16} /></button>
        </div>
      </header>
      <div className="floating-copilot-conversation">
        <label className="floating-copilot-select-label" htmlFor="floating-copilot-conversation">
          Conversation
        </label>
        <select
          id="floating-copilot-conversation"
          value={current?._id || ""}
          onChange={(event) => setConversationId(event.target.value)}
          aria-label="Choose a saved conversation"
        >
          {!data.conversations.length && <option value="">New conversation</option>}
          {data.conversations.map((conversation) => <option key={conversation._id} value={conversation._id}>
            {conversation.title || "Health Assistant Chat"}
          </option>)}
        </select>
        <button type="button" className="floating-copilot-new" onClick={startConversation} disabled={busy}>
          <Plus size={14} /> New chat
        </button>
      </div>
      <div className="floating-copilot-messages" ref={messageListRef} aria-live="polite">
        {current?.messages?.length
          ? current.messages.map((message, index) => <article
            className={`chat-bubble ${message.sender === "USER" ? "from-user" : "from-assistant"}`}
            key={message._id || message.createdAt || index}
          >
            <strong>{message.sender === "USER" ? "You" : "Health Copilot"}</strong>
            <p>{message.content}</p>
            {message.retrievalLimited && <small className="retrieval-limited-note" role="status">Partial review: at most 30 saved-record sources and one passage per source were included. Long reports may have additional details not shown.</small>}
          </article>)
          : <div className="floating-copilot-empty">
            <BrainCircuit size={21} />
            <strong>How can I help?</strong>
            <p>Ask about your saved health records or a report.</p>
          </div>}
      </div>
      <form className="floating-copilot-composer" onSubmit={submit}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows="2"
          maxLength={5000}
          placeholder="Ask in English or Hindi…"
          aria-label="Ask the AI Copilot"
        />
        <button className="primary-button" type="submit" disabled={busy || !question.trim()} aria-label="Send message">
          <Send size={16} />
        </button>
      </form>
      <p className="floating-copilot-safety"><ShieldCheck size={12} /> Informational support, not a diagnosis.</p>
    </section>}
    <button
      className={`floating-copilot-launcher ${open ? "is-open" : ""}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      type="button"
      aria-label={open ? "Close AI Copilot chat" : "Open AI Copilot chat"}
      aria-expanded={open}
      title="Drag to move · Click to chat"
      onPointerDown={(event) => startMove(event, true)}
      onClick={toggleOpen}
    >
      {open ? <X size={21} /> : <MessageCircle size={22} />}
      {!open && <span className="floating-copilot-pulse" />}
    </button>
  </div>;
}

function ABHAProfile({ profile, onSave, onConsent, busy }) {
  const [address, setAddress] = useState(profile?.abhaAddress || "");
  const [lastFour, setLastFour] = useState(profile?.abhaNumberLastFour || "");
  const [consent, setConsent] = useState({
    shareHealthRecords: profile?.consent?.shareHealthRecords || false,
    shareLabReports: profile?.consent?.shareLabReports || false,
    sharePrescriptions: profile?.consent?.sharePrescriptions || false,
  });
  async function save(event) {
    event.preventDefault();
    await onSave({ abhaAddress: address, ...(lastFour ? { abhaNumberLastFour: lastFour } : {}) });
  }
  async function saveConsent(event) {
    event.preventDefault();
    await onConsent(consent);
  }

  return <><PageHeading eyebrow="ABDM-READY PROFILE" title="ABHA profile" detail="Store a mock ABHA link and manage explicit record-sharing preferences. This prototype does not connect to ABDM." /><div className="workspace-columns"><section className="panel form-panel"><div className="panel-heading"><div><h2>Health identity</h2><p>Only store the details you choose to provide.</p></div><span className={`status-chip ${profile?.verificationStatus === "VERIFIED" ? "active" : "pending"}`}>{profile?.verificationStatus?.replaceAll("_", " ") || "NOT LINKED"}</span></div><form className="form-grid" onSubmit={save}><label className="field-wide">ABHA address<input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={100} placeholder="example@abdm" /></label><label className="field-wide">Last four digits only<input value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="••••" /></label><div className="field-wide"><button className="primary-button" disabled={busy}>Save profile</button></div></form></section><section className="panel form-panel"><div className="panel-heading"><div><h2>Sharing consent</h2><p>Choose what you authorize this prototype to mark as shareable.</p></div></div><form onSubmit={saveConsent} className="consent-form">{[["shareHealthRecords", "Health records"], ["shareLabReports", "Lab reports"], ["sharePrescriptions", "Prescriptions"]].map(([key, title]) => <label key={key} className="consent-row"><span><strong>{title}</strong><small>Sharing permission recorded on this profile.</small></span><input type="checkbox" checked={consent[key]} onChange={(event) => setConsent({ ...consent, [key]: event.target.checked })} /></label>)}<button className="primary-button" disabled={busy || !profile}>Save consent</button></form><p className="inline-help"><ShieldCheck size={13} /> No records are sent to an external ABDM service by this demo.</p></section></div></>;
}

function FhirExport({ demoMode = false, documents = [] }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function prepare() {
    setLoading(true);
    setError("");
    try {
      if (demoMode) {
        const patientId = "demo-patient";
        const entries = [{
          resource: {
            resourceType: "Patient",
            id: patientId,
            name: [{ text: "MediPilot Demo Patient" }],
          },
        }];
        documents.forEach((document) => {
          const observationEntries = (document.extractedData || []).map((finding, index) => ({
            resource: {
              resourceType: "Observation",
              id: `${document._id}-${index}`,
              status: "final",
              code: { text: finding.testName },
              subject: { reference: `Patient/${patientId}` },
              effectiveDateTime: document.reportDate,
              valueQuantity: {
                value: finding.value,
                unit: finding.unit,
                system: "http://unitsofmeasure.org",
              },
              referenceRange: [{ text: finding.referenceRange }],
              note: [{ text: "Synthetic demonstration value; not a real patient result." }],
            },
          }));
          entries.push(...observationEntries);
          entries.push({
            resource: {
              resourceType: "DiagnosticReport",
              id: `${document._id}-report`,
              status: "final",
              code: { text: document.originalName },
              subject: { reference: `Patient/${patientId}` },
              effectiveDateTime: document.reportDate,
              result: observationEntries.map(({ resource }) => ({
                reference: `Observation/${resource.id}`,
              })),
              conclusion: "Fictional sample report for interface demonstration only.",
            },
          });
        });
        setResult({
          fhirVersion: "FHIR R4-style demonstration",
          bundle: { resourceType: "Bundle", type: "collection", entry: entries },
          validation: {
            valid: true,
            errors: [],
            warnings: ["Synthetic sample data only; not a validated production FHIR export."],
          },
          profileValidation: "Basic structural demonstration only; not official FHIR profile validation.",
        });
      } else {
        setResult(await api.get("/fhir/export"));
      }
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!result?.validation?.valid) return;
    const blob = new Blob([JSON.stringify(result.bundle, null, 2)], { type: "application/fhir+json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "altrix-health-records-fhir-r4-style.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return <>
    <PageHeading eyebrow="HEALTH DATA PORTABILITY" title="FHIR-ready export" detail="Map your saved records into FHIR R4-style resources, run basic structural checks, and download a JSON Bundle." />
    <section className="panel fhir-intro-panel">
      <div className="fhir-intro-icon"><FileJson size={22} /></div>
      <div><h2>Prepare a patient record bundle</h2><p>Only your own profile, health notes, uploaded report results, and medication list are included. Document images and OCR text are not exported.</p></div>
      <button className="primary-button" onClick={prepare} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} />{loading ? "Validating…" : "Validate my records"}</button>
    </section>
    {error && <p className="form-alert error" role="alert">{error}</p>}
    {result && <section className="panel fhir-result-panel" aria-live="polite">
      <div className="panel-heading"><div><h2>Basic validation {result.validation.valid ? <span className="status-chip active">PASS</span> : <span className="status-chip cancelled">REVIEW</span>}</h2><p>{result.fhirVersion} · {result.bundle.entry.length} resources · Collection Bundle</p></div><button className="secondary-button" onClick={download} disabled={!result.validation.valid}><ArrowDownToLine size={15} /> Download JSON</button></div>
      <p className="fhir-validation-note">{result.profileValidation}</p>
      {result.validation.errors.length > 0 && <ul className="fhir-issue-list error">{result.validation.errors.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
      {result.validation.warnings.length > 0 && <ul className="fhir-issue-list warning">{result.validation.warnings.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
      <div className="fhir-resource-list">{result.bundle.entry.map(({ resource }) => <article key={`${resource.resourceType}-${resource.id}`}><span>{resource.resourceType}</span><strong>{resource.code?.text || resource.description || resource.name?.[0]?.text || resource.medicationCodeableConcept?.text || resource.resourceType}</strong><small>{resource.id}</small></article>)}</div>
    </section>}
    <p className="inline-help fhir-caveat"><ShieldCheck size={13} /> This export is a prototype using FHIR R4 resource shapes. Basic checks are not official FHIR R4 profile or terminology validation. Confirm applicable implementation guides before connecting to real systems.</p>
  </>;
}

function RecordSharing({ documents, records, medications }) {
  const [selected, setSelected] = useState([]);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [shares, setShares] = useState([]);
  const [shareUrl, setShareUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const qrRef = useRef(null);

  const availableRecords = [
    ...documents.map((item) => ({ kind: "document", id: item._id, label: item.originalName, detail: `${item.documentType?.replaceAll("_", " ") || "Document"} · ${formatDate(item.createdAt)}` })),
    ...records.map((item) => ({ kind: "record", id: item._id, label: item.title, detail: `${item.recordType || "Health note"} · ${formatDate(item.recordedAt)}` })),
    ...medications.map((item) => ({ kind: "medication", id: item._id, label: item.medicineName, detail: `Medication · ${item.status || "Status unknown"}` })),
  ].filter((item) => item.id);

  async function refreshShares() {
    try {
      const response = await api.get("/shares");
      setShares(response.shares || []);
    } catch (requestError) {
      setError(messageFrom(requestError));
    }
  }

  useEffect(() => {
    let active = true;
    api.get("/shares")
      .then((response) => { if (active) setShares(response.shares || []); })
      .catch((requestError) => { if (active) setError(messageFrom(requestError)); });
    return () => { active = false; };
  }, []);

  function toggleRecord(key) {
    setSelected((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
    setShareUrl("");
  }

  async function createShare(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const chosen = selected.map((key) => {
        const [kind, id] = key.split(":");
        return { kind, id };
      });
      const response = await api.post("/shares", { records: chosen, expiresInHours });
      setShareUrl(`${window.location.origin}/shared/${response.share.token}`);
      setSelected([]);
      setNotice(`Link created for ${response.share.recordCount} selected record${response.share.recordCount === 1 ? "" : "s"}. It expires ${formatDate(response.share.expiresAt, true)}.`);
      await refreshShares();
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Share link copied. Anyone with this link can view the selected records until it expires or is revoked.");
    } catch (requestError) {
      setError(`Could not copy the link. Copy it from the link field instead. ${messageFrom(requestError)}`);
    }
  }

  async function shareLink() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "MediPilot AI — patient-shared health records",
          text: "Patient-authorized, time-limited health record access.",
          url: shareUrl,
        });
      } else {
        await copyLink();
      }
    } catch (shareError) {
      if (shareError.name !== "AbortError") {
        setError(`Could not share the link. ${messageFrom(shareError)}`);
      }
    }
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "medipilot-hospital-share-qr.png";
    link.click();
  }

  async function revoke(id) {
    setError("");
    try {
      await api.delete(`/shares/${id}`);
      setNotice("Share link revoked. It can no longer be used to access records.");
      setShareUrl("");
      await refreshShares();
    } catch (requestError) {
      setError(messageFrom(requestError));
    }
  }

  return <>
    <PageHeading eyebrow="PATIENT-CONTROLLED HOSPITAL ACCESS" title="Share selected records" detail="Choose exactly which reports and records a hospital can view, set an expiry, then share the secure link or QR code. You can revoke access at any time." />
    <p className="sharing-prototype-note"><ShieldCheck size={15} /> Prototype link — anyone who receives it can view only the records you select until it expires or you revoke it. The hospital recipient is not identity-verified, and this is not an ABDM consent artefact.</p>
    <section className="panel sharing-panel">
      <div className="panel-heading"><div><h2>Select reports and records</h2><p>Only checked items are included in the patient-specific FHIR-style share bundle.</p></div><span className="status-chip">{selected.length} selected</span></div>
      {availableRecords.length ? <form onSubmit={createShare}>
        <div className="share-record-list">{availableRecords.map((item) => {
          const key = `${item.kind}:${item.id}`;
          return <label className="share-record-row" key={key}><input type="checkbox" checked={selected.includes(key)} onChange={() => toggleRecord(key)} /><span><strong>{item.label}</strong><small>{item.detail}</small></span><span className="share-kind">{item.kind}</span></label>;
        })}</div>
        <div className="share-controls"><label>Link / QR valid for<select value={expiresInHours} onChange={(event) => setExpiresInHours(Number(event.target.value))}><option value={1}>1 hour</option><option value={6}>6 hours</option><option value={24}>24 hours</option><option value={72}>3 days</option><option value={168}>7 days</option><option value={720}>30 days</option></select></label><button className="primary-button" disabled={loading || selected.length === 0}><Share2 size={15} />{loading ? "Creating link…" : "Create hospital share"}</button></div>
      </form> : <EmptyState icon={FileHeart} title="No records to share yet" detail="Add a health note, medication, or report before creating a selected-record share." />}
      {error && <p className="form-alert error" role="alert">{error}</p>}
      {notice && <p className="form-alert success" role="status">{notice}</p>}
      {shareUrl && <div className="share-link-result hospital-share-result">
        <div className="hospital-share-link-actions">
          <label>Secure hospital link<input readOnly value={shareUrl} onFocus={(event) => event.target.select()} /></label>
          <div>
            <button className="secondary-button" onClick={copyLink}><Check size={15} /> Copy link</button>
            <button className="secondary-button" onClick={shareLink}><Share2 size={15} /> Share link</button>
            <a className="text-button" href={shareUrl} target="_blank" rel="noreferrer">Preview as recipient <ArrowRight size={14} /></a>
          </div>
        </div>
        <div className="hospital-share-qr" ref={qrRef}>
          <QRCodeCanvas value={shareUrl} size={160} level="H" includeMargin />
          <span>Scan to open the selected records</span>
          <button className="secondary-button compact-button" onClick={downloadQr}><Download size={14} /> Download QR</button>
        </div>
      </div>}
    </section>
    <section className="panel sharing-history">
      <div className="panel-heading"><div><h2>Share and access history</h2><p>Up to 50 recent share grants are retained. Access is logged by event and time, without storing viewer IP addresses.</p></div><button className="icon-button" onClick={refreshShares} aria-label="Refresh share history"><RefreshCw size={15} /></button></div>
      {shares.length ? <div className="share-history-list">{shares.map((share) => <article className="share-history-item" key={share._id}><div><strong>{share.records.length} selected record{share.records.length === 1 ? "" : "s"}</strong><small>Created {formatDate(share.createdAt, true)} · Expires {formatDate(share.expiresAt, true)} · {share.accessCount || 0} access{share.accessCount === 1 ? "" : "es"}</small><div className="share-events">{(share.accessEvents || []).slice().reverse().slice(0, 5).map((event, index) => <span key={`${share._id}-${event.event}-${event.occurredAt}-${index}`}>{event.event} · {formatDate(event.occurredAt, true)}</span>)}</div></div><span className={`status-chip ${share.status === "active" ? "active" : share.status === "revoked" ? "cancelled" : ""}`}>{share.status?.toUpperCase() || "UNKNOWN"}</span>{share.status === "active" && <button className="secondary-button danger-button compact-button" onClick={() => revoke(share._id)}>Revoke</button>}</article>)}</div> : <EmptyState icon={Share2} title="No share links yet" detail="When you create a link, its expiry and access history will appear here." />}
    </section>
  </>;
}

function HospitalSharingPage({ documents, records, medications, demoMode = false }) {
  const [sharingMode, setSharingMode] = useState("selected-records");

  if (demoMode) {
    return <>
      <PageHeading eyebrow="PATIENT-CONTROLLED HOSPITAL ACCESS" title="Share selected records" detail="Demo mode shows sample records without creating a real link, QR code, request, or access grant." />
      <div className="sharing-prototype-note"><ShieldCheck size={15} /> These sample reports are fictional and read-only. Turn demo data off to access your real sharing controls.</div>
      <section className="panel sharing-panel">
        <div className="panel-heading"><div><h2>Sample records available</h2><p>Only demonstration data is shown while demo mode is on.</p></div><span className="status-chip">SIMULATION</span></div>
        <div className="share-record-list">{documents.map((document) => <article className="share-record-row" key={document._id}><span><strong>{document.originalName}</strong><small>{document.documentType?.replaceAll("_", " ") || "Medical report"} · {formatDate(document.reportDate)} · Sample only</small></span><span className="share-kind">DEMO</span></article>)}</div>
      </section>
    </>;
  }

  return <>
    <div className="hospital-sharing-tabs" role="tablist" aria-label="Hospital sharing options">
      <button
        id="hospital-share-selected-tab"
        type="button"
        role="tab"
        aria-controls="hospital-share-selected-panel"
        aria-selected={sharingMode === "selected-records"}
        className={sharingMode === "selected-records" ? "selected" : ""}
        onClick={() => setSharingMode("selected-records")}
      ><Share2 size={15} /> Share selected records</button>
      <button
        id="hospital-share-requests-tab"
        type="button"
        role="tab"
        aria-controls="hospital-share-requests-panel"
        aria-selected={sharingMode === "hospital-request"}
        className={sharingMode === "hospital-request" ? "selected" : ""}
        onClick={() => setSharingMode("hospital-request")}
      ><QrCode size={15} /> Review hospital requests</button>
    </div>
    <section
      id="hospital-share-selected-panel"
      role="tabpanel"
      aria-labelledby="hospital-share-selected-tab"
      hidden={sharingMode !== "selected-records"}
    ><RecordSharing documents={documents} records={records} medications={medications} /></section>
    <section
      id="hospital-share-requests-panel"
      role="tabpanel"
      aria-labelledby="hospital-share-requests-tab"
      hidden={sharingMode !== "hospital-request"}
    ><MyHealthId documents={documents} records={records} medications={medications} /></section>
  </>;
}

function ClinicExchange() {
  const timeline = getClinicExchangeTimeline();
  return <>
    <PageHeading eyebrow="SIMULATED INTEROPERABILITY" title="Cross-facility exchange" detail="See how two fictional clinic formats can map into a shared, chronological FHIR-style patient timeline." />
    <div className="clinic-exchange-banner"><Building2 size={20} /><div><strong>Fictional sample data only</strong><span>This standalone demo does not read, write, or mix with your account records.</span></div><span className="status-chip">SIMULATION</span></div>
    <div className="clinic-source-grid">
      <article className="panel clinic-source-card"><span className="clinic-source-icon"><Building2 size={18} /></span><small>SOURCE FORMAT A · LEGACY LAB PANEL</small><h2>Harborview Clinic</h2><p>Clinic-local patient ID <code>HV-2048</code>, chemistry panel with nested result readings and local unit labels.</p></article>
      <article className="panel clinic-source-card"><span className="clinic-source-icon"><Building2 size={18} /></span><small>SOURCE FORMAT B · OBSERVATION FEED</small><h2>Cedar Grove Family Practice</h2><p>Clinic-local chart number <code>CG-771</code>, observation array with display names and measured values.</p></article>
    </div>
    <section className="panel clinic-timeline-panel"><div className="panel-heading"><div><h2><Activity size={16} /> Unified FHIR-style timeline</h2><p>Both sample formats are mapped to the same simulated patient reference and sorted by clinical date.</p></div><span className="status-chip active">2 FACILITIES</span></div>
      <div className="clinic-timeline">{timeline.map((item) => <article className="clinic-timeline-item" key={item.resource.id}><span className="clinic-timeline-dot" /><time>{formatDate(item.date, true)}</time><div><span className="clinic-timeline-source">{item.facility} · {item.sourceFormat}</span><h3>{item.resource.code.text}</h3><p>{item.resource.valueQuantity.value} {item.resource.valueQuantity.unit}{item.resource.referenceRange?.[0]?.text ? ` · Reported range: ${item.resource.referenceRange[0].text}` : ""}</p><small>{item.resource.resourceType} / {item.resource.id} · {item.resource.status}{item.report ? ` · ${item.report.resourceType} / ${item.report.id}` : ""}</small></div></article>)}</div>
    </section>
    <p className="inline-help"><ShieldCheck size={13} /> Values and clinic names in this demonstration are fictional examples, not a real patient record or validated clinical decision support.</p>
  </>;
}

function MyHealthId({ documents, records, medications }) {
  const [identity, setIdentity] = useState(null);
  const [identityEvents, setIdentityEvents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedByRequest, setSelectedByRequest] = useState({});
  const [expiryByRequest, setExpiryByRequest] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [showSecureLink, setShowSecureLink] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const qrRef = useRef(null);

  const availableRecords = [
    ...documents.map((item) => ({ kind: "document", id: item._id, label: item.originalName, detail: `${item.documentType?.replaceAll("_", " ") || "Document"} · ${formatDate(item.createdAt)}` })),
    ...records.map((item) => ({ kind: "record", id: item._id, label: item.title, detail: `${item.recordType || "Health note"} · ${formatDate(item.recordedAt)}` })),
    ...medications.map((item) => ({ kind: "medication", id: item._id, label: item.medicineName, detail: `Medication · ${item.status || "Status unknown"}` })),
  ].filter((item) => item.id);

  async function refresh() {
    const [healthIdResult, requestResult] = await Promise.all([
      api.get("/health-id/my"),
      api.get("/health-id/requests"),
    ]);
    setIdentity(healthIdResult);
    setIdentityEvents(requestResult.identityEvents || []);
    setRequests(requestResult.requests || []);
    setError("");
  }

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [healthIdResult, requestResult] = await Promise.all([
          api.get("/health-id/my"),
          api.get("/health-id/requests"),
        ]);
        if (active) {
          setIdentity(healthIdResult);
          setIdentityEvents(requestResult.identityEvents || []);
          setRequests(requestResult.requests || []);
          setError("");
        }
      } catch (requestError) {
        if (active) setError(messageFrom(requestError));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const interval = window.setInterval(load, 8000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function runRequestAction(id, action, successMessage) {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      await refresh();
      setSelectedByRequest((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusyId("");
    }
  }

  async function approveRequest(request) {
    const chosen = (selectedByRequest[request._id] || []).map((key) => {
      const [kind, id] = key.split(":");
      return { kind, id };
    });
    const duration = Number(expiryByRequest[request._id] || 60);
    const durationLabel = ({
      15: "15 minutes",
      30: "30 minutes",
      60: "1 hour",
      360: "6 hours",
      1440: "24 hours",
      4320: "3 days",
    })[duration];
    if (!window.confirm(`Share ${chosen.length} selected record${chosen.length === 1 ? "" : "s"} with ${request.organization} for ${durationLabel}? You can revoke access at any time. Copies already downloaded cannot be erased.`)) return;
    await runRequestAction(
      request._id,
      () => api.post(`/health-id/requests/${request._id}/approve`, {
        records: chosen,
        expiresInMinutes: duration,
      }),
      "Access approved for only the selected records and time."
    );
  }

  async function denyRequest(id) {
    await runRequestAction(
      id,
      () => api.post(`/health-id/requests/${id}/deny`),
      "Access request denied."
    );
  }

  async function revokeRequest(id) {
    if (!window.confirm("Are you sure you want to revoke access? This will immediately prevent further access through the shared health-record link. Any copies already downloaded cannot be erased.")) return;
    await runRequestAction(
      id,
      () => api.delete(`/health-id/requests/${id}`),
      "Access revoked immediately."
    );
  }

  async function regenerateQr() {
    if (!window.confirm("Replace your Health ID QR? The old QR will stop working and pending requests from it will be denied.")) return;
    setBusyId("regenerate");
    setError("");
    setNotice("");
    try {
      const updated = await api.post("/health-id/my/regenerate");
      setIdentity(updated);
      setShowQr(false);
      setNotice(updated.message);
      await refresh();
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusyId("");
    }
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "altrix-health-id-qr.png";
    link.click();
  }

  async function copySecureLink() {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setNotice("Secure consent-request link copied.");
      setError("");
    } catch (requestError) {
      setError(`Could not copy the secure link. ${messageFrom(requestError)}`);
    }
  }

  async function shareSecureLink() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Altrix Health ID",
          text: "Open this link to request consent for selected health records.",
          url: qrUrl,
        });
      } else {
        await copySecureLink();
      }
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(`Could not share the secure link. ${messageFrom(requestError)}`);
      }
    }
  }

  if (loading) {
    return <main className="public-share-page"><div className="panel public-share-state">Loading your Health ID…</div></main>;
  }

  const qrUrl = identity
    ? `${window.location.origin}/health-access/${identity.qrToken}`
    : "";

  return <>
    <PageHeading eyebrow="PATIENT-CONTROLLED EXCHANGE" title="Share with Hospital" detail="Present your Altrix Health ID QR or secure link to let a hospital request access. You choose exactly which records to share and for how long." />
    <div className="sharing-prototype-note"><ShieldCheck size={15} /> Prototype only — not an official ABHA/ABDM identity or consent artefact. Requester organization and name are self-reported and are not verified by this app.</div>
    {error && <p className="form-alert error" role="alert">{error}</p>}
    {notice && <p className="form-alert success" role="status">{notice}</p>}
    <section className="panel health-id-card">
      <div className="health-id-summary">
        <div className="health-id-icon"><QrCode size={23} /></div>
        <div><span className="workspace-eyebrow">YOUR OPAQUE HEALTH ID</span><h2>{identity?.healthId || "Health ID unavailable"}</h2><p>The QR contains an opaque access-request token only. It does not contain your name, account ID, or medical data.</p></div>
      </div>
      <div className="health-id-actions">
        <button className="primary-button" onClick={() => setShowQr((current) => !current)} disabled={!identity}><Eye size={15} />{showQr ? "Hide QR" : "Show QR"}</button>
        <button className="secondary-button" onClick={copySecureLink} disabled={!identity}><Check size={15} /> Copy secure link</button>
        <button className="secondary-button" onClick={shareSecureLink} disabled={!identity}><Share2 size={15} /> Share link</button>
        <button className="text-button" onClick={() => setShowSecureLink((current) => !current)} disabled={!identity}><Eye size={14} />{showSecureLink ? "Hide link" : "Reveal link"}</button>
        <button className="secondary-button" onClick={downloadQr} disabled={!showQr}><Download size={15} /> Download QR</button>
        <button className="secondary-button" onClick={() => window.print()} disabled={!showQr}><Printer size={15} /> Print QR</button>
        <button className="secondary-button danger-button" onClick={regenerateQr} disabled={busyId === "regenerate"}><RotateCcw size={15} />{busyId === "regenerate" ? "Replacing…" : "Replace QR"}</button>
      </div>
      {identity && <div className="health-id-link-preview"><span>Secure link</span><code>{showSecureLink ? qrUrl : `${window.location.origin}/health-access/••••••••••••••••`}</code></div>}
      {showQr && qrUrl && <div className="health-id-qr" ref={qrRef}><QRCodeCanvas value={qrUrl} size={240} level="H" includeMargin /><p>Ask the care team to scan this code, then review their request below.</p></div>}
    </section>
    <section className="panel health-id-requests">
      <div className="panel-heading"><div><h2><Clock3 size={17} /> Access requests and history</h2><p>Pending requests expire after 15 minutes. Approved access is checked on every request and can be revoked at any time.</p></div><button className="icon-button" onClick={() => refresh().catch((requestError) => setError(messageFrom(requestError)))} aria-label="Refresh access requests"><RefreshCw size={15} /></button></div>
      {identityEvents.length > 0 && <div className="health-id-security-events"><strong>Health ID activity</strong>{identityEvents.slice().reverse().slice(0, 5).map((event, index) => <span key={`${event.event}-${event.occurredAt}-${index}`}>{event.event === "link-regenerated" ? "Secure link replaced" : "Health ID created"} · {formatDate(event.occurredAt, true)}</span>)}</div>}
      {requests.length ? <div className="health-id-request-list">{requests.map((request) => {
        const selected = selectedByRequest[request._id] || [];
        const pending = request.status === "pending";
        const active = request.status === "approved";
        return <article className="health-id-request" key={request._id}>
          <div className="health-id-request-heading"><div><strong>{request.organization}</strong><small>{request.requesterName ? `${request.requesterName} · ` : ""}${requesterRoleLabel(request.requesterRole)} · ${purposeLabel(request.purpose)} · Requested {formatDate(request.requestedAt, true)}</small></div><span className={`status-chip ${active ? "active" : pending ? "pending" : request.status === "denied" || request.status === "revoked" ? "cancelled" : ""}`}>{request.status}</span></div>
          {pending && <>
            <p className="health-id-warning">Requester details are unverified. Select only the records needed for this purpose.</p>
            {availableRecords.length ? <div className="share-record-list">{availableRecords.map((item) => {
              const key = `${item.kind}:${item.id}`;
              return <label className="share-record-row" key={key}><input type="checkbox" checked={selected.includes(key)} onChange={() => setSelectedByRequest((current) => ({ ...current, [request._id]: selected.includes(key) ? selected.filter((value) => value !== key) : [...selected, key] }))} /><span><strong>{item.label}</strong><small>{item.detail}</small></span><span className="share-kind">{item.kind}</span></label>;
            })}</div> : <p className="inline-help">Add health records before approving access.</p>}
            <div className="share-controls"><label>Access duration<select value={expiryByRequest[request._id] || 60} onChange={(event) => setExpiryByRequest((current) => ({ ...current, [request._id]: Number(event.target.value) }))}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={360}>6 hours</option><option value={1440}>24 hours</option><option value={4320}>3 days (maximum)</option></select></label><button className="primary-button" disabled={busyId === request._id || !selected.length} onClick={() => approveRequest(request)}><Check size={15} />{busyId === request._id ? "Approving…" : `Approve ${selected.length} selected`}</button><button className="secondary-button danger-button" disabled={busyId === request._id} onClick={() => denyRequest(request._id)}>Deny</button></div>
          </>}
          {active && <div className="health-id-request-meta"><span>{request.recordCount} selected record{request.recordCount === 1 ? "" : "s"} · {request.accessCount} access event{request.accessCount === 1 ? "" : "s"} · Expires {formatDate(request.expiresAt, true)}</span><button className="secondary-button danger-button compact-button" disabled={busyId === request._id} onClick={() => revokeRequest(request._id)}>Revoke access</button></div>}
          <div className="share-events">{(request.events || []).slice().reverse().slice(0, 6).map((event, index) => <span key={`${request._id}-${event.event}-${index}`}>{event.event} · {formatDate(event.occurredAt, true)}</span>)}</div>
        </article>;
      })}</div> : <EmptyState icon={ShieldCheck} title="No access requests" detail="Requests created by scanning your QR will appear here. Nothing is shared without your approval." />}
    </section>
  </>;
}

function HealthIdAccessRequest({ qrToken }) {
  const [organization, setOrganization] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterRole, setRequesterRole] = useState("physician");
  const [purpose, setPurpose] = useState("care");
  const [requestToken, setRequestToken] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!requestToken) return undefined;
    let active = true;
    const checkStatus = async () => {
      try {
        const response = await api.get(`/health-id/requests/status/${encodeURIComponent(requestToken)}`);
        if (!active) return;
        setStatus(response.status);
        if (response.status === "approved") {
          window.location.replace(`/shared/${requestToken}`);
        }
      } catch (requestError) {
        if (active) setError(messageFrom(requestError));
      }
    };
    checkStatus();
    const interval = window.setInterval(checkStatus, 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [requestToken]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await api.post("/health-id/requests", {
        qrToken,
        organization,
        requesterName,
        requesterRole,
        purpose,
      });
      setRequestToken(response.requestToken);
      setStatus("pending");
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setLoading(false);
    }
  }

  return <main className="public-share-page"><header className="public-share-header"><div className="brand-icon"><HeartPulse size={22} /></div><div><strong>MEDIPILOT AI</strong><span>Altrix Health ID · consent request</span></div><span className="status-chip pending">PROTOTYPE</span></header>
    <section className="panel health-id-access-panel">
      {requestToken ? <div className="public-share-state"><Clock3 size={27} /><h1>{status === "denied" ? "Request declined" : status === "expired" ? "Request expired" : "Waiting for patient approval"}</h1><p>{status === "pending" ? "No patient identity or health information is visible. Keep this page open; it will continue checking for the patient’s decision." : status === "approving" ? "The patient is completing their approval. No health information is available yet." : "This request did not authorize access to any records."}</p>{error && <p className="form-alert error" role="alert">{error}</p>}{["pending", "approving"].includes(status) && <span className="status-chip pending">{status === "pending" ? "PENDING CONSENT" : "APPROVING"}</span>}</div> : <>
        <span className="workspace-eyebrow">NO RECORDS ARE SHARED YET</span><h1>Request patient consent</h1><p>Enter your clinic details and purpose. The patient will choose exactly which records to share and for how long.</p>
        {error && <p className="form-alert error" role="alert">{error}</p>}
        <form className="health-id-request-form" onSubmit={submit}>
          <label>Clinic or organization<input value={organization} onChange={(event) => setOrganization(event.target.value)} maxLength={120} required placeholder="Organization name" /></label>
          <label>Your name <span className="optional-label">Optional · not verified</span><input value={requesterName} onChange={(event) => setRequesterName(event.target.value)} maxLength={100} placeholder="Care team member" /></label>
          <label>Your role <span className="optional-label">Self-reported · not verified</span><select value={requesterRole} onChange={(event) => setRequesterRole(event.target.value)} required><option value="physician">Physician</option><option value="nurse">Nurse</option><option value="technician">Technician</option><option value="administrator">Administrator</option><option value="other">Other</option></select></label>
          <label>Purpose<select value={purpose} onChange={(event) => setPurpose(event.target.value)}><option value="care">Care consultation</option><option value="diagnostic-review">Diagnostic review</option><option value="follow-up">Follow-up care</option><option value="other">Other</option></select></label>
          <button className="primary-button" disabled={loading}>{loading ? "Sending request…" : "Send consent request"}</button>
        </form>
      </>}
    </section><p className="inline-help public-share-disclaimer"><ShieldCheck size={13} /> This is a prototype, not official ABHA/ABDM identity or consent exchange. Requester details are self-reported. Scanning the QR reveals no patient name or records.</p>
  </main>;
}

function PublicSharedRecords({ token }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [briefError, setBriefError] = useState("");
  const [healthBrief, setHealthBrief] = useState(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState("");
  const [downloadingBundle, setDownloadingBundle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => new Date().getTime());

  function exitViewer() {
    window.location.replace("/");
  }

  useEffect(() => {
    let active = true;
    api.get(`/shares/public/${encodeURIComponent(token)}/status`)
      .then(() => api.get(`/shares/public/${encodeURIComponent(token)}`))
      .then((response) => { if (active) setResult(response); })
      .catch((requestError) => { if (active) setError(messageFrom(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!result) return undefined;
    let active = true;
    const verifyAccess = async () => {
      try {
        await api.get(`/shares/public/${encodeURIComponent(token)}/status`);
      } catch (requestError) {
        if (!active) return;
        setError(messageFrom(requestError));
        setResult(null);
        setHealthBrief(null);
      }
    };
    const statusInterval = window.setInterval(verifyAccess, 8000);
    const clockInterval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => {
      active = false;
      window.clearInterval(statusInterval);
      window.clearInterval(clockInterval);
    };
  }, [result, token]);

  if (loading) return <main className="public-share-page"><div className="panel public-share-state">Opening secure record link…</div></main>;
  if (error) return <main className="public-share-page"><div className="panel public-share-state"><ShieldCheck size={24} /><h1>{error.toLowerCase().includes("expired") ? "Access Expired" : error.toLowerCase().includes("revoked") ? "Access Revoked" : "Shared records unavailable"}</h1><p>{error}</p><p>The patient may revoke access at any time. Revocation prevents future access through this application but cannot erase information already downloaded.</p><button className="secondary-button" onClick={exitViewer}><LogOut size={15} /> Exit viewer</button></div></main>;
  if (!result) return <main className="public-share-page"><div className="panel public-share-state"><ShieldCheck size={24} /><h1>Shared records unavailable</h1><p>Access could not be verified.</p><button className="secondary-button" onClick={exitViewer}><LogOut size={15} /> Exit viewer</button></div></main>;

  const resources = result.bundle.entry.map(({ resource }) => resource);
  const patient = resources.find((resource) => resource.resourceType === "Patient");
  const sharedRecords = resources.filter((resource) => resource.resourceType !== "Patient");

  async function download() {
    setDownloadingBundle(true);
    try {
      const latest = await api.get(`/shares/public/${encodeURIComponent(token)}`);
      const blob = new Blob([JSON.stringify(latest.bundle, null, 2)], { type: "application/fhir+json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "shared-health-records-fhir-r4-style.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (requestError) {
      setError(messageFrom(requestError));
      setResult(null);
      setHealthBrief(null);
    } finally {
      setDownloadingBundle(false);
    }
  }

  async function downloadDocument(sharedDocument) {
    setDownloadingDocumentId(sharedDocument.id);
    setDocumentError("");
    try {
      const response = await fetch(`/api/shares/public/${encodeURIComponent(token)}/documents/${encodeURIComponent(sharedDocument.id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("This shared document is no longer available.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = sharedDocument.name || "shared-health-document";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (requestError) {
      setDocumentError(messageFrom(requestError));
    } finally {
      setDownloadingDocumentId("");
    }
  }

  async function generateBrief() {
    setGeneratingBrief(true);
    setBriefError("");
    try {
      const response = await api.post(`/shares/public/${encodeURIComponent(token)}/brief`);
      setHealthBrief(response);
    } catch (requestError) {
      setBriefError(messageFrom(requestError));
    } finally {
      setGeneratingBrief(false);
    }
  }

  const secondsRemaining = Math.max(0, Math.ceil((new Date(result.expiresAt).getTime() - currentTime) / 1000));
  const remainingLabel = secondsRemaining >= 3600
    ? `${Math.floor(secondsRemaining / 3600)}h ${Math.floor((secondsRemaining % 3600) / 60)}m remaining`
    : `${Math.ceil(secondsRemaining / 60)}m remaining`;

  return <main className="public-share-page"><header className="public-share-header"><div className="brand-icon"><HeartPulse size={22} /></div><div><strong>MEDIPILOT AI</strong><span>Patient-shared health records</span></div><span className="status-chip pending">TIME-LIMITED LINK</span><button className="secondary-button compact-button" onClick={exitViewer}><LogOut size={14} /> Exit viewer</button></header><section className="panel public-share-content"><div className="public-share-heading"><div><span className="workspace-eyebrow">READ-ONLY RECORD SHARE</span><h1>{patient?.name?.[0]?.text || "Patient records"}</h1><p>Access expires {formatDate(result.expiresAt, true)} · {remainingLabel}</p>{result.source === "health-id" && <p>Approved {formatDate(result.approvedAt, true)} for {result.organization || "care team"} · {requesterRoleLabel(result.requesterRole)} · {purposeLabel(result.purpose)}.</p>}</div><button className="secondary-button" onClick={download} disabled={downloadingBundle || secondsRemaining === 0}><ArrowDownToLine size={15} /> {downloadingBundle ? "Checking access…" : "Download JSON"}</button></div><div className="sharing-prototype-note"><ShieldCheck size={15} /> Requester identity is self-reported and not verified. Revoke or expiry blocks future app access; already downloaded copies cannot be erased.</div>{documentError && <p className="form-alert error" role="alert">{documentError}</p>}{result.documents?.length > 0 && <div className="share-history-list">{result.documents.map((item) => <article className="share-history-item" key={item.id}><div><strong>{item.name}</strong><small>Shared document · {formatDate(item.createdAt)}</small></div><button className="secondary-button compact-button" disabled={downloadingDocumentId === item.id || secondsRemaining === 0} onClick={() => downloadDocument(item)}><Download size={14} />{downloadingDocumentId === item.id ? "Downloading…" : "Download"}</button></article>)}</div>}<div className="fhir-resource-list">{sharedRecords.map((resource) => <article key={`${resource.resourceType}-${resource.id}`}><span>{resource.resourceType}</span><strong>{resource.code?.text || resource.description || resource.medicationCodeableConcept?.text || resource.type?.text || resource.resourceType}</strong><small>{resource.valueQuantity ? `${resource.valueQuantity.value} ${resource.valueQuantity.unit || ""} · ` : ""}{resource.effectiveDateTime ? formatDate(resource.effectiveDateTime, true) : resource.authoredOn ? formatDate(resource.authoredOn, true) : resource.date ? formatDate(resource.date, true) : resource.status}</small></article>)}</div>{result.source === "health-id" && <section className="health-brief-panel"><div className="panel-heading"><div><h2><Sparkles size={17} /> AI Health Brief</h2><p>Generated only from records approved for this active sharing session.</p></div><button className="primary-button" onClick={generateBrief} disabled={generatingBrief || secondsRemaining === 0}><Sparkles size={15} />{generatingBrief ? "Generating…" : "Generate Health Brief"}</button></div>{briefError && <p className="form-alert error" role="alert">{briefError}</p>}{healthBrief && <><pre className="health-brief-content">{healthBrief.brief}</pre><div className="health-brief-sources"><strong>Authorized source records</strong>{healthBrief.sources.map((source) => <span key={source.id}>{source.title} · {source.type || "Record"} · {source.id}{source.date ? ` · ${formatDate(source.date, true)}` : ""}</span>)}<small>{healthBrief.disclaimer}</small></div></>}</section>}</section><p className="inline-help public-share-disclaimer"><ShieldCheck size={13} /> FHIR R4-style demonstration bundle. This prototype share is not an ABDM consent artefact, clinical advice, or officially validated FHIR profile.</p></main>;
}

export default function PatientWorkspace() {
  const { user, loading: authLoading, login, loginWithGoogle, register, startDemo, logout } = useAuth();
  const [active, setActive] = useState(() => pageFromHash(window.location.hash));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(
    () => localStorage.getItem("medipilot_nav_collapsed") === "true"
  );
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("light");
  const [language, setLanguage] = useState("en");
  const [data, setData] = useState(freshData);
  const [demoDataEnabled, setDemoDataEnabled] = useState(
    () => localStorage.getItem(DEMO_MODE_KEY) === "true"
  );
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [summary, setSummary] = useState("");
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState({});
  const [overviewSummaryDocumentId, setOverviewSummaryDocumentId] = useState("");
  const [visualizerDocumentId, setVisualizerDocumentId] = useState("");
  const t = (value) => labels[language]?.[value] || value;
  const sharedToken = window.location.pathname.match(/^\/shared\/([a-f0-9]{64})$/i)?.[1] || "";
  const healthAccessToken = window.location.pathname.match(/^\/health-access\/([a-f0-9]{64})$/i)?.[1] || "";
  const displayData = useMemo(
    () => demoDataEnabled ? createDemoHealthData() : data,
    [demoDataEnabled, data]
  );
  const bodyFindings = useMemo(
    () => buildBodyFindings(displayData.documents, displayData.labReports, displayData.records),
    [displayData]
  );

  async function refreshData() {
    if (demoDataEnabled) {
      setData(freshData);
      setLoadErrors({});
      setOverviewLoading(false);
      setRefreshing(false);
      return;
    }

    setRefreshing(true);
    const endpoints = [
      ["profile", "/dashboard/me", (result) => result.profile],
      ["documents", "/documents/my", (result) => result.documents || []],
        ["timeline", "/documents/timeline", (result) => result.timeline || []],
      ["records", "/health-records/my", (result) => result.records || []],
      ["appointments", "/appointments/my", (result) => result.appointments || []],
      ["appointmentSuggestions", "/appointments/suggestions/my", (result) => result.suggestions || []],
      ["medications", "/medications/my", (result) => result.medications || []],
      ["labReports", "/lab-reports/my", (result) => result.reports || []],
      ["reminders", "/reminders/my", (result) => result.reminders || []],
      ["conversations", "/conversations/my", (result) => result.conversations || []],
      ["abha", "/abha/my", (result) => result.data || null],
      ["aiStatus", "/conversations/status", (result) => result],
    ];
    const results = await Promise.allSettled(endpoints.map(([, path]) => api.get(path)));
    const nextData = { ...freshData };
    const nextErrors = {};
    results.forEach((result, index) => {
      const [key, , pick] = endpoints[index];
      if (result.status === "fulfilled") nextData[key] = pick(result.value);
      else nextErrors[key] = result.reason?.message || key;
    });
    const medicationSuggestions = await api.get("/medications/suggestions/my")
      .then((result) => ({ status: "fulfilled", value: result.suggestions || [] }))
      .catch((error) => ({ status: "rejected", reason: error }));
    if (medicationSuggestions.status === "fulfilled") {
      nextData.medicationSuggestions = medicationSuggestions.value;
    } else {
      nextErrors.medicationSuggestions = medicationSuggestions.reason?.message || "medication suggestions";
    }
    setData(nextData);
    setLoadErrors(nextErrors);
    setOverviewLoading(false);
    setRefreshing(false);
    if (Object.keys(nextErrors).length && active !== "Overview") {
      const firstFailure = Object.values(nextErrors)[0];
      setNotice({ type: "error", text: `Some workspace data could not be loaded: ${firstFailure}` });
    }
  }

  const refreshDataRef = useRef(refreshData);
  useEffect(() => {
    refreshDataRef.current = refreshData;
  });

  useEffect(() => {
    if (!user) {
      if (demoDataEnabled) {
        localStorage.removeItem(DEMO_MODE_KEY);
        setDemoDataEnabled(false);
      }
      setData(freshData);
      setLoadErrors({});
      setOverviewLoading(false);
      return;
    }
    if (!demoDataEnabled && !sharedToken && !healthAccessToken) {
      refreshDataRef.current();
      return;
    }
    setData(freshData);
    setLoadErrors({});
    setOverviewLoading(false);
  }, [user, demoDataEnabled, sharedToken, healthAccessToken]);

  function toggleDemoData() {
    const nextEnabled = !demoDataEnabled;
    localStorage.setItem(DEMO_MODE_KEY, String(nextEnabled));
    setDemoDataEnabled(nextEnabled);
    setSummary("");
    setNotice({
      type: "success",
      text: nextEnabled
        ? "Fictional demo data is on. It replaces account records in this view and is read-only."
        : user?.isDemo
          ? "Demo preview is off. Your editable guest-session data is shown again."
          : "Demo data is off. Your saved account records are shown again.",
    });
  }

  function logoutFromWorkspace() {
    localStorage.removeItem(DEMO_MODE_KEY);
    setDemoDataEnabled(false);
    logout();
  }

  async function runAction(action, successText, after = true) {
    setBusy(true);
    try {
      const result = await action();
      setNotice({ type: "success", text: successText });
      if (after) await refreshData();
      return result;
    } catch (error) {
      setNotice({ type: "error", text: messageFrom(error) });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument(form) {
    const result = await runAction(() => api.upload("/documents/upload", form), "Document uploaded and processed.", false);
    if (result?.document) {
      await refreshData();
    }
    if (result?.suggestionMessage) {
      setNotice({ type: "error", text: `${result.message} ${result.extractionMessage} ${result.suggestionMessage}` });
    } else if (result?.appointmentSuggestions?.length) {
      const medicationMessage = result.medicationSuggestions?.length
        ? ` ${result.medicationSuggestions.length} possible medicine${result.medicationSuggestions.length === 1 ? "" : "s"} need review in My Medications.`
        : "";
      setNotice({ type: "success", text: `${result.message} ${result.extractionMessage} ${result.appointmentSuggestions.length} possible appointment detail${result.appointmentSuggestions.length === 1 ? "" : "s"} need review in Doctor Appointments.${medicationMessage}` });
    } else if (result?.medicationSuggestions?.length) {
      setNotice({ type: "success", text: `${result.message} ${result.extractionMessage} ${result.medicationSuggestions.length} possible medicine${result.medicationSuggestions.length === 1 ? "" : "s"} need review in My Medications.` });
    } else if (result?.extractionMessage) {
      setNotice({ type: "success", text: `${result.message} ${result.extractionMessage}` });
    }
    return result;
  }

  async function explainDocument(id, requestedLanguage) {
    const doc = displayData.documents.find((item) => item._id === id);
    const language = requestedLanguage || displayData.profile?.preferredLanguage;
    if (doc?.demoSample) {
      const sampleSummary = {
        text: demoReportSummary,
        language: "en",
        documentId: id,
        demoSample: true,
      };
      setSummary(sampleSummary);
      return sampleSummary;
    }
    if (doc?.aiSummary && doc.aiSummaryLanguage === language) {
      const cachedSummary = { text: doc.aiSummary, language, documentId: id };
      setSummary(cachedSummary);
      return cachedSummary;
    }
    const result = await runAction(() => api.post(`/documents/${id}/summarize`, { language }), "Explanation ready.", false);
    if (result?.aiSummary) {
      const savedSummary = { text: result.aiSummary, language: result.language, documentId: id };
      setSummary(savedSummary);
      setData((current) => ({ ...current, documents: current.documents.map((item) => item._id === id ? { ...item, aiSummary: result.aiSummary, aiSummaryLanguage: result.language } : item) }));
      return savedSummary;
    }
    return null;
  }

  async function saveDocumentReview(id, extractedData, documentType, extractedClinicalData) {
    return runAction(
      () => api.patch(`/documents/${id}/review`, { extractedData, extractedClinicalData, documentType }),
      "Reviewed values saved.",
      true
    );
  }

  async function savePreferredLanguage(preferredLanguage) {
    if (demoDataEnabled) return true;

    const result = await runAction(
      () => api.patch("/dashboard/language", { preferredLanguage }),
      "Language preference saved.",
      false
    );
    if (result?.preferredLanguage) {
      setData((current) => ({
        ...current,
        profile: { ...current.profile, preferredLanguage: result.preferredLanguage },
      }));
      return true;
    }
    return false;
  }

  async function reviewDocument(id) {
    const demoDocument = displayData.documents.find(
      (item) => item._id === id && item.demoSample
    );
    if (demoDocument) return demoDocument;

    const result = await runAction(() => api.get(`/documents/${id}`), "Extracted text loaded.", false);
    return result?.document || null;
  }

  function requestOverviewSummary(documentId) {
    const document = displayData.documents.find((item) => item._id === documentId);
    if (document?.demoSample) {
      setSummary({
        text: demoReportSummary,
        language: "en",
        documentId,
        demoSample: true,
      });
      navigate("AI Health Summary");
      return;
    }
    if (document?.reviewStatus === "CONFIRMED") {
      navigate("AI Health Summary");
      return;
    }
    setOverviewSummaryDocumentId(documentId);
    navigate("Health records");
  }

  function openHealthTimeline() {
    navigate("Health Timeline");
  }

  function openVisualizerDocument(documentId) {
    setVisualizerDocumentId(documentId);
    navigate("Health records");
  }

  async function viewReport(documentId) {
    const document = displayData.documents.find((item) => item._id === documentId);
    if (demoDataEnabled || user?.isDemo || document?.demoSample) {
      setVisualizerDocumentId(documentId);
      navigate("Health records");
      return;
    }

    const viewer = window.open("", "_blank");
    if (!viewer) {
      setNotice({ type: "error", text: "Allow pop-ups to view this report in a new tab." });
      return;
    }
    viewer.opener = null;
    viewer.document.title = "Opening report…";
    viewer.document.body.textContent = "Loading your report securely…";

    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/download`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("medipilot_token")}`,
        },
      });
      if (!response.ok) {
        throw new Error("Unable to open this report. Please try again.");
      }
      const blob = await response.blob();
      if (!["application/pdf", "image/jpeg", "image/png"].includes(blob.type)) {
        throw new Error("This report format cannot be previewed in the browser.");
      }
      const objectUrl = URL.createObjectURL(blob);
      viewer.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      viewer.close();
      setNotice({ type: "error", text: messageFrom(error) });
    }
  }

  async function download(id) {
    if (demoDataEnabled || user?.isDemo) {
      setNotice({ type: "error", text: "Demo reports are sample text only and have no downloadable source files." });
      return;
    }

    await runAction(async () => {
      const response = await fetch(`/api/documents/${id}/download`, { headers: { Authorization: `Bearer ${localStorage.getItem("medipilot_token")}` } });
      if (!response.ok) throw new Error("Unable to download this document.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = data.documents.find((item) => item._id === id)?.originalName || "health-record";
      link.click();
      URL.revokeObjectURL(objectUrl);
    }, "Download started.", false);
  }

  async function createConversation() {
    const result = await runAction(() => api.post("/conversations", { title: "Health Assistant Chat" }), "New conversation started.", false);
    if (result?.conversation) setData((current) => ({ ...current, conversations: [result.conversation, ...current.conversations] }));
    return result?.conversation;
  }

  async function sendMessage(id, content) {
    let conversationId = id;
    if (!conversationId) {
      const created = await createConversation();
      conversationId = created?._id;
    }
    if (!conversationId) return;
    const result = await runAction(() => api.post(`/conversations/${conversationId}/messages`, { content }), "Response received.", false);
    if (result?.assistantMessage) {
      setData((current) => ({ ...current, conversations: current.conversations.map((chat) => chat._id === conversationId ? { ...chat, messages: [...(chat.messages || []), result.userMessage, result.assistantMessage] } : chat) }));
    }
    return result;
  }

  function navigate(label) {
    setActive(label);
    setMobileOpen(false);
    setSearch("");
    const route = workspaceRoutes[label];
    if (route && window.location.hash !== `#${route}`) {
      window.history.pushState(null, "", `#${route}`);
    }
  }

  useEffect(() => {
    localStorage.setItem("medipilot_nav_collapsed", String(navCollapsed));
  }, [navCollapsed]);

  useEffect(() => {
    function restoreRoute() {
      setActive(pageFromHash(window.location.hash));
      setMobileOpen(false);
    }
    window.addEventListener("popstate", restoreRoute);
    return () => window.removeEventListener("popstate", restoreRoute);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  if (sharedToken) return <PublicSharedRecords token={sharedToken} />;
  if (healthAccessToken) return <HealthIdAccessRequest qrToken={healthAccessToken} />;
  if (authLoading) return <main className="auth-loading"><span className="loading-mark"><HeartPulse size={22} /></span><p>Opening your private health workspace…</p></main>;
  if (!user) return <AuthScreen
    onLogin={login}
    onGoogleLogin={loginWithGoogle}
    onRegister={register}
    onStartDemo={(name) => {
      localStorage.removeItem(DEMO_MODE_KEY);
      setDemoDataEnabled(false);
      startDemo(name);
    }}
    onForgotPassword={(email) => api.post("/auth/forgot-password", { email })}
    onResetPassword={(token, password) => api.post("/auth/reset-password", { token, password })}
  />;
  if (user.role && user.role !== "PATIENT") return <main className="auth-loading"><div className="panel role-block"><ShieldCheck size={25} /><h1>Patient workspace only</h1><p>Sign in with a patient account to manage personal health information.</p><button className="secondary-button" onClick={logoutFromWorkspace}><LogOut size={15} /> Sign out</button></div></main>;

  const filteredNavigationGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(([, label]) => t(label).toLowerCase().includes(search.toLowerCase())),
    }))
    .filter((group) => group.items.length > 0);
  const currentNavigation = navigationGroups.flatMap((group) => group.items).find(([id]) => id === active);
  const activeLabel = currentNavigation ? t(currentNavigation[1]) : "Health Overview";
  const displayUser = demoDataEnabled ? displayData.profile : (displayData.profile || user);
  const initials = (displayUser?.name || "P").slice(0, 1).toUpperCase();

  return <div className={`app-shell ${theme}`}>
    {mobileOpen && <button className="mobile-overlay" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""} ${navCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="brand"><div className="brand-icon"><HeartPulse size={23} /></div><div><div className="brand-name">MEDIPILOT <span>AI</span></div><div className="brand-caption">PERSONAL HEALTH COPILOT</div></div><button className="icon-button mobile-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <button
        className="nav-collapse-button"
        type="button"
        aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}
        title={navCollapsed ? "Expand navigation" : "Collapse navigation"}
        onClick={() => setNavCollapsed((collapsed) => !collapsed)}
      >
        {navCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        <span>{navCollapsed ? "Expand" : "Collapse"}</span>
      </button>
      <nav className="main-nav" aria-label="Patient workspace navigation">
        {filteredNavigationGroups.map((group) => (
          <section className="nav-group" key={group.title} aria-label={group.title}>
            <div className="nav-label">{group.title}</div>
            {group.items.map(([id, label, Icon, badge]) => (
              <button
                key={id}
                type="button"
                className={`nav-item ${active === id ? "nav-active" : ""}`}
                onClick={() => navigate(id)}
                aria-current={active === id ? "page" : undefined}
                title={navCollapsed ? `${t(label)}${badge ? ` · ${badge}` : ""}` : undefined}
              >
                <Icon size={18} />
                <span>{t(label)}</span>
                {badge && <small className="nav-badge">{badge}</small>}
                {id === "AI assistant" && <span className="nav-ai-dot" />}
              </button>
            ))}
          </section>
        ))}
        {filteredNavigationGroups.length === 0 && <p className="empty-nav">No section matches your search.</p>}
      </nav>
      <div className="sidebar-spacer" /><div className="support-card"><div className="support-icon"><ShieldCheck size={20} /></div><div className="support-title">Privacy comes first</div><p>{demoDataEnabled || user.isDemo ? "Demo information stays in this browser." : "Your records are shown only to your signed-in account."}</p></div>
      <button className="profile-mini" onClick={() => navigate("Settings")} aria-label="Open Profile & Settings"><span className="profile-avatar">{initials}</span><span className="profile-details"><strong>{displayUser?.name || "Patient account"}</strong><span>{demoDataEnabled || user.isDemo ? "Demo mode" : "Profile & settings"}</span></span><UserRound size={15} className="muted-icon" /></button>
    </aside>
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}><Menu size={19} /></button><div className="breadcrumb">MEDIPILOT AI <span>/</span> <strong>{activeLabel}</strong></div></div><div className="topbar-actions"><label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a section" aria-label="Search sections" />{search && <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}</label><button className={`demo-data-button topbar-demo-toggle${demoDataEnabled ? " active" : ""}`} type="button" onClick={toggleDemoData} aria-pressed={demoDataEnabled}><Sparkles size={14} /> Demo {demoDataEnabled ? "On" : "Off"}</button><button className="icon-button language-button" onClick={() => setLanguage(language === "en" ? "hi" : "en")} title="Switch interface language" aria-label="Switch interface language between English and Hindi"><Languages size={17} /><small>{language === "en" ? "EN" : "हि"}</small></button><button className="icon-button theme-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button><button className="topbar-avatar" onClick={() => navigate("Settings")} aria-label="Open settings">{initials}</button></div></header>
      <div className="page-content" key={active}>
        {user.isDemo && !demoDataEnabled && <div className="demo-mode-banner" role="status">
          <ShieldCheck size={17} />
          <span><strong>GUEST SESSION FOR {user.name}</strong> — changes are saved only in this browser tab and deleted when you log out. OCR, AI/RAG, and secure external sharing need connected services.</span>
          <button type="button" onClick={logoutFromWorkspace}>Log out</button>
        </div>}
        {demoDataEnabled && <div className="demo-mode-banner" role="status">
          <ShieldCheck size={17} />
          <span><strong>DEMO DATA ON — synthetic sample records</strong> — these examples replace real account data on every page, including the anatomy view. They are read-only and do not describe a real person.</span>
          <button type="button" onClick={toggleDemoData}>Turn off</button>
        </div>}
        {notice && <div className={`workspace-notice ${notice.type}`} role="status"><span>{notice.text}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={14} /></button></div>}
        {active === "Overview" && <HealthOverview data={displayData} findings={bodyFindings} user={displayUser} goTo={navigate} reload={refreshData} refreshing={refreshing} loading={demoDataEnabled ? false : overviewLoading || refreshing} errors={demoDataEnabled ? {} : loadErrors} onDownload={download} onViewReport={viewReport} demoDataEnabled={demoDataEnabled} onToggleDemoData={toggleDemoData} onRequestSummary={requestOverviewSummary} onViewTimeline={openHealthTimeline} />}
        {active === "Health records" && <HealthRecords data={displayData} onUpload={uploadDocument} onCreateRecord={(body) => runAction(() => api.post("/health-records", body), "Health note saved.")} onSummarize={explainDocument} onReviewDocument={reviewDocument} onSaveReview={saveDocumentReview} onSaveLanguage={savePreferredLanguage} onDownload={download} onViewReport={viewReport} busy={busy} summary={summary} clearSummary={() => setSummary("")} initialSummaryDocumentId={overviewSummaryDocumentId} onConsumeInitialSummary={() => setOverviewSummaryDocumentId("")} initialDocumentId={visualizerDocumentId} onConsumeInitialDocument={() => setVisualizerDocumentId("")} demoDataEnabled={demoDataEnabled} />}
        {active === "AI Health Summary" && <HealthSummaryPage documents={displayData.documents} preferredLanguage={displayData.profile?.preferredLanguage} summary={summary} loading={demoDataEnabled ? false : overviewLoading || refreshing} error={demoDataEnabled ? "" : loadErrors.documents} busy={busy} onRetry={refreshData} onSaveLanguage={savePreferredLanguage} onExplain={explainDocument} onReview={requestOverviewSummary} onDownload={download} onClearSummary={() => setSummary("")} />}
        {active === "Health Timeline" && <HealthTimelinePage timeline={displayData.timeline} loading={demoDataEnabled ? false : overviewLoading || refreshing} error={demoDataEnabled ? "" : loadErrors.timeline} onRetry={refreshData} onDownload={download} onNavigate={navigate} />}
        {active === "Food & Daily Habits" && <FoodDailyHabits documents={displayData.documents} onNavigate={navigate} demoMode={demoDataEnabled} demoNutrition={displayData.nutrition} />}
        {active === "AI Health Visualizer" && <HealthVisualizerPage findings={bodyFindings} onOpenDocument={openVisualizerDocument} />}
        {active === "Appointments" && <DoctorAppointments data={displayData} loading={demoDataEnabled ? false : overviewLoading || refreshing} loadError={demoDataEnabled ? "" : loadErrors.appointments} suggestionError={demoDataEnabled ? "" : loadErrors.appointmentSuggestions} onCreate={(body) => runAction(() => api.post("/appointments", body), "Appointment saved to your personal schedule. No external booking was made.")} onUpdate={(id, body) => runAction(() => api.patch(`/appointments/${id}`, body), "Appointment updated.")} onStatusChange={(id, status) => runAction(() => api.patch(`/appointments/${id}/status`, { status }), status === "CANCELLED" ? "Appointment cancelled and retained in history." : "Appointment marked completed.")} onConfirmSuggestion={(id, body) => runAction(() => api.post(`/appointments/suggestions/${id}/confirm`, body), "Possible appointment details reviewed and saved.")} onIgnoreSuggestion={(id) => runAction(() => api.patch(`/appointments/suggestions/${id}/ignore`, {}), "Possible appointment details dismissed.")} onDownload={download} busy={busy} />}
        {active === "Medications" && <Medications
          data={displayData}
          loadError={demoDataEnabled ? "" : loadErrors.medications || loadErrors.medicationSuggestions}
          loading={demoDataEnabled ? false : overviewLoading || refreshing}
          onRetry={refreshData}
          onNavigate={navigate}
          onCreate={(body) => runAction(() => api.post("/medications", body), "Medication saved.")}
          onUpdate={(id, body) => runAction(() => api.patch(`/medications/${id}`, body), "Medication updated.")}
          onConfirmSuggestion={(id, body) => runAction(() => api.post(`/medications/suggestions/${id}/confirm`, body), "Medicine reviewed and saved to your medication records.")}
          onIgnoreSuggestion={(id) => runAction(() => api.patch(`/medications/suggestions/${id}/ignore`, {}), "Medicine suggestion dismissed.")}
          onDownload={download}
          busy={busy}
        />}
        {active === "Reminders" && <RemindersPage
          data={displayData}
          loadError={demoDataEnabled ? "" : loadErrors.reminders}
          loading={demoDataEnabled ? false : overviewLoading || refreshing}
          onRetry={refreshData}
          onNavigate={navigate}
          onCreate={(body) => runAction(() => api.post("/reminders", body), "Reminder saved to your account. No notification was delivered.")}
          onUpdate={(id, body) => runAction(() => api.patch(`/reminders/${id}`, body), "Reminder updated. No notification delivery is configured.")}
          onComplete={(id) => runAction(() => api.patch(`/reminders/${id}`, { isCompleted: true }), "Reminder marked complete. This does not record notification delivery or change medication details.")}
          onDismiss={(id) => runAction(() => api.patch(`/reminders/${id}/dismiss`, {}), "Reminder dismissed.")}
          onPause={(id) => runAction(() => api.patch(`/reminders/${id}/pause`, {}), "Reminder paused.")}
          onResume={(id) => runAction(() => api.patch(`/reminders/${id}/resume`, {}), "Reminder resumed.")}
          onCancel={(id) => runAction(() => api.patch(`/reminders/${id}/cancel`, {}), "Reminder cancelled and retained in history.")}
          onDownload={download}
          busy={busy}
        />}
        {active === "AI assistant" && <Assistant data={displayData} onCreate={createConversation} onSend={sendMessage} busy={busy} demoMode={demoDataEnabled} />}
        {active === "ABHA profile" && <ABHAProfile key={displayData.abha?._id || "new-abha-profile"} profile={displayData.abha} onSave={(body) => runAction(() => api.put("/abha/my", body), "ABHA profile saved.")} onConsent={(consent) => runAction(() => api.patch("/abha/consent", { consent }), "Sharing consent updated.")} busy={busy} />}
        {active === "FHIR export" && <FhirExport demoMode={demoDataEnabled} documents={displayData.documents} />}
        {active === "Share with Hospital" && <HospitalSharingPage documents={displayData.documents} records={displayData.records} medications={displayData.medications} demoMode={demoDataEnabled} />}
        {active === "Clinic exchange" && <ClinicExchange />}
        {active === "Settings" && <SettingsPage user={displayUser} preferredLanguage={displayData.profile?.preferredLanguage} onSaveLanguage={savePreferredLanguage} onNavigate={navigate} onLogout={logoutFromWorkspace} busy={busy} />}
        <footer className="page-footer"><span>© 2026 MEDIPILOT AI <span>·</span> Personal health, thoughtfully organized.</span><span><ShieldCheck size={13} /> Informational support, not a diagnosis.</span></footer>
      </div>
    </main>
    <FloatingCopilot data={displayData} onCreate={createConversation} onSend={sendMessage} busy={busy} />
  </div>;
}
