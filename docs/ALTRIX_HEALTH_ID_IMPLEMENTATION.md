# Altrix Health ID implementation audit

Updated: 2026-10-11

## Scope and architecture

The existing application is a React/Vite patient workspace with an Express and
Mongoose backend, not a Next.js application. This feature reuses the existing
JWT authentication, MongoDB collections, patient records, private document
storage, `ShareGrant`, and FHIR-style bundle generation. It does not create a
second database or replace the application.

Altrix Health ID is a consent-based sharing prototype. It is not an official
ABHA/ABDM identity, verified provider directory, or ABDM consent artefact.

## Repository audit

| Area | Status | Current behavior and boundary |
| --- | --- | --- |
| Authentication and ownership | Implemented | Patient-management routes use the existing `protect` middleware and derive ownership from the authenticated user. |
| Medical records and documents | Implemented | Existing patient-owned documents, health records, and medications are available to sharing only after ownership checks. Source documents stay in private storage. |
| Patient Health ID | Implemented | A patient receives a non-credential `AHI-…` display ID and an opaque, generation-specific QR request link. QR token hashes are stored, not raw QR tokens. |
| QR/link actions | Implemented | The patient can display, download, print, copy, share, reveal, and replace the request link. The QR opens a request form, never a record bundle. |
| Access request | Implemented | The requester supplies an organization, optional name, self-reported role, and purpose. The request response contains a separate random request token and does not disclose patient identity or records. |
| Patient consent | Implemented | The patient sees the requester and purpose, starts with no records selected, selects specific owned documents/records/medications, reviews the requested scope and duration, then approves or denies. |
| Share scope and expiry | Implemented | The server validates every selected record's owner and ID. Supported durations are 15 minutes, 30 minutes, 1 hour, 6 hours, 24 hours, and 3 days; the backend rejects all other values. |
| Healthcare viewer | Implemented with prototype limitation | The separate `/shared/:token` page returns only records on an active approved `ShareGrant`, displays the requester as unverified, and has no patient dashboard controls. The bearer link is not a verified professional login. |
| Expiry and revocation | Implemented | Protected viewer, status, brief, and document requests check current server-side grant/consent state. Patient revocation updates the grant and consent state; the viewer polls status and clears its displayed data after expiry/revocation. |
| Access history | Partial | Request decisions, grants, views, brief generation, revocation, and expiration are shown from persisted request/grant events. Event arrays are bounded; this is not an immutable compliance audit ledger and does not yet record full actor identity or correlation IDs. |
| AI Health Brief | Implemented with service dependency | The brief endpoint loads only record IDs in the approved grant, rechecks active consent, and submits that scoped data to the configured local Ollama chat service. The response cites source IDs/titles and states the AI limitation. |
| Other categories | Not supported by this prototype | The consent scope currently supports documents, health records, and medications only. Appointments, trends, diagnoses as a separate category, timeline, and standalone FHIR resources are not presented as shareable options. |
| Notifications and provider authentication | Not configured | Patients see requests in the in-app panel; no email/push delivery or clinician/hospital identity verification is configured. |
| FHIR interoperability | Partial/prototype | The share returns a FHIR R4-style demonstration bundle. No official profile/terminology validator, ABDM integration, or live facility exchange is configured. |
| Demo fixtures | Implemented separately | Cross-facility examples are fictional and isolated from patient-account records. No fictitious shares are added to real patient accounts. |

## Consent and API flow

1. The patient opens **Share with Hospital** in the authenticated workspace.
2. A QR scan or secure-link visit posts a request to
   `POST /api/health-id/requests`; it cannot read any patient record.
3. The patient polls and reviews requests at
   `GET /api/health-id/requests`, selects explicit record IDs, and approves
   with a duration or denies.
4. Approval creates a `ShareGrant` linked to the request. The request token
   becomes useful as a bearer viewer token only after approval.
5. `/api/shares/public/:token`, its status endpoint, the document endpoint,
   and the AI brief endpoint verify active grant state and, for Health ID
   grants, approved consent and expiry.
6. The patient can revoke a grant in the Health ID tab. Regenerating the QR
   invalidates the prior QR and its pending requests but leaves independent
   active grants unchanged.

Patient endpoints:

- `GET /api/health-id/my`
- `POST /api/health-id/my/regenerate`
- `GET /api/health-id/requests`
- `POST /api/health-id/requests/:id/approve`
- `POST /api/health-id/requests/:id/deny`
- `DELETE /api/health-id/requests/:id`

Consent-request and viewer endpoints:

- `POST /api/health-id/requests`
- `GET /api/health-id/requests/status/:token`
- `GET /api/shares/public/:token`
- `GET /api/shares/public/:token/status`
- `GET /api/shares/public/:token/documents/:documentId`
- `POST /api/shares/public/:token/brief`

Sensitive viewer and QR responses use `Cache-Control: no-store`; the
application sets `Referrer-Policy: no-referrer`.

## Security properties and deployment limits

- QR tokens are opaque HMAC-derived values tied to the Health ID generation;
  only their SHA-256 hashes are stored. Request tokens are 32 random bytes and
  are also stored as hashes. The HMAC secret is `HEALTH_ID_QR_SECRET`, falling
  back to the existing `JWT_SECRET`.
- Valid QR identities are limited to 10 request creations per hour through an
  atomic MongoDB counter. Request status polling is limited to 30 checks per
  minute per request. There is not yet a distributed IP-level rate limiter for
  invalid-token traffic.
- Consent scope is enforced by server-side record ID and patient ownership
  queries. Hiding an item in the frontend is not the authorization control.
- Grant expiry and revocation are enforced at request time; no background
  cleanup job is required for authorization and no durable scheduler is
  configured.
- The QR link is a bearer request credential. Although referrers are disabled
  and application code does not log raw tokens, deployed infrastructure must
  also avoid logging full request paths. Use HTTPS in deployment.
- A downloaded or externally copied document cannot be erased by revoking
  access. Revocation stops future access through this application's protected
  endpoints.
- Provider name, role, and organization are self-reported. The viewer must not
  be described as verified.
- Direct patient-created share links retain their existing bearer-link behavior
  and supported longer expirations. The stricter three-day limit applies to
  Health ID consent grants.
- This prototype's event arrays retain only a bounded recent history. Use a
  separately protected, append-only audit service before representing the
  feature as a regulated production audit trail.

## Validation

The automated backend tests cover QR privacy, request rate limiting, role
validation, scoped approval, ownership rejection, duration limits, expiration,
and the authorization gate before displaying a Health ID grant. A mocked
Ollama test verifies the AI-brief service receives only the records passed by
its scope-enforcing controller.

Automated tests and a frontend build do not prove MongoDB-backed isolation or
clinical correctness. A real two-account workflow against an isolated test
database, configured Ollama, and a separate browser remains a deployment
acceptance test. No real patient data should be used for that test.

## Remaining work before production

- Add authenticated and verified provider identity, organization claims, and
  an appropriate professional session rather than relying on bearer-link
  possession.
- Move access history into a durable append-only audit store with actor,
  outcome, correlation/request ID, and tamper-evident controls.
- Add distributed IP/source rate limiting, operational monitoring, and
  infrastructure log redaction for token-bearing paths.
- Validate applicable FHIR R4 profiles/terminologies and implement official
  interoperability integrations only with their required credentials and
  conformance testing.
- Perform a MongoDB-backed security assessment and end-to-end testing with
  isolated fictional patient and requester accounts.
