# MediPilot AI Navigation and Module Audit

Audit date: 2026-10-11

## Repository and runtime

- The active frontend is React 19 with Vite (`frontend/src/main.jsx`, `frontend/src/App.jsx`), not a Next.js application. `frontend/src/app/` contains the anatomy viewer and unused Next-style files; it is not the application router.
- The active backend is Express with Mongoose (`backend/src/server.js`), with protected API routes and MongoDB models.
- The authenticated patient UI is composed in `frontend/src/PatientWorkspace.jsx`. Navigation uses stable URL hash routes so a section can be refreshed, bookmarked, or revisited with browser Back/Forward. The mobile menu is a drawer; desktop navigation can be collapsed.
- Active navigation is grouped as **Your Health**, **Health Tools**, **Hospital Sharing**, **Health Data**, and **Account**. **Food & Daily Habits** replaces the standalone Health Timeline sidebar item; recent timeline events remain on Health Overview.

## Requirement and module status

Status meanings: **Working** means the principal behavior exists against authenticated APIs; **Partial** means a working foundation exists but important requested behavior or integration is absent; **Prototype** means the feature is explicitly simulated or has important production limitations; **Missing** means no user-facing implementation exists.

| Module / requirement | Status | Existing implementation and evidence | Remaining gaps or caveats |
|---|---|---|---|
| Authentication and patient workspace | Working | Registration/login, protected API calls, patient role gate, forgot/reset password endpoints, and signed-in workspace. See `backend/src/controllers/authController.js`. | Password-reset email needs valid SMTP settings in `backend/.env`; see [`PASSWORD_RESET_SETUP.md`](../backend/PASSWORD_RESET_SETUP.md). Profile editing is not implemented. |
| Health Overview | Working | Uses authenticated dashboard, document, lab-report, and timeline data; has loading/error/empty states, recent reports, findings, summary entry point, and shortcuts. | No live database/browser acceptance test has been run in this environment. |
| Health Records and document workflow | Partial | Upload validates PDF/JPG/PNG signatures and patient duplicate hashes, stores originals privately, extracts PDF text or multilingual image OCR, persists lab and explicitly labelled diagnosis/date candidates, supports patient review/correction, and serves authenticated downloads. Prescription fields create separate pending medication suggestions. | Extraction is deliberately conservative. Scanned-PDF OCR, reliable handwriting, unlabelled clinical entity extraction, provider identity, and embedded source viewer are absent. |
| AI Health Summary | Partial | Reuses the Ollama-backed explanation endpoint; requires confirmed document review; provides English, Telugu, Hindi, and Tamil explanations and prompts structured plain-language sections with abnormal/normal results, diagnosis/findings, medicine information, and doctor questions. | Output section completeness, factual meaning, and translation quality are not independently validated. Depends on configured Ollama service. |
| Health Timeline | Working with limitations | Patient-scoped endpoint combines uploaded documents, patient-confirmed diagnoses, health notes, medications, lab reports, and confirmed/completed appointments; linked lab rows are grouped under their source document, and events label clinical report dates separately from upload dates. | No general cross-collection deduplication key exists for every possible relationship between legacy records. |
| Food & Daily Habits | Working with safety limitations | Patient-scoped saved meal, water, exercise, and sleep entries; saved dietary preferences, food allergies/restrictions, and optional self-set tracker goals; seven-day history; AI diet suggestions from only explicitly selected patient-confirmed report values and reviewed nutrition references. Generated suggestions must cite supplied source titles and are rejected if they mention saved restricted foods. | AI requires local Ollama and relevant reviewed medical-reference content. Nutrition values are shown only when user-entered. This is informational support, not a clinical diet plan; disease-specific diet, allergy, pregnancy, fluid restriction, and activity concerns require professional guidance. |
| My Medications | Working | Patient-owned medication CRUD, reviewable OCR suggestions, source documents, status/history, and linked reminder cleanup. | OCR-derived values are intentionally suggestions; no dose-event/adherence tracking. |
| Appointments | Working | Patient-owned appointments, edits/rescheduling/cancellation/completion, source links, reviewable OCR suggestions, calendar navigation, and timeline integration. | No external booking or calendar sync; saving is a personal schedule entry. |
| Reminders | Working as an in-app list | Patient-owned reminders, linked-record validation, status history, duplicate protection, and appointment/medication lifecycle sync. | No durable scheduler or email/push/browser delivery. The UI reports this accurately; recurrence is not processed into notifications. |
| AI Copilot | Partial | Authenticated patient-scoped retrieval indexes readable uploaded documents, health records, lab reports, prescriptions, medications, appointments, reminders, and food/habit profile and entries; retrieval refreshes from the owning patient's database records and cites the sources used. Broad report-review prompts select up to 30 source records; focused prompts select relevant chunks. A draggable floating chat is available throughout the signed-in workspace. | Retrieval is not a guarantee that every passage is considered in each answer; broad reviews disclose the 30-source/passages limit. No cross-patient, account, sharing-token, or admin data is exposed. Clinical accuracy is not independently validated and Ollama/MongoDB are required. |
| AI Health Visualizer | Partial / illustrative | Reuses the supplied `AnatomyViewer.jsx`. Red markers identify supported body regions associated with patient-reviewed lab findings flagged above/below range, explicit patient-reviewed diagnosis text, or an explicit patient-entered `CONDITION` record. Region counts and source-linked records are shown in compact and full views. | Diagnosis text and patient-entered conditions are not clinician-verified; mappings are approximate, intentionally narrow, and are not diagnoses or proof of organ damage. Symptoms and arbitrary report mentions are not auto-mapped. No marker does not mean all findings are normal. |
| FHIR-ready health records | Prototype | Authenticated JSON bundle export maps supported patient, observation, patient-reviewed diagnosis text (`Condition` with unconfirmed clinical verification), diagnostic report, medication request, and document-reference data, with basic structural checks. | It is not official FHIR R4 profile validation. Patient review is not clinician verification. Encounter/Appointment resources and full terminology/profile validation are absent; no ABDM connection exists. Clinical dates are omitted when not present in reviewed source data. |
| Patient-controlled sharing | Prototype | One **Share with Hospital** sidebar section provides direct selected-record link/QR sharing with patient-chosen expiry, plus a separate hospital-request QR flow with record-level approval, revocation, and access history. Both flows use server-validated patient-owned records and expiring grants. | Direct links are bearer access: no identity-verified recipient, recipient binding, or ABDM consent artefact. Anyone receiving a direct link can access selected records until expiry/revocation. |
| ABHA profile | Prototype | Patient-scoped ABHA profile and explicit share-preference storage. | No ABDM integration or verification; UI labels this as a prototype. |
| Cross-facility exchange | Simulation | Two fictional clinic records are transformed to a shared FHIR-style sample timeline. | Static fictional data only; it does not use the patient database or exchange with a facility. |
| Profile, language, privacy, and settings | Partial | Settings shows authenticated profile fields, persists preferred explanation language, describes privacy controls, and links to sharing/ABHA prototype pages. Image OCR supports English+Hindi/Telugu/Tamil; the preferred summary language is selectable across those languages. | Profile editing and durable notification/accessibility preferences are not available. Full UI localization is limited; preferred summary language is distinct from UI language. |
| Security and authorization | Working foundation | Protected routes use authenticated user identity; document, medication, appointment, reminder, and sharing queries are user-scoped; original files are served through ownership-checked endpoints. | Requires deployment configuration review and adversarial tests before production health-data use. Shared links remain bearer credentials. |

