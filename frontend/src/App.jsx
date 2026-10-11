
import { useState } from "react";
export { default } from "./PatientWorkspace";
import {
  Activity, Bell, CalendarDays, Check, ChevronDown, ClipboardList,
  Clock3, FileHeart, FlaskConical, HeartPulse, Home, Menu, MessageCircle,
  Moon, Pill, Plus, Search, Settings, ShieldCheck, Stethoscope, Sun,
  Users, X, BrainCircuit, ArrowUpRight, TrendingUp, FileText,
} from "lucide-react";
import "./App.css";

const roles = {
  PATIENT: {
    label: "Patient portal",
    nav: [
      ["Overview", Home],
      ["AI Health Assistant", BrainCircuit],
      ["Medical Records", FileHeart],
      ["Appointments", CalendarDays],
      ["Lab Reports", FlaskConical],
      ["Medications", Pill],
      ["Reminders", Clock3],
    ],
  },
  DOCTOR: {
    label: "Doctor portal",
    nav: [
      ["Overview", Home],
      ["Appointments", CalendarDays],
      ["Patients", Users],
      ["Prescriptions", ClipboardList],
      ["Medical Records", FileHeart],
      ["AI Health Assistant", BrainCircuit],
    ],
  },
  HOSPITAL_ADMIN: {
    label: "Hospital admin",
    nav: [
      ["Overview", Home],
      ["Doctors", Stethoscope],
      ["Appointments", CalendarDays],
      ["Lab Tests", FlaskConical],
      ["Hospitals", ShieldCheck],
      ["Support Tickets", MessageCircle],
      ["Feedback", ClipboardList],
    ],
  },
};

const stats = [
  { label: "Health score", value: "86", unit: "/100", change: "+4.2%", icon: HeartPulse, color: "teal" },
  { label: "Appointments", value: "04", unit: "upcoming", change: "Next: Tomorrow", icon: CalendarDays, color: "blue" },
  { label: "Medical records", value: "12", unit: "documents", change: "2 added recently", icon: FileText, color: "purple" },
  { label: "Active medications", value: "03", unit: "medications", change: "All on schedule", icon: Pill, color: "orange" },
];

const appointments = [
  { initials: "AS", name: "Dr. Ananya Sharma", specialty: "Cardiologist", date: "Tomorrow, 10:30 AM", type: "Video consultation", color: "avatar-teal" },
  { initials: "RK", name: "Dr. Rahul Kumar", specialty: "General physician", date: "14 Oct, 02:00 PM", type: "In-person visit", color: "avatar-purple" },
  { initials: "PM", name: "Dr. Priya Mehta", specialty: "Dermatologist", date: "18 Oct, 11:00 AM", type: "Video consultation", color: "avatar-blue" },
];

