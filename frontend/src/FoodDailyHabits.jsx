import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, Check, Clock3, Droplets, FileHeart, Moon,
  Plus, ShieldCheck, Sparkles, Trash2, Utensils,
} from "lucide-react";
import { api } from "./services/api";

const blankProfile = {
  dietaryPreference: "",
  allergies: [],
  foodAllergiesReviewed: false,
  restrictions: [],
  healthGoals: [],
  waterGoalMl: "",
  exerciseGoalMinutes: "",
  sleepGoalHours: "",
};

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDay(value, options = { dateStyle: "medium" }) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, options).format(date);
}

function listText(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function parseList(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function displayDuration(minutes) {
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours}h` : "", remainder ? `${remainder}m` : ""].filter(Boolean).join(" ");
}

function estimateSummary(estimate = {}) {
  const values = [
    estimate.calories != null ? `~${estimate.calories} kcal` : "",
    estimate.proteinGrams != null ? `${estimate.proteinGrams} g protein` : "",
    estimate.carbohydrateGrams != null ? `${estimate.carbohydrateGrams} g carbohydrates` : "",
    estimate.fatGrams != null ? `${estimate.fatGrams} g fat` : "",
  ].filter(Boolean);
  return values.length ? `Self-entered estimate: ${values.join(" · ")}` : "";
}

const entryMeta = {
  MEAL: { label: "Meal", Icon: Utensils },
  WATER: { label: "Water", Icon: Droplets },
  EXERCISE: { label: "Exercise", Icon: Activity },
  SLEEP: { label: "Sleep", Icon: Moon },
};

function PageHeading({ eyebrow, title, detail }) {
  return <div className="workspace-heading">
    <div><span className="workspace-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>
  </div>;
}

export default function FoodDailyHabits({
  documents = [],
  onNavigate,
  demoMode = false,
  demoNutrition,
}) {
  const [selectedDate, setSelectedDate] = useState(localDateString);
  const [profile, setProfile] = useState(blankProfile);
  const [healthRecordAllergies, setHealthRecordAllergies] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedReports, setSelectedReports] = useState([]);
  const [plannerResult, setPlannerResult] = useState(null);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [profileDraft, setProfileDraft] = useState(blankProfile);
  const [entryType, setEntryType] = useState("MEAL");
  const [entryTitle, setEntryTitle] = useState("");
  const [entryDetails, setEntryDetails] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDuration, setEntryDuration] = useState("");
  const [nutritionDraft, setNutritionDraft] = useState({ calories: "", proteinGrams: "", carbohydrateGrams: "", fatGrams: "" });
  const [editingId, setEditingId] = useState("");
  const [activeTab, setActiveTab] = useState("today");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    if (demoMode) {
      setEntries(demoNutrition?.entries || []);
      return;
    }

    const result = await api.get(`/nutrition/my?date=${encodeURIComponent(selectedDate)}`);
    const nextProfile = { ...blankProfile, ...(result.profile || {}) };
    setProfile(nextProfile);
    setProfileDraft({
      ...nextProfile,
      waterGoalMl: nextProfile.waterGoalMl ?? "",
      exerciseGoalMinutes: nextProfile.exerciseGoalMinutes ?? "",
      sleepGoalHours: nextProfile.sleepGoalHours ?? "",
    });
    setHealthRecordAllergies(result.healthRecordAllergies || []);
    setEntries(result.entries || []);
  }

  useEffect(() => {
    if (demoMode) {
      const nextProfile = { ...blankProfile, ...(demoNutrition?.profile || {}) };
      setProfile(nextProfile);
      setProfileDraft({
        ...nextProfile,
        waterGoalMl: nextProfile.waterGoalMl ?? "",
        exerciseGoalMinutes: nextProfile.exerciseGoalMinutes ?? "",
        sleepGoalHours: nextProfile.sleepGoalHours ?? "",
      });
      setHealthRecordAllergies(demoNutrition?.healthRecordAllergies || []);
      setEntries(demoNutrition?.entries || []);
      setSelectedReports(documents
        .filter((document) => document.demoSample && document.reviewStatus === "CONFIRMED")
        .map((document) => document._id));
      setError("");
      setLoading(false);
      return undefined;
    }

    let active = true;
    api.get(`/nutrition/my?date=${encodeURIComponent(selectedDate)}`)
      .then((result) => {
        if (!active) return;
        const nextProfile = { ...blankProfile, ...(result.profile || {}) };
        setProfile(nextProfile);
        setProfileDraft({
          ...nextProfile,
          waterGoalMl: nextProfile.waterGoalMl ?? "",
          exerciseGoalMinutes: nextProfile.exerciseGoalMinutes ?? "",
          sleepGoalHours: nextProfile.sleepGoalHours ?? "",
        });
        setHealthRecordAllergies(result.healthRecordAllergies || []);
        setEntries(result.entries || []);
        setError("");
      })
      .catch((requestError) => { if (active) setError(requestError.message || "Unable to load food and habit data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedDate, demoMode, demoNutrition, documents]);

  const dayEntries = useMemo(
    () => entries.filter((entry) => entry.entryDate === selectedDate),
    [entries, selectedDate],
  );
  const weekDays = useMemo(() => {
    const end = new Date(`${selectedDate}T12:00:00`);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(end);
      day.setDate(end.getDate() - 6 + index);
      return localDateString(day);
    });
  }, [selectedDate]);

  const totals = useMemo(() => ({
    meals: dayEntries.filter((entry) => entry.entryType === "MEAL").length,
    water: dayEntries.filter((entry) => entry.entryType === "WATER").reduce((sum, entry) => sum + (entry.amountMl || 0), 0),
    exercise: dayEntries.filter((entry) => entry.entryType === "EXERCISE").reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0),
    sleep: dayEntries.filter((entry) => entry.entryType === "SLEEP").reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0),
    calories: dayEntries.filter((entry) => entry.entryType === "MEAL").reduce((sum, entry) => sum + (entry.nutritionEstimate?.calories || 0), 0),
    estimatedMealCount: dayEntries.filter((entry) => entry.entryType === "MEAL" && entry.nutritionEstimate?.calories != null).length,
    protein: dayEntries.filter((entry) => entry.entryType === "MEAL").reduce((sum, entry) => sum + (entry.nutritionEstimate?.proteinGrams || 0), 0),
    carbohydrates: dayEntries.filter((entry) => entry.entryType === "MEAL").reduce((sum, entry) => sum + (entry.nutritionEstimate?.carbohydrateGrams || 0), 0),
    fat: dayEntries.filter((entry) => entry.entryType === "MEAL").reduce((sum, entry) => sum + (entry.nutritionEstimate?.fatGrams || 0), 0),
  }), [dayEntries]);

  const weeklyRows = useMemo(() => weekDays.map((date) => {
    const dailyEntries = entries.filter((entry) => entry.entryDate === date);
    return {
      date,
      meals: dailyEntries.filter((entry) => entry.entryType === "MEAL").length,
      water: dailyEntries.filter((entry) => entry.entryType === "WATER").reduce((sum, entry) => sum + (entry.amountMl || 0), 0),
      exercise: dailyEntries.filter((entry) => entry.entryType === "EXERCISE").reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0),
      sleep: dailyEntries.filter((entry) => entry.entryType === "SLEEP").reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0),
      estimatedCalories: dailyEntries.filter((entry) => entry.entryType === "MEAL").reduce((sum, entry) => sum + (entry.nutritionEstimate?.calories || 0), 0),
      estimatedMealCount: dailyEntries.filter((entry) => entry.entryType === "MEAL" && entry.nutritionEstimate?.calories != null).length,
      activeHabits: new Set(dailyEntries.map((entry) => entry.entryType)).size,
    };
  }), [entries, weekDays]);

  function clearEntryForm() {
    setEntryTitle("");
    setEntryDetails("");
    setEntryAmount("");
    setEntryDuration("");
    setNutritionDraft({ calories: "", proteinGrams: "", carbohydrateGrams: "", fatGrams: "" });
    setEditingId("");
  }

  function editEntry(entry) {
    setEntryType(entry.entryType);
    setEntryTitle(entry.title);
    setEntryDetails(entry.details || "");
    setEntryAmount(entry.amountMl ?? "");
    setEntryDuration(entry.durationMinutes ?? "");
    setNutritionDraft(Object.fromEntries(
      ["calories", "proteinGrams", "carbohydrateGrams", "fatGrams"]
        .map((field) => [field, entry.nutritionEstimate?.[field] ?? ""]),
    ));
    setEditingId(entry._id);
    setActiveTab("log");
  }

  async function saveEntry(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const body = {
      entryDate: selectedDate,
      entryType,
      title: entryTitle,
      details: entryDetails,
      ...(entryType === "WATER" ? { amountMl: Number(entryAmount) } : {}),
      ...(["EXERCISE", "SLEEP"].includes(entryType) ? { durationMinutes: Number(entryDuration) } : {}),
      ...(entryType === "MEAL" ? {
        nutritionEstimate: Object.fromEntries(
          Object.entries(nutritionDraft)
            .filter(([, value]) => value !== "")
            .map(([key, value]) => [key, Number(value)]),
        ),
      } : {}),
    };
    try {
      if (editingId) await api.patch(`/nutrition/entries/${editingId}`, body);
      else await api.post("/nutrition/entries", body);
      await refresh();
      clearEntryForm();
      setNotice(editingId ? "Daily entry updated." : "Daily entry saved to your account.");
    } catch (requestError) {
      setError(requestError.message || "Unable to save this daily entry.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.delete(`/nutrition/entries/${id}`);
      await refresh();
      if (editingId === id) clearEntryForm();
      setNotice("Daily entry deleted.");
    } catch (requestError) {
      setError(requestError.message || "Unable to delete this daily entry.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const body = {
      dietaryPreference: profileDraft.dietaryPreference,
      allergies: parseList(profileDraft.allergiesText ?? listText(profileDraft.allergies)),
      foodAllergiesReviewed: Boolean(profileDraft.foodAllergiesReviewed),
      restrictions: parseList(profileDraft.restrictionsText ?? listText(profileDraft.restrictions)),
      healthGoals: parseList(profileDraft.goalsText ?? listText(profileDraft.healthGoals)),
      waterGoalMl: profileDraft.waterGoalMl === "" ? null : Number(profileDraft.waterGoalMl),
      exerciseGoalMinutes: profileDraft.exerciseGoalMinutes === "" ? null : Number(profileDraft.exerciseGoalMinutes),
      sleepGoalHours: profileDraft.sleepGoalHours === "" ? null : Number(profileDraft.sleepGoalHours),
    };
    try {
      const result = await api.put("/nutrition/preferences", body);
      const nextProfile = { ...blankProfile, ...(result.profile || {}) };
      setProfile(nextProfile);
      setProfileDraft({
        ...nextProfile,
        waterGoalMl: nextProfile.waterGoalMl ?? "",
        exerciseGoalMinutes: nextProfile.exerciseGoalMinutes ?? "",
        sleepGoalHours: nextProfile.sleepGoalHours ?? "",
      });
      setPlannerResult(null);
      setNotice("Preferences and personal goals saved.");
    } catch (requestError) {
      setError(requestError.message || "Unable to save preferences.");
    } finally {
      setBusy(false);
    }
  }

  async function generatePlan(event) {
    event.preventDefault();
    setPlannerLoading(true);
    setPlannerResult(null);
    setError("");
    try {
      const result = await api.post("/nutrition/diet-plan", { documentIds: selectedReports, date: selectedDate });
      setPlannerResult(result);
    } catch (requestError) {
      setError(requestError.message || "Unable to generate evidence-grounded recommendations.");
    } finally {
      setPlannerLoading(false);
    }
  }

  function toggleReport(id) {
    setSelectedReports((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
    setPlannerResult(null);
  }

  const confirmedReports = documents.filter((document) =>
    document.reviewStatus === "CONFIRMED"
    && (document.extractedData || []).some((item) => item.verificationStatus === "CONFIRMED")
  );
  const mergedAllergies = [...new Set([
    ...(profile.allergies || []),
    ...healthRecordAllergies.map((item) => item.details || item.title).filter(Boolean),
  ])];
  const draftString = (key, source) => profileDraft[`${key}Text`] ?? listText(profileDraft[source]);

  return <>
    <PageHeading
      eyebrow="YOUR PERSONAL ROUTINE"
      title="Food & Daily Habits"
      detail="Keep a private food and activity log, review your week, and request cautious AI suggestions grounded in reviewed sources."
    />
    {demoMode && <div className="sharing-prototype-note"><ShieldCheck size={15} /> Sample water, activity, and sleep entries are fictional. Demo mode is read-only, and the AI planner does not generate personal recommendations from sample reports.</div>}
    <div className="nutrition-safety-note"><ShieldCheck size={16} /><span>Your entries are private to your account. AI planning uses only reports you select and confirm; no result is inferred from unreviewed data. This is informational support, not medical care.</span></div>
    <div className="nutrition-tabs" role="tablist" aria-label="Food and daily habits sections">
      {[
        ["today", "Today", Activity],
        ["log", "Food & habit log", Utensils],
        ["planner", "AI Diet Planner", Sparkles],
        ["preferences", "Preferences & goals", ShieldCheck],
      ].map(([key, label, Icon]) => <button
        type="button"
        role="tab"
        aria-selected={activeTab === key}
        className={activeTab === key ? "selected" : ""}
        key={key}
        onClick={() => setActiveTab(key)}
      ><Icon size={15} />{label}</button>)}
    </div>
    {error && <p className="form-alert error" role="alert">{error}</p>}
    {notice && <p className="form-alert success" role="status">{notice}</p>}

    {activeTab === "today" && <div className="nutrition-page">
      <section className="panel nutrition-day-panel">
        <div><span className="workspace-eyebrow">DAILY CHECK-IN</span><h2>Daily habits</h2><p>Only logged activity is counted. A blank tracker is not treated as a missed health goal.</p></div>
        <label className="nutrition-date-picker">Date<input type="date" value={selectedDate} onChange={(event) => { setLoading(true); setSelectedDate(event.target.value); }} /></label>
      </section>
      {loading ? <div className="panel overview-loading" role="status">Loading your saved entries…</div> : <div className="nutrition-summary-grid">
        <article className="panel nutrition-summary-card"><span><Utensils size={16} /> Meals logged</span><strong>{totals.meals}</strong><small>{totals.estimatedMealCount ? `${totals.estimatedMealCount} meal estimate${totals.estimatedMealCount === 1 ? "" : "s"} · ~${totals.calories} kcal, ${totals.protein} g protein, ${totals.carbohydrates} g carbs, ${totals.fat} g fat` : "No nutrition estimates entered"}</small></article>
        <article className="panel nutrition-summary-card"><span><Droplets size={16} /> Water logged</span><strong>{totals.water.toLocaleString()} <small>mL</small></strong><small>{profile.waterGoalMl ? `${Math.min(100, Math.round((totals.water / profile.waterGoalMl) * 100))}% of your personal goal (${profile.waterGoalMl.toLocaleString()} mL)` : "Set a personal goal in Preferences"}</small></article>
        <article className="panel nutrition-summary-card"><span><Activity size={16} /> Exercise logged</span><strong>{displayDuration(totals.exercise) || "0m"}</strong><small>{profile.exerciseGoalMinutes ? `${Math.min(100, Math.round((totals.exercise / profile.exerciseGoalMinutes) * 100))}% of your personal goal` : "Set a personal goal in Preferences"}</small></article>
        <article className="panel nutrition-summary-card"><span><Moon size={16} /> Sleep logged</span><strong>{displayDuration(totals.sleep) || "0m"}</strong><small>{profile.sleepGoalHours ? `${Math.min(100, Math.round((totals.sleep / (profile.sleepGoalHours * 60)) * 100))}% of your personal goal` : "Set a personal goal in Preferences"}</small></article>
      </div>}
      <section className="panel nutrition-progress-panel">
        <div className="panel-heading"><div><h2>Nutrition progress</h2><p>Seven-day history ending {formatDay(selectedDate)} · based only on your saved logs</p></div><button className="secondary-button compact-button" onClick={() => setActiveTab("log")}><Plus size={14} /> Add entry</button></div>
        {loading ? <div className="overview-loading">Loading weekly history…</div> : <div className="nutrition-week-grid">{weeklyRows.map((row) => <article className="nutrition-week-day" key={row.date}>
          <time>{formatDay(row.date, { weekday: "short", month: "short", day: "numeric" })}</time>
          <div className="nutrition-week-bars" aria-label={`${row.activeHabits} habit types logged`}>
            {[
              ["Meals", row.meals, "meal"],
              ["Water", row.water, "water"],
              ["Exercise", row.exercise, "exercise"],
              ["Sleep", row.sleep, "sleep"],
            ].map(([label, amount, style]) => {
              const goal = style === "water" ? profile.waterGoalMl : style === "exercise" ? profile.exerciseGoalMinutes : style === "sleep" ? profile.sleepGoalHours * 60 : null;
              const percentage = goal ? Math.min(100, amount / goal * 100) : Math.min(100, amount > 0 ? (style === "meal" ? amount * 25 : 100) : 0);
              return <div className={`nutrition-week-bar ${style}`} key={style} title={`${label}: ${amount}${style === "water" ? " mL" : style === "exercise" || style === "sleep" ? " min" : ""}`}>
                <span style={{ width: `${percentage}%` }} />
              </div>;
            })}
          </div>
          <small>{row.activeHabits}/4 habit types{row.estimatedMealCount ? ` · ~${row.estimatedCalories} kcal entered for ${row.estimatedMealCount} meal${row.estimatedMealCount === 1 ? "" : "s"}` : ""}</small>
        </article>)}</div>}
        <div className="nutrition-chart-legend"><span><i className="meal" /> Meals</span><span><i className="water" /> Water</span><span><i className="exercise" /> Exercise</span><span><i className="sleep" /> Sleep</span></div>
        <p className="inline-help">Progress bars compare logs with your own saved goals when available; meal bars indicate whether meals were logged, not whether they meet a nutrition target.</p>
      </section>
      <section className="panel nutrition-allergy-summary">
        <div><h2><ShieldCheck size={16} /> Allergy and restriction safety</h2><p>{mergedAllergies.length ? mergedAllergies.join(", ") : "No allergy information entered in Food & Daily Habits."}</p>{profile.restrictions?.length > 0 && <small>Food restrictions: {profile.restrictions.join(", ")}</small>}</div>
        <button className="secondary-button compact-button" onClick={() => setActiveTab("preferences")}>Review preferences <ArrowRight size={14} /></button>
      </section>
    </div>}

    {activeTab === "log" && <div className="nutrition-page">
      <section className="panel nutrition-entry-panel">
        <div className="panel-heading"><div><h2>{editingId ? "Edit daily entry" : "Log food and daily habits"}</h2><p>Entries are saved to your account and can be edited or deleted.</p></div></div>
        <form className="nutrition-entry-form" onSubmit={saveEntry}>
          <label>Entry type<select value={entryType} onChange={(event) => { setEntryType(event.target.value); clearEntryForm(); }}>
            {Object.entries(entryMeta).map(([type, item]) => <option value={type} key={type}>{item.label}</option>)}
          </select></label>
          <label>Date<input type="date" required value={selectedDate} onChange={(event) => { setLoading(true); setSelectedDate(event.target.value); }} /></label>
          <label className="field-wide">{entryType === "MEAL" ? "Food / meal" : entryType === "WATER" ? "Water entry" : entryType === "EXERCISE" ? "Activity" : "Sleep"}
            <input required maxLength={120} value={entryTitle} onChange={(event) => setEntryTitle(event.target.value)} placeholder={entryType === "MEAL" ? "e.g. Breakfast" : entryType === "WATER" ? "e.g. Water" : entryType === "EXERCISE" ? "e.g. Walk" : "e.g. Night sleep"} />
          </label>
          <label className="field-wide">{entryType === "MEAL" ? "Food items and portions" : "Notes (optional)"}
            <textarea maxLength={500} rows="2" value={entryDetails} onChange={(event) => setEntryDetails(event.target.value)} placeholder={entryType === "MEAL" ? "List foods and portions as you know them; no automatic nutrition is inferred." : "Add optional details"} />
          </label>
          {entryType === "WATER" && <label>Amount (mL)<input type="number" min="1" max="10000" step="1" required value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} /></label>}
          {["EXERCISE", "SLEEP"].includes(entryType) && <label>Duration (minutes)<input type="number" min="1" max="1440" step="1" required value={entryDuration} onChange={(event) => setEntryDuration(event.target.value)} /></label>}
          {entryType === "MEAL" && <fieldset className="nutrition-estimate-fields"><legend>Optional nutrition estimates you provide</legend>{[
            ["calories", "Calories", 10000],
            ["proteinGrams", "Protein (g)", 1000],
            ["carbohydrateGrams", "Carbohydrates (g)", 2000],
            ["fatGrams", "Fat (g)", 1000],
          ].map(([field, label, maximum]) => <label key={field}>{label}<input type="number" min="0" max={maximum} step="any" value={nutritionDraft[field]} onChange={(event) => setNutritionDraft((current) => ({ ...current, [field]: event.target.value }))} /></label>)}<small>These are optional self-entered estimates. MediPilot does not calculate or verify nutrition values.</small></fieldset>}
          <div className="nutrition-form-actions"><button className="primary-button" type="submit" disabled={busy || loading}><Check size={15} />{busy ? "Saving…" : editingId ? "Save changes" : "Save entry"}</button>{editingId && <button className="secondary-button" type="button" onClick={clearEntryForm}>Cancel edit</button>}</div>
        </form>
      </section>
      <section className="panel nutrition-entry-list-panel">
        <div className="panel-heading"><div><h2>Meal history and daily entries</h2><p>{formatDay(selectedDate)} · {dayEntries.length} logged item{dayEntries.length === 1 ? "" : "s"}</p></div></div>
        {loading ? <div className="overview-loading">Loading entries…</div> : dayEntries.length ? <div className="nutrition-entry-list">{dayEntries.map((entry) => {
          const { Icon, label } = entryMeta[entry.entryType];
          return <article className="nutrition-entry-row" key={entry._id}>
            <span className={`nutrition-entry-icon ${entry.entryType.toLowerCase()}`}><Icon size={16} /></span>
            <div><strong>{entry.title}</strong><span>{label}{entry.details ? ` · ${entry.details}` : ""}</span><small>{entry.entryType === "WATER" ? `${entry.amountMl} mL` : ["EXERCISE", "SLEEP"].includes(entry.entryType) ? displayDuration(entry.durationMinutes) : estimateSummary(entry.nutritionEstimate) || "No nutrition estimate entered"}</small></div>
            <button className="text-button" type="button" onClick={() => editEntry(entry)}>Edit</button>
            <button className="icon-button nutrition-delete-button" type="button" disabled={busy} aria-label={`Delete ${entry.title}`} onClick={() => deleteEntry(entry._id)}><Trash2 size={14} /></button>
          </article>;
        })}</div> : <div className="nutrition-empty"><Utensils size={20} /><strong>No entries for this day</strong><p>Log meals, water, exercise, or sleep to build your own history.</p></div>}
      </section>
    </div>}

    {activeTab === "planner" && <div className="nutrition-page">
      <section className="panel nutrition-planner-panel">
        <div className="nutrition-planner-heading"><span className="nutrition-planner-icon"><Sparkles size={20} /></span><div><h2>AI Diet Planner & report insights</h2><p>Select reports reviewed by you. The planner uses only confirmed results from those selected reports, your saved preferences, and approved nutrition references.</p></div></div>
        <div className="nutrition-scope-note"><ShieldCheck size={14} /> Only checked, confirmed reports are included. Generating sends those findings, saved preferences, and your last 7 days of logged habits to the configured local AI service. Unselected reports are not used.</div>
        {confirmedReports.length ? <div className="nutrition-report-selection">{confirmedReports.map((report) => {
          const confirmedValues = (report.extractedData || []).filter((item) => item.verificationStatus === "CONFIRMED");
          return <label className="nutrition-report-option" key={report._id}>
            <input type="checkbox" checked={selectedReports.includes(report._id)} onChange={() => toggleReport(report._id)} />
            <span><strong>{report.originalName || "Reviewed medical report"}</strong><small>{report.documentType?.replaceAll("_", " ") || "Report"} · {formatDay(localDateString(new Date(report.reportDate || report.createdAt)))} · {confirmedValues.length} confirmed finding{confirmedValues.length === 1 ? "" : "s"}</small></span>
          </label>;
        })}</div> : <p className="inline-help">No reviewed report with confirmed results is available yet. Review a report in Health Records before using report-specific insights.</p>}
        <div className="nutrition-planner-profile">
          <span><strong>Diet style</strong>{profile.dietaryPreference || "Not provided"}</span>
          <span><strong>Allergies</strong>{mergedAllergies.length ? mergedAllergies.join(", ") : profile.foodAllergiesReviewed ? "None reported (reviewed)" : "Not reviewed"}</span>
          <span><strong>Restrictions</strong>{profile.restrictions?.length ? profile.restrictions.join(", ") : "None provided"}</span>
          <span><strong>Goals</strong>{profile.healthGoals?.length ? profile.healthGoals.join(", ") : "Not provided"}</span>
        </div>
        {!profile.foodAllergiesReviewed && <p className="nutrition-warning"><ShieldCheck size={14} /> Review and save your food-allergy information in Preferences before generating suggestions. You can confirm none are known.</p>}
        <button className="primary-button nutrition-generate-button" type="button" onClick={generatePlan} disabled={plannerLoading || !profile.foodAllergiesReviewed}>
          <Sparkles size={15} />{plannerLoading ? "Checking reviewed sources…" : "Generate grounded suggestions"}
        </button>
      </section>
      {plannerResult && <section className="panel nutrition-planner-result" aria-live="polite">
        <div className="panel-heading"><div><h2><Sparkles size={17} /> AI recommendations</h2><p>{plannerResult.status === "GROUNDED" ? "Suggestions checked against reviewed sources and your saved restrictions." : "No unsupported suggestions were generated."}</p></div><span className={`status-chip ${plannerResult.status === "GROUNDED" ? "active" : "pending"}`}>{plannerResult.status === "GROUNDED" ? "SOURCE GROUNDED" : "LIMITED"}</span></div>
        {plannerResult.message && <p className="nutrition-insufficient">{plannerResult.message}</p>}
        {plannerResult.reportFindings?.length > 0 && <section className="nutrition-report-insights">
          <h3><FileHeart size={15} /> Medical report insights</h3>
          <p>These are exact confirmed values from the selected reports, not a diagnosis or independent interpretation.</p>
          {plannerResult.reportFindings.map((finding, index) => <article key={`${finding.reportId}-${finding.testName}-${index}`}>
            <strong>{finding.testName}</strong>
            <span>{finding.value}{finding.unit ? ` ${finding.unit}` : ""}</span>
            <small>{finding.reportTitle}{finding.reportDate ? ` · ${formatDay(localDateString(new Date(finding.reportDate)))}` : ""}{finding.reportedFlag && finding.reportedFlag !== "UNKNOWN" ? ` · The report labels this ${finding.reportedFlag.toLowerCase()}.` : " · The report does not record a result flag."}{finding.referenceRange ? ` Reported range: ${finding.referenceRange}.` : " No reference range recorded."}</small>
          </article>)}
          <small>For interpretation of results or changes to your diet for a health condition, discuss the report with your clinician or a registered dietitian.</small>
          {onNavigate && <button className="text-button" type="button" onClick={() => onNavigate("Health records")}>Open source report in Health Records <ArrowRight size={13} /></button>}
        </section>}
        {plannerResult.plan && <pre className="nutrition-plan-copy">{plannerResult.plan}</pre>}
        {plannerResult.sources?.length > 0 && <div className="nutrition-plan-sources"><strong>Sources used</strong>{plannerResult.sources.map((source) => <span key={`${source.kind}-${source.id}`}>{source.kind === "PATIENT_RECORD" ? "Your reviewed report" : "Reviewed reference"} · {source.title}{source.url ? <> · <a href={source.url} target="_blank" rel="noreferrer">Open source</a></> : null}</span>)}</div>}
        <p className="nutrition-disclaimer">AI suggestions are informational and may not fit your full medical history. They do not diagnose, prescribe, set nutrient targets, or replace a clinician or registered dietitian. Seek professional advice for disease-specific diets, pregnancy, food allergy concerns, or fluid restrictions.</p>
      </section>}
    </div>}

    {activeTab === "preferences" && <div className="nutrition-page">
      <section className="panel nutrition-preferences-panel">
        <div className="panel-heading"><div><h2>Dietary preferences, allergies & goals</h2><p>These saved details personalize suggestions and help filter unsafe foods. Enter lists separated by commas.</p></div></div>
        <form className="nutrition-preferences-form" onSubmit={saveProfile}>
          <label>Dietary preference<input maxLength="100" value={profileDraft.dietaryPreference || ""} onChange={(event) => setProfileDraft((current) => ({ ...current, dietaryPreference: event.target.value }))} placeholder="e.g. vegetarian" /></label>
          <label>Food allergies<input maxLength="2000" value={draftString("allergies", "allergies")} onChange={(event) => setProfileDraft((current) => ({ ...current, allergiesText: event.target.value, foodAllergiesReviewed: false }))} placeholder="e.g. peanuts, shellfish" /></label>
          <label className="nutrition-allergy-review"><input type="checkbox" checked={Boolean(profileDraft.foodAllergiesReviewed)} onChange={(event) => setProfileDraft((current) => ({ ...current, foodAllergiesReviewed: event.target.checked }))} /><span><strong>Allergy information reviewed</strong><small>Your entered allergies and existing health-record allergy notes are accurate, including if no food allergies are known. Revisit this after any changes.</small></span></label>
          <label className="field-wide">Other food restrictions<input maxLength="2000" value={draftString("restrictions", "restrictions")} onChange={(event) => setProfileDraft((current) => ({ ...current, restrictionsText: event.target.value }))} placeholder="e.g. no pork, lactose-free" /></label>
          <label className="field-wide">Personal health goals<input maxLength="2000" value={draftString("goals", "healthGoals")} onChange={(event) => setProfileDraft((current) => ({ ...current, goalsText: event.target.value }))} placeholder="e.g. cook at home more often" /></label>
          <fieldset className="nutrition-personal-goals"><legend>Optional personal tracker goals</legend>
            <label>Water goal (mL/day)<input type="number" min="1" max="10000" value={profileDraft.waterGoalMl} onChange={(event) => setProfileDraft((current) => ({ ...current, waterGoalMl: event.target.value }))} /></label>
            <label>Exercise goal (minutes/day)<input type="number" min="1" max="1440" value={profileDraft.exerciseGoalMinutes} onChange={(event) => setProfileDraft((current) => ({ ...current, exerciseGoalMinutes: event.target.value }))} /></label>
            <label>Sleep goal (hours/day)<input type="number" min="0.25" max="24" step="0.25" value={profileDraft.sleepGoalHours} onChange={(event) => setProfileDraft((current) => ({ ...current, sleepGoalHours: event.target.value }))} /></label>
            <small>Goals are optional values you choose for tracking; they are not medical targets. Follow clinician guidance if you have fluid or activity restrictions.</small>
          </fieldset>
          {healthRecordAllergies.length > 0 && <div className="nutrition-recorded-allergies"><strong>Existing health-record allergy notes</strong>{healthRecordAllergies.map((item, index) => <span key={`${item.title}-${index}`}>{item.title}{item.details ? ` · ${item.details}` : ""}</span>)}</div>}
          <button className="primary-button" type="submit" disabled={busy}><Check size={15} />{busy ? "Saving…" : "Save preferences"}</button>
        </form>
      </section>
    </div>}
    <p className="inline-help nutrition-footer-note"><Clock3 size={13} /> Habit history reflects entries you log; estimates are not measured or verified health data.</p>
  </>;
}
