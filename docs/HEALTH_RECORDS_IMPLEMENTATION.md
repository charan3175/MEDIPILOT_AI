# Health Records Page

The Health Records page uses the authenticated document collection and existing patient-scoped document endpoints; it does not create a separate client-side record store.

## Implemented

- Displays total, processed, and review-required document counts.
- Searches file names, processing metadata, and extracted result names/values/source lines.
- Filters by document category, processing status, review status, and report date; supports upload-date and report-date sorting.
- Provides list and grid layouts, a clear-filters action, and a matching-results count.
- Opens a detail panel with record status, available report date, extracted values, verification status, OCR confidence, source line, and authenticated original-file download.
- Supports image OCR in English or a selected English+Hindi, English+Telugu, or English+Tamil combination. Language and per-finding confidence are retained.
- Extracts explicitly labelled diagnosis and clinical-date candidates with source lines. Patients can correct or reject candidates; only confirmed diagnoses appear in the timeline and FHIR export.
- Creates reviewable prescription medication suggestions from explicitly labelled medicine fields; these are not automatically added to the medication list.
- Shows OCR text when available and labels unsupported patient/clinician metadata as not detected rather than inferring it.
- Supports correction of extracted lab values, diagnosis/date candidates, and document category through the existing authenticated review endpoint.
- Keeps the existing language-aware report explanation flow; explanation remains unavailable until the patient confirms the extracted data. A separate AI Health Summary page lists saved reports and uses the same summary endpoint and persisted document data.
- Keeps the unified patient-scoped timeline on Health Overview; the standalone Health Timeline sidebar item has been replaced by Food & Daily Habits.

## Limitations

- Extraction remains conservative and label-based: it is not a general medical entity-recognition model. Unlabelled medicines/diagnoses/dates, patient/provider identities, and handwriting may be missed or misread.
- OCR language selection applies to images; selectable-text PDFs use embedded text. Scanned PDFs are not rendered for OCR. Language-pack availability may depend on server configuration/network access.
- Report date may fall back to upload date for document-library filtering, but the standalone timeline labels report dates and upload dates separately.
- Original file download is authenticated; the detail panel does not embed a PDF/image viewer.
- The review action confirms the submitted structured candidates. It is not a substitute for clinician verification.

## Verification

- `npm test` — health-document filtering/sorting and health-insight tests.
- `npm run build` — production frontend build.
- `npm run lint` — passes with existing repository warnings.
- `node --check backend\src\controllers\documentController.js` — controller syntax check.
