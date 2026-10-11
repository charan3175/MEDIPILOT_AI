# MEDIPILOT AI Requirements Traceability

Audit date: 2026-10-11

This matrix records the state of the existing Express/MongoDB and React/Vite
application after code inspection. PASS means the repository contains working
behavior and a focused test or directly verifiable endpoint; PARTIAL means a
usable implementation exists but misses material acceptance criteria. This
prototype has no Git repository, so no Git checkpoint could be created.

## Priority 0 — Preserve existing application

| ID | Requirement | Priority | Existing implementation / status | Frontend | Backend / routes | Persistence | Evidence / remaining work |
|---|---|---|---|---|---|---|---|
| P0-01 | Preserve the existing application and stack. | P0 | PARTIAL | `frontend/src/PatientWorkspace.jsx`, `frontend/src/app/components/AnatomyViewer.jsx` | Express routes under `backend/src/routes/`; MongoDB startup in `backend/src/server.js` | MongoDB/Mongoose | Existing app retained. No Git repository exists for a checkpoint. Root package metadata includes unrelated Supabase dependencies and should be reviewed separately. |

## Priority 1 — Mandatory Round 1 workflow

| ID | Requirement | Priority | Existing implementation / status | Frontend | Backend / routes | Persistence | Evidence / remaining work |
|---|---|---|---|---|---|---|---|
| P1-01 | Medical document upload. | P1 | PARTIAL | `frontend/src/PatientWorkspace.jsx` | `POST /api/documents/upload`, `documentController.uploadDocument` | `Document` collection, private local file | Authenticated PDF/JPEG/PNG upload validates file signatures, rejects exact per-patient duplicates, and exposes scanned-PDF OCR unavailability. Scanned-PDF OCR remains unsupported. |
| P1-02 | File validation and storage. | P1 | PARTIAL | Upload form | `backend/src/middleware/uploadMiddleware.js`, `medicalDocument.js` | `backend/private_uploads` and `Document` | Server validates PDF/JPEG/PNG signatures, enforces upload-size middleware limits, sanitizes display filenames, and persists SHA-256 hashes for duplicate detection. Category-based storage and storage recovery are not implemented. |
| P1-03 | Document classification. | P1 | PARTIAL | User-selected document type | `Document.documentType` | `Document` | User can choose LAB_REPORT, PRESCRIPTION, DISCHARGE_SUMMARY, or OTHER. There is no reliable automatic classifier or unknown-type review state. |
| P1-04 | OCR text extraction. | P1 | PARTIAL | Extraction status, selected image OCR language, and per-finding confidence shown in records UI | `documentController.uploadDocument` uses `pdf-parse` and Tesseract.js | `Document.extractedText`, `ocrLanguage`, extracted-value confidence | Digital PDF text and English/English+Hindi/Telugu/Tamil image OCR are supported. Scanned PDFs remain unsupported and handwriting recognition is best-effort; recognition must be checked against the original. |
| P1-05 | Structured medical entity extraction. | P1 | PARTIAL | Extracted lab, diagnosis, and date candidates are shown with source lines and review state; prescription suggestions flow to medication review | `extractLabValues`, `extractClinicalFacts`, and `extractMedicationSuggestions` in `backend/src/services/medicalDocument.js` | `Document.extractedData`, `Document.extractedClinicalData`, `MedicationSuggestion` | Numeric lab values and explicitly labelled diagnoses/dates are extracted conservatively; explicitly labelled prescription fields create pending suggestions. Unlabelled entities, provider identity, handwriting, and broad clinical entity extraction remain unsupported. |
| P1-06 | Persistent medical record storage. | P1 | PARTIAL | Health records UI | `documentController.js`, `healthRecordController.js` | `Document`, `HealthRecord`, `LabReport`, `Medication` | Source documents, structured lab/clinical candidates, and review status persist. Prescription suggestions require explicit user confirmation before becoming medications. |
| P1-07 | Extracted data verification and correction. | P1 | PARTIAL | `frontend/src/PatientWorkspace.jsx` provides editable lab, diagnosis, and date candidates with confirmation/rejection | `PATCH /api/documents/:id/review`; `reviewMyDocument` | Corrected candidates and patient-confirmation state persist in `Document` | Review is patient-scoped, validates complete candidate lists and calendar dates, preserves source lines, and summary generation is blocked until confirmation. Focused controller tests cover review and summary gating; end-to-end acceptance remains outstanding. |
| P1-08 | Simple-language health summary. | P1 | PARTIAL | Explain action and summary panel in `PatientWorkspace.jsx` | `POST /api/documents/:id/summarize` | `Document.aiSummary`, `aiSummaryLanguage` | Summary requires confirmed document review, receives confirmed structured findings and selected language, and is stored by language. It requests simple-language sections including abnormal results, diagnoses/findings, medicine information, and clinician questions; generated meaning and section completeness are not independently validated. |
| P1-09 | Explain abnormal results with evidence. | P1 | PARTIAL | Report ranges and flags displayed; AI summary panel | `summarizeWithOllama` | Document extracted values | Source text prompt includes cautions, but there is no independent factual validation or summary citations tied to structured data. |
| P1-10 | Unified health profile and timeline. | P1 | PARTIAL | Overview and Health records; recent timeline events remain on Overview | `GET /api/documents/timeline` | `Document`, `HealthRecord`, `LabReport`, `Medication`, `Appointment` | Timeline combines saved documents, confirmed diagnoses, notes, lab reports, medicines, and appointments, with source navigation. Linked lab results are grouped under their document and exact duplicate values are removed. Broad encounter extraction and universal legacy cross-collection deduplication remain unsupported. |
| P1-11 | Authentication and health-data isolation. | P1 | PASS (focused scope) | Authenticated workspace | `protect` middleware; document queries filter `patientId` from token | MongoDB | Document APIs use authenticated user scoping; existing auth tests pass. Full cross-route penetration/IDOR acceptance suite remains. |
| P1-12 | Error handling and processing status. | P1 | PARTIAL | Upload feedback and document status | `documentController.js`, `server.js` | `Document.processingStatus`, `ocrStatus`, `extractionStatus`, `reviewStatus` | Explicit statuses/messages distinguish extraction, review, scanned-PDF OCR unavailability, and failures. Retry/recovery behavior and full processing-path tests remain absent. |
| P1-13 | End-to-end acceptance tests. | P1 | FAIL | N/A | Focused tests cover auth, upload helper validation, review correction/validation, summary gating, RAG safety, and deterministic lab comparisons | Test fixtures absent | There is not yet an upload-to-OCR-to-review-to-summary-to-timeline end-to-end test using a database and fictional medical document fixtures. |
| P1-14 | Authenticated Health Overview dashboard. | P1 | PARTIAL | `frontend/src/HealthOverview.jsx` | Existing dashboard, document, timeline, and language-preference endpoints | Patient-scoped MongoDB records | Overview cards, recent reports, verified/unverified findings, preferred-language summary routing, timeline preview, retries, and quick actions use authenticated data. Full integration and user-isolation acceptance tests remain to be verified. |
| P1-15 | Searchable, filterable Health Records library with patient review and document details. | P1 | PARTIAL | `frontend/src/PatientWorkspace.jsx`; `frontend/src/services/healthDocuments.js` | Patient-scoped document list/detail/download and review endpoints | Existing `Document` collection | Summary cards, category/status/review/date filters, search, sorting, list/grid view, OCR/result details, secure download, and patient-editable category are implemented. No embedded file viewer or reliable extraction of medicines, diagnoses, patient/provider names, or report dates. See `docs/HEALTH_RECORDS_IMPLEMENTATION.md`. |

