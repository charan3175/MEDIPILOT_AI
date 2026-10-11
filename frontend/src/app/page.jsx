
"use client";

import { useState } from "react";
import {
  Activity, Bell, CalendarDays, ChevronDown, ChevronRight, ClipboardList,
  Clock3, FileText, FlaskConical, Heart, Home, MessageCircle, Moon,
  Search, Settings, ShieldAlert, Sparkles, Sun, Users, Wind, Droplet,
  Thermometer, Brain, Plus, ArrowUpRight, Stethoscope, Pill, ChartNoAxesColumn,
  CircleHelp, CheckCircle2, LayoutDashboard, ScanHeart
} from "lucide-react";

const nav = [
  ["Dashboard", LayoutDashboard],
  ["Patients", Users],
  ["Appointments", CalendarDays],
  ["Health Records", ClipboardList],
  ["AI Insights", Sparkles],
  ["Diagnostics", ScanHeart],
  ["Treatments", Stethoscope],
  ["Medications", Pill],
  ["Reports", FileText],
  ["Analytics", ChartNoAxesColumn],
  ["Alerts", Bell],
  ["Messages", MessageCircle],
];

const appointments = [
  { initials: "SJ", name: "Sarah Johnson", detail: "Cardiology consultation", time: "10:00 AM", color: "lavender" },
  { initials: "JW", name: "James Williams", detail: "Follow-up checkup", time: "11:30 AM", color: "mint" },
  { initials: "OB", name: "Olivia Brown", detail: "Blood test", time: "02:00 PM", color: "peach" },
  { initials: "MD", name: "Michael Davis", detail: "X-ray scan", time: "04:30 PM", color: "blue" },
];

const labs = [
  { icon: Droplet, name: "Complete Blood Count", date: "May 14 · 09:24 AM", status: "Normal", tone: "mint" },
  { icon: Heart, name: "Lipid Profile", date: "May 12 · 03:30 PM", status: "Borderline", tone: "peach" },
  { icon: FlaskConical, name: "Liver Function Test", date: "May 10 · 11:45 AM", status: "Normal", tone: "lavender" },
  { icon: Activity, name: "Thyroid Profile", date: "May 8 · 08:20 AM", status: "Normal", tone: "blue" },
  { icon: Sun, name: "Vitamin D", date: "May 5 · 09:15 AM", status: "Normal", tone: "peach" },
];

const risks = [
  { name: "Cardiovascular risk", value: 18, status: "Low", tone: "mint" },
  { name: "Diabetes risk", value: 22, status: "Low", tone: "blue" },
  { name: "Respiratory risk", value: 46, status: "Moderate", tone: "peach" },
  { name: "Stress level", value: 24, status: "Low", tone: "lavender" },
  { name: "Sleep quality", value: 82, status: "Good", tone: "blue" },
];

const activity = [
  ["Lab results for Sarah Johnson are ready", "5 min ago", "mint"],
  ["New patient registered Olivia Brown", "16 min ago", "blue"],
  ["Appointment with James Williams confirmed", "25 min ago", "lavender"],
  ["High BP alert for Michael Davis", "40 min ago", "peach"],
  ["Medication reminder sent to 8 patients", "1 hour ago", "mint"],
];

function Card({ children, className = "" }) {
  return <section className={`mp-card ${className}`}>{children}</section>;
}

function SectionTitle({ title, action = "View all" }) {
  return (
    <div className="mp-section-title">
      <h3>{title}</h3>
      <button className="mp-text-button">{action} <ChevronRight size={14} /></button>
    </div>
  );
}