## Current navigation map

| Navigation label | URL fragment | Actual page / behavior |
|---|---|---|
| Health Overview | `#overview` | Authenticated overview |
| Health Records | `#health-records` | Upload, review, search, and source records |
| AI Health Summary | `#ai-health-summary` | Select saved reports and request the existing explanation |
| Food & Daily Habits | `#food-daily-habits` | Food log, hydration/exercise/sleep trackers, personal goals, weekly progress, and source-grounded diet planner |
| My Medications | `#medications` | Medication center |
| Appointments | `#appointments` | Appointment center |
| Reminders | `#reminders` | In-app reminder center |
| AI Copilot | `#ai-copilot` | Full saved-conversation assistant; floating draggable compact/expanded chat is available across the signed-in workspace |
| AI Health Visualizer | `#ai-health-visualizer` | Supplied anatomy viewer, with conservative source mapping |
| Cross-facility exchange (simulation) | `#cross-facility-exchange` | Clearly labelled fictional demo |
| FHIR-ready health records | `#fhir-ready-health-records` | Basic FHIR-style JSON export |
| Share with Hospital | `#share-with-hospital` | Direct selected-record link/QR sharing, patient-chosen expiry, active link revocation/history, and hospital request/approval QR flow |
| ABHA profile (prototype) | `#abha-profile` | Mock profile/consent preferences |
| Profile & Settings | `#settings` | Profile display and saved summary-language preference |

## Required follow-up before production

1. Configure and verify MongoDB, Ollama, and SMTP in the target environment without committing credentials.
2. Add live authenticated browser-to-MongoDB acceptance tests for upload, persistence, review, summary, timeline, and cross-user isolation.
3. Improve extraction only with field-level provenance and review; do not infer diagnoses or missing dates.
4. Confirm interoperability requirements and use a FHIR R4 validator/profile set before making conformance claims.
5. Replace prototype bearer sharing with recipient identity and consent enforcement if production sharing is required.
6. Do not claim reminders are delivered until a durable scheduler and notification provider are integrated and monitored.
