# FHIR-style export and patient sharing

## FHIR-style export

`GET /api/fhir/export` requires the patient's bearer token and returns a FHIR R4-style `Bundle` collection with a structural validation report. Exported resources are built only from the signed-in patient's data:

- `Patient` from the account name.
- `Observation` from numeric vitals and extracted report results.
- `DiagnosticReport` from uploaded report metadata.
- `MedicationRequest` from the medication list and medication notes.
- `Condition`, `AllergyIntolerance`, and `DocumentReference` from matching health notes.

Uploaded document images, original files, OCR text, and AI summaries are not included. The validation is basic structural checking, not official FHIR R4 profile or terminology validation. Apply the receiving system's applicable implementation guide and validator before real exchange.

## Patient-controlled sharing

- `GET /api/shares` lists the patient's most recent 50 share grants and access events.
- `POST /api/shares` creates a share from 1–50 owned records. Body: `{ "records": [{ "kind": "document|record|medication", "id": "<record id>" }], "expiresInHours": 1 }`. Expiry choices are 1, 6, 24, 72, 168, or 720 hours.
- `DELETE /api/shares/:id` revokes an active grant.
- `GET /api/shares/public/:token` is the read-only bearer-link endpoint.

The 256-bit random token is only returned at grant creation; the database stores its SHA-256 hash. A share includes the patient's name and only the selected current records. Document files and OCR text are excluded. Access events record event type and timestamp (not viewer IP); at most 50 events are retained per grant. Expired and revoked grants remain available in the patient's history.

These links are prototype bearer access: anyone with the link can read the selected information until expiry or revocation. They do not verify the viewer's identity and are not an ABDM consent artefact or production consent-governed exchange.

## Simulated facility exchange

The frontend's Clinic exchange screen maps two hard-coded fictional clinic formats to a common simulated patient and displays their converted sample observations in date order. It does not call an external facility or read/write patient account records.