function App() {
  const [theme, setTheme] = useState("dark");
  const [role, setRole] = useState("PATIENT");
  const [active, setActive] = useState("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const currentRole = roles[role];
  const dark = theme === "dark";

  function selectRole(nextRole) {
    setRole(nextRole);
    setActive("Overview");
    setMobileOpen(false);
  }

  return (
    <div className={`app-shell ${dark ? "dark" : "light"}`}>
      {mobileOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><Activity size={24} /></div>
          <div>
            <div className="brand-name">MediPilot<span> AI</span></div>
            <div className="brand-caption">YOUR HEALTH, IN SYNC</div>
          </div>
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={19} />
          </button>
        </div>

        <div className="role-box">
          <span className="eyebrow">WORKSPACE</span>
          <select value={role} onChange={(e) => selectRole(e.target.value)} aria-label="Preview role">
            <option value="PATIENT">Patient portal</option>
            <option value="DOCTOR">Doctor portal</option>
            <option value="HOSPITAL_ADMIN">Hospital admin</option>
          </select>
          <ChevronDown className="role-chevron" size={15} />
        </div>

        <div className="nav-label">MENU</div>
        <nav className="main-nav">
          {currentRole.nav.map(([label, Icon]) => (
            <button
              key={label}
              className={`nav-item ${active === label ? "nav-active" : ""}`}
              onClick={() => {
                setActive(label);
                setMobileOpen(false);
              }}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "AI Health Assistant" && <span className="nav-ai-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="support-card">
          <div className="support-icon"><BrainCircuit size={21} /></div>
          <div className="support-title">Your AI health companion</div>
          <p>Understand your health records with helpful AI insights.</p>
          <button onClick={() => setActive("AI Health Assistant")}>
            Explore assistant <ArrowUpRight size={15} />
          </button>
        </div>

        <button className="nav-item settings-item" onClick={() => setActive("Settings")}>
          <Settings size={19} /><span>Settings</span>
        </button>

        <div className="profile-mini">
          <div className="profile-avatar">HC</div>
          <div className="profile-details">
            <strong>{role === "PATIENT" ? "Hem Charan" : role === "DOCTOR" ? "Doctor preview" : "Admin preview"}</strong>
            <span>{currentRole.label}</span>
          </div>
          <ChevronDown size={16} className="muted-icon" />
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu size={21} />
            </button>
            <div className="breadcrumb">Workspace <span>/</span> <strong>{active}</strong></div>
          </div>

          <div className="topbar-actions">
            <label className="search-box">
              <Search size={17} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search anything..." />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button theme-button" onClick={() => setTheme(dark ? "light" : "dark")} aria-label="Toggle color theme" title="Toggle light/dark mode">
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <div className="notification-wrap">
              <button className="icon-button notification-button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notifications">
                <Bell size={19} /><i />
              </button>
              {notificationsOpen && (
                <div className="notification-popover">
                  <strong>Notifications</strong>
                  <p>Your next appointment is coming up.</p>
                  <p>Remember to review your latest lab report.</p>
                  <button onClick={() => setNotificationsOpen(false)}>Close</button>
                </div>
              )}
            </div>
            <div className="topbar-avatar">HC</div>
          </div>
        </header>

        <div className="page-content">
          {active === "Overview" ? (
            <>
              <section className="welcome-row">
                <div>
                  <div className="welcome-date"><span className="status-dot" /> SATURDAY, OCTOBER 10</div>
                  <h1>Your health, <span>in focus.</span></h1>
                  <p>A clearer picture of your health starts here. Here's your overview.</p>
                </div>
                <button className="primary-button" onClick={() => setActive("Appointments")}>
                  <Plus size={18} /> Book appointment
                </button>
              </section>

              <section className="health-banner">
                <div className="banner-orb orb-one" />
                <div className="banner-orb orb-two" />
                <div className="banner-copy">
                  <div className="banner-kicker"><Activity size={15} /> MEDIPILOT INTELLIGENCE</div>
                  <h2>A little progress, every day.</h2>
                  <p>Your health information, care team and next steps — all in one place.</p>
                  <button onClick={() => setActive("AI Health Assistant")}>Explore AI insights <ArrowUpRight size={16} /></button>
                </div>
                <div className="banner-art">
                  <div className="pulse-ring ring-one" />
                  <div className="pulse-ring ring-two" />
                  <div className="pulse-center"><HeartPulse size={40} /></div>
                  <div className="floating-chip chip-top"><Activity size={14} /> Health overview</div>
                  <div className="floating-chip chip-bottom"><Check size={14} /> Care in sync</div>
                </div>
              </section>

              <section className="section-heading">
                <div><h2>Your health at a glance</h2><p>A snapshot of your personal health workspace</p></div>
                <button className="text-button" onClick={() => setActive("Medical Records")}>View records <ArrowUpRight size={15} /></button>
              </section>

              <section className="stats-grid">
                {stats.map(({ label, value, unit, change, icon: Icon, color }) => (
                  <article className="stat-card" key={label}>
                    <div className={`stat-icon ${color}`}><Icon size={20} /></div>
                    <div className="stat-label">{label}</div>
                    <div className="stat-value">{value}<span>{unit}</span></div>
                    <div className="stat-change"><TrendingUp size={14} /> {change}</div>
                  </article>
                ))}
              </section>

              <section className="content-grid">
                <article className="panel appointments-panel">
                  <div className="panel-heading">
                    <div><h2>Upcoming appointments</h2><p>Your care, planned ahead</p></div>
                    <button className="icon-button" onClick={() => setActive("Appointments")} aria-label="View appointments"><ArrowUpRight size={18} /></button>
                  </div>
                  <div className="appointment-list">
                    {appointments.map((appointment) => (
                      <div className="appointment-row" key={appointment.name}>
                        <div className={`doctor-avatar ${appointment.color}`}>{appointment.initials}</div>
                        <div className="appointment-info">
                          <strong>{appointment.name}</strong>
                          <span>{appointment.specialty}</span>
                          <small><CalendarDays size={13} /> {appointment.date}</small>
                        </div>
                        <span className="appointment-type">{appointment.type}</span>
                      </div>
                    ))}
                  </div>
                  <button className="panel-footer-button" onClick={() => setActive("Appointments")}>View all appointments <ArrowUpRight size={15} /></button>
                </article>

                <article className="panel assistant-panel">
                  <div className="assistant-heading">
                    <div className="assistant-icon"><BrainCircuit size={21} /></div>
                    <div><h2>AI health assistant</h2><p>Your health questions, thoughtfully answered</p></div>
                    <span className="online-dot" />
                  </div>
                  <div className="assistant-message">
                    <div className="assistant-mini-icon"><BrainCircuit size={16} /></div>
                    <p>Hi there! I can help you understand your uploaded reports, organize your health records, and prepare questions for your doctor.</p>
                  </div>
                  <div className="suggestion-label">TRY ASKING</div>
                  <button className="suggestion" onClick={() => setActive("AI Health Assistant")}>Help me understand my lab report <ArrowUpRight size={15} /></button>
                  <button className="suggestion" onClick={() => setActive("AI Health Assistant")}>Prepare questions for my doctor <ArrowUpRight size={15} /></button>
                  <button className="assistant-cta" onClick={() => setActive("AI Health Assistant")}>Open AI assistant <ArrowUpRight size={16} /></button>
                  <p className="medical-note"><ShieldCheck size={13} /> AI is informational and doesn't replace professional medical advice.</p>
                </article>
              </section>

              <footer className="page-footer">
                <span>© 2026 MediPilot AI</span>
                <span><ShieldCheck size={14} /> Your health data deserves privacy.</span>
              </footer>
            </>
          ) : (
            <section className="module-placeholder">
              <div className="placeholder-icon"><FileHeart size={27} /></div>
              <span className="eyebrow">{currentRole.label.toUpperCase()}</span>
              <h1>{active}</h1>
              <p>This workspace is ready for the {active.toLowerCase()} module.</p>
              <p className="placeholder-help">Next, we'll connect this screen to the matching Express API and add its real forms, tables, and workflows.</p>
              <button className="primary-button" onClick={() => setActive("Overview")}>Back to overview</button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export { App as LegacyDashboardPreview };
