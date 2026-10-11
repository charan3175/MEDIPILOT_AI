# Doctor Appointments

## Implemented

- Reused the existing patient authentication, Express `/api/appointments` routes, and MongoDB `Appointment` collection.
- Added persisted provider, specialty, clinic, location, online link, reason, notes, appointment type, timezone, date-only indicator, linked source documents/medications, follow-up date, reminder preference, and user-managed/clinic confirmation metadata.
- Added authenticated, patient-scoped listing, details, editing/rescheduling, status updates, cancellation, completion, and source-link validation. Cancelled records are retained.
- Added a responsive appointment dashboard with actual saved-record counts, upcoming/completed/cancelled/pending tabs, search, calendar navigation, details, validated add/edit forms, and confirmation before cancellation.
- Appointment details show only explicitly linked documents and medication records. Extracted lab results retain their patient-review or unverified OCR state; the UI does not treat the AI explanation as a documented finding.
- New patient-entered appointments are marked user-managed. The UI clearly states that saving does not create an external clinic booking. Appointment reminder preference is stored, but no notification delivery is claimed.
- Added source-linked, patient-reviewed suggestions for OCR lines explicitly labelled `Consultation Date`, `Visit Date`, `Appointment Date`, or `Follow-up Date`. Suggestions preserve source evidence, are not displayed as confirmed visits, and must be reviewed before saving. Prescription dates alone do not create suggestions.
- Potential same-day, same-provider and same-clinic matches are shown for patient review. The patient must explicitly choose a saved visit to link the source document, or choose to create a separate appointment; the API revalidates ownership and matching details. Records are never silently merged or deleted.
- Only confirmed or completed appointments appear in the Health Timeline. Pending requests and unconfirmed OCR suggestions stay out.
- Appointment questions in the AI assistant query the signed-in patient's saved appointment records; follow-up-date questions also consult source-linked appointment suggestions. Missing information returns an explicit unavailable answer.

## Limitations

- The current OCR pipeline primarily extracts numeric lab lines. Appointment suggestions support only clearly labelled explicit date lines and simple `Doctor:` / `Clinic:` fields; no general clinical NLP, confidence score for appointment extraction, or broad handwriting/scanned-PDF support was added.
- Suggestion deduplication is cautious and informational. It does not automatically merge independently saved visits; a user-confirmed exact match may attach another source to an existing appointment.
- Appointment associations to prescriptions/documents must be selected or confirmed by the user; date proximity does not make a relationship.
- There is no external hospital booking, calendar sync, or notification delivery integration.
- No MongoDB-backed browser-to-database acceptance/E2E suite is configured in this workspace. Controller/helper tests use fictional records and stubs, not a live clinical database.

## Verification

- Backend `npm test` includes appointment controller authorization/validation/persistence behavior and explicit-date OCR suggestions.
- Frontend production build, focused tests, lint, and Problems checks should be run after implementation.
