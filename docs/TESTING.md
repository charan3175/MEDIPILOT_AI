# MediPilot AI Testing and Acceptance

Updated: 2026-10-11

## Automated checks

Run commands from the indicated project directory in PowerShell.

```powershell
Set-Location 'C:\Users\hp\OneDrive\Desktop\HacXelerate\backend'
npm test

Set-Location 'C:\Users\hp\OneDrive\Desktop\HacXelerate\frontend'
npm test
npm run build
npm run lint -- src/PatientWorkspace.jsx src/HealthOverview.jsx src/HealthJourneyPages.jsx src/FoodDailyHabits.jsx
```

Latest run after clinical extraction, OCR language selection, and Food & Daily
Habits updates:

- Backend `npm test`: **80 passed, 0 failed**. Includes medical document parsing
  and validation; explicit diagnosis/date extraction and patient review;
  regional OCR language selection; FHIR diagnosis mapping; diagnosis timeline
  events; auth, appointments, medicines, reminders, sharing, RAG safety, and
  nutrition authorization/allergy review.
- Frontend `npm test`: **7 passed, 0 failed**. Includes health-document
  filtering/sorting and conservative anatomy mapping.
- Frontend production build: **passed**. Vite reports the existing
  AnatomyViewer JavaScript chunk is larger than 500 kB.
- Frontend lint for the changed health UI files: **exit 0**. Two
  `react(set-state-in-effect)` warnings remain in `PatientWorkspace.jsx`.
- Backend JavaScript syntax checks: **passed**.

Build success and unit tests do not prove clinical accuracy, live service
availability, MongoDB persistence, or complete user isolation.

## Acceptance checks still requiring configured services/browser

Do not mark these passed until run against a test account and isolated test
database:

1. Navigate to each active sidebar item; verify matching hash, active state,
   refresh behavior, browser Back/Forward, desktop collapse, mobile drawer,
   keyboard focus, and Escape close.
2. Sign in as a test patient, upload a fictional PDF/image, reload, and verify
   the persisted source document, extracted lab/diagnosis/date candidates,
   selected OCR language, review state, and authenticated source download.
   Try English+Hindi/Telugu/Tamil printed-image fixtures; compare every OCR
   candidate with the source. Scanned PDFs and handwriting are not guaranteed.
3. Verify upload, processing, and API failures are shown as errors rather
   than success notices.
4. Confirm an unreviewed document cannot be summarized or highlighted in the
   anatomy viewer. Confirm a reviewed supported result can link to its
   original source; unsupported mappings remain unassigned. Confirm only
   patient-confirmed diagnosis candidates appear in the timeline and FHIR
   Condition export.
5. Save a preferred report language, reload, and verify the preference;
   switch language without rerunning OCR.
6. In Food & Daily Habits, save, edit, and delete meal, water, exercise, and
   sleep entries, then reload and verify they remain patient-scoped. Verify
   dates and daily totals, personal goals, weekly progress, and that blank
   nutrition estimates remain blank instead of being invented.
7. Save food preferences, restrictions, and allergies. Explicitly review and
   save the allergy list (including confirming none are known) before planning;
   editing that list should require review again. Generate a plan with
   explicitly selected confirmed reports and verify displayed results match
   the source exactly, every recommendation cites a reviewed source, and the
   planner refuses an output that mentions a restricted food. Verify
   unconfirmed and another patient's report IDs are rejected. Test without
   approved nutrition knowledge and confirm the UI reports insufficient
   evidence rather than returning generic medical advice.
8. Verify timeline dates are accurately labelled and do not silently convert
   upload timestamps into clinical event dates; confirm a source-linked lab
   report appears under one document event with duplicate values removed.
9. Use two test accounts to verify cross-user document, medication,
   appointment, reminder, FHIR, and share authorization boundaries.
10. In Share with Hospital > Share selected records, select only fictional
   records, choose an expiry, create the direct link and QR, verify copy/share,
   QR download, recipient access, expiry, and revoke/access-history behavior.
   Confirm the bearer-link warning is visible.
11. In Share with Hospital > Review hospital requests, verify the Health ID
   copy/share/download/print/reveal actions and scan its QR in a separate test
   browser. Confirm the request
   reveals no patient identity or records, requester role is labelled
   unverified, approve exactly one selected record for a short duration, and
   verify the viewer cannot retrieve unselected records. Verify denial, expiry,
   immediate revocation, status polling, document-download authorization,
   viewer exit, QR replacement, and the request/poll limits using fictional
   data.
12. Verify the AI Health Brief against only the approved fictional records with
    configured local Ollama. Do not
   use real patient information in development acceptance prompts.
13. If SMTP is configured, test password reset delivery with a test mailbox.
    Do not paste SMTP secrets into source control or chat.

## Known unavailable acceptance coverage

- No MongoDB-backed browser E2E suite or dedicated test database configuration
  is present.
- No real notification delivery/scheduler is configured.
- No official FHIR R4 profile validator or ABDM integration is configured.
- Cross-facility exchange uses fictional data only.