function Sparkline({ color = "#438dff" }) {
  return (
    <svg className="mp-sparkline" viewBox="0 0 150 30" preserveAspectRatio="none" aria-label="Trend chart">
      <path d="M0 20 C10 22 12 10 22 16 S37 26 47 15 S62 4 72 16 S88 22 98 13 S113 8 122 16 S140 9 150 6"
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function VitalsChart() {
  return (
    <svg className="mp-vitals-chart" viewBox="0 0 640 150" preserveAspectRatio="none" role="img" aria-label="Illustrative heart rate trend chart">
      {[25, 60, 95, 130].map(y => <line key={y} x1="0" y1={y} x2="640" y2={y} stroke="#e8eef8" strokeDasharray="4 5" />)}
      <path d="M0 88 L20 84 L35 89 L50 78 L66 86 L80 81 L94 84 L108 80 L122 84 L136 32 L148 112 L160 83 L180 88 L200 85 L220 91 L240 85 L260 89 L280 82 L300 87 L320 85 L340 89 L360 84 L380 87 L400 82 L420 87 L440 85 L460 89 L480 81 L500 87 L520 84 L540 90 L560 80 L580 86 L600 82 L620 87 L640 84 L640 150 L0 150 Z"
        fill="url(#vitalFill)" opacity=".75" />
      <defs>
        <linearGradient id="vitalFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#55a8ff" stopOpacity=".24" />
          <stop offset="100%" stopColor="#55a8ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 88 L20 84 L35 89 L50 78 L66 86 L80 81 L94 84 L108 80 L122 84 L136 32 L148 112 L160 83 L180 88 L200 85 L220 91 L240 85 L260 89 L280 82 L300 87 L320 85 L340 89 L360 84 L380 87 L400 82 L420 87 L440 85 L460 89 L480 81 L500 87 L520 84 L540 90 L560 80 L580 86 L600 82 L620 87 L640 84"
        fill="none" stroke="#398bfa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function HomePage() {
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const [role, setRole] = useState("Doctor");
  const [search, setSearch] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const greetingName = role === "Patient" ? "Hem Charan" : role === "Hospital Admin" ? "Hospital Admin" : "Dr. Alex";
  const roleSubtitle = role === "Doctor" ? "Cardiologist" : role === "Patient" ? "Your health space" : "Hospital overview";

  return (
    <main className={`mp-app ${dark ? "mp-dark" : ""}`}>
      <aside className="mp-sidebar">
        <button className="mp-brand" onClick={() => setActive("Dashboard")} aria-label="MediPilot home">
          <span className="mp-brand-mark"><Activity size={23} strokeWidth={2.8} /></span>
          <span><strong>MediPilot <em>AI</em></strong><small>Smarter healthcare. Together.</small></span>
        </button>

        <div className="mp-side-label">WORKSPACE</div>
        <nav className="mp-nav">
          {nav.map(([label, Icon]) => (
            <button key={label} onClick={() => setActive(label)} className={`mp-nav-item ${active === label ? "active" : ""}`}>
              <Icon size={18} />
              <span>{label}</span>
              {label === "Alerts" && <b className="mp-count red">3</b>}
              {label === "Messages" && <b className="mp-count blue-count">5</b>}
            </button>
          ))}
        </nav>

        <div className="mp-side-bottom">
          <button className="mp-nav-item" onClick={() => setActive("Settings")}><Settings size={18} /><span>Settings</span></button>
          <div className="mp-assistant-mini">
            <div className="mp-assistant-top"><span>AI Health Assistant</span><span className="mp-online-dot" /></div>
            <div className="mp-orb"><Sparkles size={27} /></div>
            <p>Ask about patient records, reports or health insights.</p>
            <button className="mp-gradient-button" onClick={() => setAssistantOpen(true)}>Chat with AI <ArrowUpRight size={16} /></button>
          </div>
          <div className="mp-sidebar-footer"><span className="mp-online-dot" /> All systems operational</div>
        </div>
      </aside>

      <div className="mp-main">
        <header className="mp-topbar">
          <div className="mp-mobile-brand"><span className="mp-brand-mark"><Activity size={20} /></span><b>MediPilot <em>AI</em></b></div>
          <label className="mp-search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients, records, tests..." /><kbd>⌘ K</kbd></label>
          <div className="mp-top-actions">
            <button className="mp-icon-button" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
            <div className="mp-pop-wrap">
              <button className="mp-icon-button" onClick={() => setShowNotifications(!showNotifications)} aria-label="Notifications"><Bell size={19} /><i className="mp-notification-dot" /></button>
              {showNotifications && <div className="mp-popover"><b>Notifications</b><p>3 alerts need your attention.</p><p>New lab results are available.</p></div>}
            </div>
            <button className="mp-icon-button mp-chat-icon" onClick={() => setAssistantOpen(true)} aria-label="Open AI assistant"><MessageCircle size={19} /></button>
            <div className="mp-pop-wrap">
              <button className="mp-profile" onClick={() => setShowProfile(!showProfile)}>
                <span className="mp-avatar doctor-avatar">AM</span>
                <span className="mp-profile-copy"><b>{role === "Doctor" ? "Dr. Alex Morgan" : greetingName}</b><small>{roleSubtitle}</small></span>
                <ChevronDown size={15} />
              </button>
              {showProfile && <div className="mp-popover mp-role-menu"><b>Preview workspace</b>{["Doctor", "Patient", "Hospital Admin"].map(r => <button key={r} onClick={() => {setRole(r); setShowProfile(false);}}>{r}{role === r && <CheckCircle2 size={15} />}</button>)}<small>Demo switcher · not authentication</small></div>}
            </div>
          </div>
        </header>

        <div className="mp-content">
          <div className="mp-welcome-row">
            <div><div className="mp-eyebrow"><span className="mp-online-dot" /> YOUR HEALTH COMMAND CENTER</div><h1>Good morning, {greetingName} <span className="mp-wave">✦</span></h1><p>Here’s your overview of today’s health insights and activity.</p></div>
            <button className="mp-date-button"><CalendarDays size={16} /> Tuesday, May 14 <ChevronDown size={14} /></button>
          </div>

          {active !== "Dashboard" && <div className="mp-page-notice"><span className="mp-notice-icon"><LayoutDashboard size={18} /></span><div><b>{active}</b><p>You’re previewing the {active.toLowerCase()} section. Dashboard data below is sample data for interface testing.</p></div><button onClick={() => setActive("Dashboard")}>Back to dashboard</button></div>}

          <div className="mp-dashboard-grid">
            <div className="mp-center-column">
              <div className="mp-stat-grid">
                <Card className="mp-stat-card"><div className="mp-stat-top"><span className="mp-icon-tile blue"><Users size={19} /></span><span className="mp-trend up">↗ 12.5%</span></div><p>Total patients</p><strong>{role === "Patient" ? "01" : "2,458"}</strong><small>vs. last month</small><Sparkline /></Card>
                <Card className="mp-stat-card"><div className="mp-stat-top"><span className="mp-icon-tile purple"><CalendarDays size={19} /></span><span className="mp-trend up">↗ 8.3%</span></div><p>Appointments</p><strong>{role === "Patient" ? "02" : "63"}</strong><small>vs. last month</small><Sparkline color="#9b70ed" /></Card>
                <Card className="mp-stat-card"><div className="mp-stat-top"><span className="mp-icon-tile coral"><ShieldAlert size={19} /></span><span className="mp-trend down">↗ 4.2%</span></div><p>Critical alerts</p><strong>12</strong><small>vs. last month</small><Sparkline color="#f47c8d" /></Card>
              </div>

              <Card className="mp-vitals-card">
                <div className="mp-section-title"><div><h3>Vitals overview</h3><p className="mp-muted">Latest readings across monitored health metrics</p></div><button className="mp-date-button small"><CalendarDays size={14} /> Today <ChevronDown size={13} /></button></div>
                <div className="mp-vital-grid">
                  <div className="mp-vital"><span className="mp-vital-icon coral"><Heart size={17} /></span><span><small>Heart rate</small><b>72 <i>bpm</i></b><em>● Normal</em></span></div>
                  <div className="mp-vital"><span className="mp-vital-icon purple"><Activity size={17} /></span><span><small>Blood pressure</small><b>120/80 <i>mmHg</i></b><em>● Normal</em></span></div>
                  <div className="mp-vital"><span className="mp-vital-icon blue"><Droplet size={17} /></span><span><small>Oxygen level</small><b>98 <i>%</i></b><em>● Normal</em></span></div>
                  <div className="mp-vital"><span className="mp-vital-icon peach"><Thermometer size={17} /></span><span><small>Temperature</small><b>36.6 <i>°C</i></b><em>● Normal</em></span></div>
                </div>
                <div className="mp-chart-wrap"><div className="mp-chart-y"><span>120</span><span>80</span><span>40</span></div><div className="mp-chart-area"><VitalsChart /><div className="mp-chart-x"><span>12 AM</span><span>4 AM</span><span>8 AM</span><span>12 PM</span><span>4 PM</span><span>8 PM</span><span>12 AM</span></div></div></div>
                <div className="mp-chart-foot"><span><i className="mp-online-dot" /> Last updated 5 min ago</span><span className="mp-chart-legend"><i /> Illustrative sample trend</span></div>
              </Card>

              <div className="mp-lower-grid">
                <Card className="mp-risk-card">
                  <SectionTitle title="Health risk analysis" action="Details" />
                  <p className="mp-muted mp-card-subtitle">Risk indicators · sample overview</p>
                  <div className="mp-risk-list">{risks.map(r => <div className="mp-risk-row" key={r.name}><span className={`mp-risk-icon ${r.tone}`}><Heart size={15} /></span><span className="mp-risk-name">{r.name}</span><b className={`mp-risk-status ${r.tone}`}>{r.status}</b><div className="mp-progress"><span className={r.tone} style={{width: `${r.value}%`}} /></div><small>{r.value}%</small></div>)}</div>
                </Card>

                <Card className="mp-labs-card">
                  <SectionTitle title="Recent lab results" />
                  <div className="mp-lab-list">{labs.map(l => <div className="mp-lab-row" key={l.name}><span className={`mp-lab-icon ${l.tone}`}><l.icon size={16} /></span><div className="mp-lab-copy"><b>{l.name}</b><small>{l.date}</small></div><span className={`mp-status-pill ${l.tone}`}>{l.status}</span></div>)}</div>
                </Card>

                <Card className="mp-conditions-card">
                  <SectionTitle title="Top conditions" action="This month" />
                  <div className="mp-donut-area"><div className="mp-donut"><div><b>2,458</b><small>Total cases</small></div></div><div className="mp-condition-legend">{[["Hypertension","28%","blue"],["Diabetes","20%","mint"],["Respiratory","18%","sky"],["Cardiovascular","12%","peach"],["Others","22%","purple"]].map(([n,v,c]) => <div key={n}><i className={c} /><span>{n}</span><b>{v}</b></div>)}</div></div>
                </Card>
              </div>

              <Card className="mp-quick-card">
                <SectionTitle title="Quick actions" action="Customize" />
                <div className="mp-quick-grid">
                  {[[Users,"Add patient","Create new profile","blue"],[CalendarDays,"Schedule visit","Book a new slot","purple"],[FlaskConical,"Order lab test","Request test","mint"],[FileText,"Generate report","AI summary","blue"],[ClipboardList,"Prescription","Write prescription","mint"],[MessageCircle,"Send message","To a patient","lavender"]].map(([Icon,title,sub,tone]) => <button className="mp-quick-action" key={title} onClick={() => setActive(title)}><span className={`mp-quick-icon ${tone}`}><Icon size={18} /></span><span><b>{title}</b><small>{sub}</small></span><ChevronRight size={14} /></button>)}
                </div>
              </Card>
            </div>

            <div className="mp-right-column">
              <Card className="mp-appointments-card"><SectionTitle title="Upcoming appointments" /><div className="mp-appointment-list">{appointments.map(a => <div className="mp-appointment" key={a.name}><span className={`mp-person-avatar ${a.color}`}>{a.initials}</span><div className="mp-appointment-copy"><b>{a.name}</b><small>{a.detail}</small><span className="mp-upcoming">Upcoming</span></div><span className="mp-appointment-time">{a.time}</span></div>)}</div><button className="mp-full-button" onClick={() => setActive("Appointments")}>View appointment schedule <ArrowUpRight size={15} /></button></Card>

              <Card className="mp-ai-card"><div className="mp-ai-glow" /><div className="mp-ai-heading"><span className="mp-ai-logo"><Sparkles size={19} /></span><div><h3>AI health insights</h3><span className="mp-new-pill">NEW</span></div></div><p>Discover useful patterns and get a clearer view of health trends.</p><div className="mp-ai-tags"><span><Activity size={12} /> Trend review</span><span><ShieldAlert size={12} /> Risk signals</span></div><button className="mp-gradient-button" onClick={() => setAssistantOpen(true)}>Explore insights <ArrowUpRight size={16} /></button><Sparkles className="mp-ai-decoration" size={65} /></Card>

              <Card className="mp-activity-card"><SectionTitle title="Activity feed" /><div className="mp-activity-list">{activity.map(([text,time,tone],i) => <div className="mp-activity-row" key={text}><span className={`mp-activity-icon ${tone}`}>{i===0?<FlaskConical size={15}/>:i===1?<Users size={15}/>:i===2?<CalendarDays size={15}/>:i===3?<Heart size={15}/>:<Pill size={15}/>}</span><div><p>{text}</p><small>{time}</small></div></div>)}</div><button className="mp-full-button" onClick={() => setActive("Reports")}>View all activity <ChevronRight size={15} /></button></Card>

              <Card className="mp-help-card"><span className="mp-help-icon"><CircleHelp size={19} /></span><div><b>Need a hand?</b><p>Get help finding a feature or understanding your workspace.</p><button onClick={() => setAssistantOpen(true)}>Ask MediPilot AI <ChevronRight size={14} /></button></div></Card>
            </div>
          </div>

          <footer className="mp-footer"><span>© 2026 MediPilot AI</span><span><i className="mp-online-dot" /> Demo workspace · Sample data</span><span>Privacy · Help · About</span></footer>
        </div>
      </div>

      {assistantOpen && <div className="mp-modal-backdrop" onClick={() => setAssistantOpen(false)}><section className="mp-assistant-modal" onClick={e => e.stopPropagation()}><button className="mp-modal-close" onClick={() => setAssistantOpen(false)}>×</button><span className="mp-modal-orb"><Sparkles size={25} /></span><h2>MediPilot AI Assistant</h2><p>Ask questions about health information, lab reports, or how to use the workspace.</p><div className="mp-demo-warning">Demo preview: AI responses are not connected yet. Do not enter real patient information.</div><div className="mp-suggestion-list"><button onClick={() => setSearch("recent lab results")}>Find recent lab results <ChevronRight size={15}/></button><button onClick={() => setSearch("upcoming appointments")}>Review upcoming appointments <ChevronRight size={15}/></button><button onClick={() => setSearch("health trends")}>Explain health trends <ChevronRight size={15}/></button></div><button className="mp-gradient-button mp-modal-done" onClick={() => setAssistantOpen(false)}>Got it</button></section></div>}
    </main>
  );
}
