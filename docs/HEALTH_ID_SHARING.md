# Patient-Controlled Health ID QR

The authenticated **Share with Hospital** sidebar section offers two
patient-controlled prototype flows. **Share selected records** creates a
time-limited direct link and QR for selected patient-owned reports, health
records, and medications. Patients choose a validity of 1 hour, 6 hours, 24
hours, 3 days, 7 days, or 30 days, then can copy/share the link, download the
QR, and revoke the grant from access history. **Review hospital requests**
retains the consent-first Health ID QR flow described below. Neither flow is an
official ABHA/ABDM identity, provider-verification service, or consent artefact.

Direct links are bearer credentials: anyone who receives the link or QR can
view only the selected records until expiry or revocation. They do not verify
that the recipient is a hospital or clinician.

## Access flow

1. For the request-based flow, a patient opens Share with Hospital and chooses
   Review hospital requests. The API creates a random `AHI-`
   display identifier once and derives an opaque QR token from that identifier,
   a generation number, and `HEALTH_ID_QR_SECRET` (or `JWT_SECRET` when no
   dedicated key is configured). MongoDB stores only the SHA-256 token hash,
   not the raw QR token.
2. The QR points to `/health-access/<opaque-token>`. A scanner can submit a
   self-reported organization, optional name, role, and purpose. The response
   gives the scanner a separate random request token, but no patient identity
   or health information.
3. The patient reviews the pending request, selects owned documents, health
   records, and/or medications (none are selected by default), then approves
   for 15 minutes, 30 minutes, 1 hour, 6 hours, 24 hours, or 3 days, or denies
   it. A pending request expires after 15 minutes. An identity can receive at
   most 10 requests per hour.
4. Approval creates a normal `ShareGrant`; the request token hash becomes the
   bearer token hash for the selected-record viewer. Viewer, status, AI brief,
   and document download endpoints re-check grant expiry/revocation and, for
   QR requests, the approved consent state. The viewer checks status every
   eight seconds and clears its displayed data when access is unavailable.
5. The patient can revoke an active grant or replace the QR. Replacing a QR
   invalidates the old token and denies pending requests from it. Request
   decisions and bounded access events appear in the patient history.
6. The professional viewer can request an AI Health Brief. The backend
   retrieves only explicitly shared record IDs, submits those scoped records to
   the configured local Ollama service, and records brief generation. AI
   output is labeled as informational and not clinician-verified.

## API surface

- `GET /api/health-id/my` — authenticated patient QR identity.
- `POST /api/health-id/my/regenerate` — replace the QR.
- `POST /api/health-id/requests` — public, consent-pending request creation.
- `GET /api/health-id/requests/status/:token` — scanner status only.
- `GET /api/health-id/requests` — patient request and access history.
- `POST /api/health-id/requests/:id/approve` or `/deny` — patient decision.
- `DELETE /api/health-id/requests/:id` — immediate revocation.
- `GET /api/shares/public/:token` — approved, time-limited FHIR-style bundle.
- `GET /api/shares/public/:token/status` — no-record status check for the
  professional viewer.
- `GET /api/shares/public/:token/documents/:documentId` — selected document
  download, authorized against the current grant.
- `POST /api/shares/public/:token/brief` — AI summary of only the approved
  records; requires the local Ollama chat model.

## Security and limitations

- QR tokens are HMAC-derived opaque values and request/share tokens use 256-bit
  random values; MongoDB stores SHA-256 hashes. The raw QR token is returned only to the signed-in
  patient UI and raw request token only to the requesting browser. A MongoDB
  atomic counter limits an identity to 10 access requests in its one-hour
  request window; status polling is limited to 30 attempts per request per
  minute.
- Organization, requester name, and role are unverified user input. This prototype
  does not authenticate clinicians, send notifications, provide emergency
  access, or connect to ABDM.
- Existing direct patient-created share links retain their prior bearer-link
  behavior. QR-created links are only minted after the patient approves.
- FHIR output remains the app's FHIR R4-style prototype, not official profile
  or terminology validation.
- Rotating the dedicated `HEALTH_ID_QR_SECRET` (or fallback `JWT_SECRET`)
  invalidates displayed QR tokens; after a key rotation, the patient should
  sign in and replace the QR.
- Request and status limits are enforced atomically in MongoDB. Invalid-token
  traffic does not yet have a distributed IP-level rate limiter. This is not a
  substitute for provider identity verification, security assessment, or
  production deployment controls.
- Revocation prevents future access through the app but cannot erase documents
  or data already downloaded by a recipient.