## Priority 2 — Bonus requirements

| ID | Requirement | Priority | Existing implementation / status | Frontend | Backend / routes | Persistence | Evidence / remaining work |
|---|---|---|---|---|---|---|---|
| B1-01 | Multilingual summaries and interface support (English, Telugu, Hindi, Tamil). | P2 | PARTIAL | `PatientWorkspace.jsx` offers report-language selection for English, Telugu, Hindi, and Tamil | `PATCH /api/dashboard/language`; language-aware Ollama summaries | `User.preferredLanguage`, `Document.aiSummaryLanguage` | Preferred report language persists and is passed to Ollama. The full interface is not translated into all four languages and generated translation quality is not verified. |
| B1-02 | Best-effort bilingual/handwritten OCR with confidence and correction. | P2 | PARTIAL | Selectable English+Hindi/Telugu/Tamil image OCR and source-linked patient review | Tesseract.js configured per upload | `Document.ocrLanguage` and per-finding confidence | Printed-image OCR is multilingual and confidence is available for recognized findings. Handwritten recognition remains best-effort; scanned-PDF OCR and language-pack availability are not guaranteed. |
| B1-03 | FHIR-aligned schema and terminology mapping. | P2 | PARTIAL | FHIR export workspace | `/api/fhir/export` | Existing source collections | R4-style export maps patient-reviewed diagnosis text to Condition resources with verification status `unconfirmed` and runs basic structural checks; no formal profile validation or verified terminology mapping. Patient review is not clinician verification. |
| B1-04 | Mock ABHA identifier/import. | P2 | PARTIAL | ABHA profile labels prototype | `/api/abha` | ABHA profile model | Prototype fields and consent exist; no real ABDM import or connection. |
| B1-05 | Patient-managed doctor appointments, source-linked OCR suggestions, and timeline integration. | P2 | PARTIAL | `frontend/src/DoctorAppointments.jsx`; authenticated workspace navigation | `/api/appointments`; `/api/documents/upload`; `/api/documents/timeline`; patient-scoped controller operations | Existing MongoDB `Appointment` plus source-linked `AppointmentSuggestion` | Saved visits can be created, viewed, edited, rescheduled, cancelled, and completed; source links are ownership-checked; suggestions require user confirmation, and a potential duplicate requires an explicit choice to link or save separately. No external booking, reminders delivery, general clinical OCR, or MongoDB-backed E2E test. See `docs/APPOINTMENTS_IMPLEMENTATION.md`. |

