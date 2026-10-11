# MediPilot AI Prototype Demo

## Slide 1 — The problem: health records are fragmented

- Prescriptions, laboratory reports, discharge summaries, and diagnostic
  records arrive in different formats.
- Important details can be difficult for patients to find and understand.
- MediPilot organizes a patient's uploaded records in one private workspace.

**Speaker note:** This prototype demonstrates patient record organization; it
does not connect to a hospital network or replace clinical care.

## Slide 2 — From document to reviewed record

1. Upload a PDF or image and choose its document type.
2. Extract selectable PDF text or run server-side image OCR in English,
   English+Hindi, English+Telugu, or English+Tamil.
3. Find conservative, source-linked candidates for lab values, explicitly
   labelled medicines, diagnoses, and clinical dates.
4. Compare candidates with the original and confirm or correct them.

**Speaker note:** Scanned PDFs and handwriting remain unsupported or
best-effort. OCR output is not considered verified until the patient reviews
it.

## Slide 3 — Plain-language explanation and health timeline

- Request an English, Hindi, Telugu, or Tamil explanation only after reviewing
  the source extraction.
- The explanation separates reported information from general explanation,
  preserves reported numeric values, and avoids diagnosis or treatment advice.
- The unified patient timeline combines documents, confirmed diagnoses,
  health notes, medicines, lab reports, and confirmed/completed appointments.
- The 3D anatomy view can show red markers for patient-reviewed, supported
  findings flagged above/below range or explicit diagnosis text in the report,
  with a link back to the source document.

**Speaker note:** AI explanations depend on the configured local Ollama service
and should be discussed with a qualified clinician. Patient review is not
clinician verification. Anatomy locations are approximate and are not
diagnoses or evidence of organ damage; no marker does not mean that every
result is normal.

## Slide 4 — Portability, consent, and prototype boundaries

- Export patient-authorized records as a FHIR R4-style JSON Bundle with basic
  structural checks.
- Store a mock ABHA profile and sharing preferences; no ABDM connection or
  identity verification is performed.
- Patient-selected expiring links and approval/revocation flows demonstrate
  consent controls; links remain bearer credentials.
- MongoDB stores patient-scoped data, while original files remain in private
  backend storage.

**Speaker note:** This is an interoperability-ready prototype, not certified
FHIR profile validation, an ABDM integration, or a production clinical system.

## Judge-facing readiness against the supplied rubric

| Criterion | Current evidence | Remaining judge-facing gap |
|---|---|---|
| AI Utilization — 35% | PDF text/image OCR, source-linked extraction candidates, patient review, localized explanations, and report-grounded recommendations are implemented. | No measured OCR/extraction accuracy or independent clinical-quality evaluation; scanned PDFs and handwriting are limited. Avoid presenting a quality score without a test corpus. |
| Technical Architecture — 25% | Document-to-review pipeline, patient-scoped persistence, FHIR-style export, architecture diagram, and fictional cross-facility normalization are present. | FHIR checks are basic, ABHA is mock-only, and no ABDM/real hospital integration exists. |
| User Experience — 20% | Upload/review, health summary/timeline, food and habit tracking, sharing, and compact/full anatomy views are available. | Demonstrate with a prepared account and representative records; signed-in end-to-end flow depends on the configured database and local AI service. |
| Healthcare Impact — 10% | Confirmation gates, source context, cautious language, and non-diagnostic anatomy disclaimers are implemented. | User confirmation is not clinician verification; the anatomy mapping is approximate and intentionally narrow. |
| Presentation & Demo — 10% | This slide outline and `docs/ARCHITECTURE.md` provide a narrative and system diagram. | Rehearse the demo and show only tested flows; do not claim measured accuracy, certified FHIR conformance, or live interoperability. |

The rubric categories are implemented to varying prototype levels; these notes
are not a predicted score or an independent clinical validation.