## Audit findings and implementation focus

The upload, extraction review/correction, summary gating, and cross-record
timeline paths are implemented and have focused tests for critical data rules.
End-to-end acceptance tests remain missing. Scanned PDF rendering/OCR, clinical
entity extraction beyond the simple lab-line parser, output quality validation,
and full multilingual natural-language UI support need additional
implementation and validation. The app currently uses local Ollama by default;
model availability and MongoDB connectivity depend on local environment
configuration.

No requirement is marked PASS solely because a page exists. The scope of the
backend unit tests is listed in `backend/package.json`; a successful frontend
build proves compilation, not clinical correctness or interoperability.

## Prototype presentation deliverables

- Architecture diagram and data-pipeline/schema notes: `docs/ARCHITECTURE.md`.
- Four-slide demo outline with speaker notes and explicit prototype limits:
  `docs/DEMO_SLIDES.md`.
- These documents describe the implemented prototype and do not claim
  production ABDM connectivity or certified FHIR validation.

## Navigation and module audit addendum

The authenticated workspace now has **Your Health**, **Health Tools**,
**Hospital Sharing**, **Health Data**, and **Account** sections. The sidebar is collapsible on
desktop, opens as a mobile drawer, exposes its active item to assistive
technology, closes with Escape, and uses hash routes to support refresh and
browser Back/Forward. See `docs/NAVIGATION_AND_MODULE_AUDIT.md` for the
module-by-module status and constraints.

| Added/connected behavior | Status | Evidence |
|---|---|---|
| AI Health Summary and patient timeline | Summary has a dedicated page; recent timeline remains on Health Overview, and the standalone timeline sidebar item is replaced by Food & Daily Habits | `frontend/src/HealthJourneyPages.jsx`, `frontend/src/HealthOverview.jsx`, `GET /api/documents/timeline` |
| Profile and Settings language preference | Implemented for persisted explanation language; account profile fields are display-only | `frontend/src/HealthJourneyPages.jsx`, `PATCH /api/dashboard/language` |
| Anatomy viewer source and finding safety | Only supported region IDs with confirmed extraction and verified mapping are highlighted; unmapped data remain available in the findings list | `frontend/src/services/healthInsights.js`, `frontend/src/app/components/AnatomyViewer.jsx` |
| Timeline duplicate source handling | Lab reports linked to an uploaded document are grouped under that source document; identical linked values are de-duplicated | `backend/src/services/healthTimeline.js`, `backend/src/services/healthTimeline.test.js` |
| FHIR source/date handling | Missing clinical dates are omitted, document upload date is represented separately, and unreviewed findings remain preliminary | `backend/src/services/fhirService.js`, `backend/src/services/fhirService.test.js` |
| Food & Daily Habits | Patient-scoped meal, hydration, exercise, and sleep logs; saved preferences/allergies/goals; weekly progress; report-grounded AI recommendations require explicitly selected confirmed results and reviewed source citations | `frontend/src/FoodDailyHabits.jsx`, `backend/src/controllers/nutritionController.js`, `backend/src/services/nutritionSafety.js`, `/api/nutrition` |
| Cross-facility demo | Simulation is labelled and uses fictional data | `frontend/src/PatientWorkspace.jsx`, `frontend/src/services/clinicExchange.js` |
| Patient-controlled Health ID QR and hospital-sharing tab | QR/link requests collect unverified requester role and purpose without disclosing records; patients select specific records and a duration up to 3 days, may deny/revoke, and see bounded history. Viewer status is rechecked; the AI brief is scoped to approved record IDs. Provider verification, durable audit storage, and distributed IP rate limiting remain unavailable. | `docs/HEALTH_ID_SHARING.md`, `docs/ALTRIX_HEALTH_ID_IMPLEMENTATION.md`, `backend/src/controllers/healthIdController.js`, `backend/src/controllers/shareController.js`, `frontend/src/PatientWorkspace.jsx` |

The new pages do not add a second summary engine or client-side data store.
FHIR output still uses basic structural checks rather than a certified
FHIR R4 profile validator. Direct sharing remains a time-limited bearer-link
prototype; Health ID access adds patient approval but is still not an
identity-verified or ABDM consent integration.
