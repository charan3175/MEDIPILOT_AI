# MediPilot AI — Secure Medical Report Chatbot

A small, movable AI chatbot that stays on the MediPilot AI website. A user can click the round button to open the chat and ask questions about their own uploaded medical reports.

Examples of questions:
- “Explain my latest blood test in simple English.”
- “Which values were marked high or low in my report?”
- “Compare my two reports and explain what changed.”
- “What medicines are listed on this prescription?”
- “Can you explain this report in Telugu?”

The chatbot is intended to help people understand their documents. It does **not** diagnose illnesses or replace a qualified healthcare professional.

> **Project status:** This README describes the feature to build and the security requirements it should meet. It does not, by itself, mean the chatbot or its security controls are already implemented.

---

## 1. What We Want to Build

The chatbot has two parts:

1. **Floating chat button:** A small circular button stays near the bottom-right corner of the page. The user can drag it to another position. Clicking it opens or closes the chat panel.
2. **Private report-aware assistant:** The assistant answers questions using the signed-in user's permitted medical reports and shows which document supports each answer.

The chat should fit the existing MediPilot AI design, work on desktop and mobile, and not cover important page controls. It should include clear loading, error, empty, and “I couldn't find this in your reports” states.

## 2. How It Works

The simplest way to understand the system is:

**User question → Verify user → Find relevant report passages → Check the evidence → Generate an answer → Show answer with sources**

1. The user signs in and opens the chatbot.
2. The user asks a question about a report.
3. The backend verifies the user's session and access permissions.
4. The system searches only reports that this user is allowed to access.
5. Relevant text is retrieved from those reports.
6. The AI drafts an answer based on the retrieved evidence.
7. The response includes source details, such as the report name, date, page, or section when available.
8. If useful evidence cannot be found, the chatbot says so instead of guessing.

The frontend must never decide by itself which medical records a user is allowed to see. The backend must enforce those permissions on every request.

## 3. What Is RAG?

**RAG** means **Retrieval-Augmented Generation**. It lets the chatbot look up relevant information from a user's documents before composing a response.

A typical RAG flow has four steps:

1. **Prepare:** Extract text from uploaded reports using the document-processing/OCR pipeline. Keep document IDs, owner IDs, dates, page numbers, and other useful source information with the text.
2. **Retrieve:** Search for the passages that are relevant to the question. Filter by the authenticated user and the user's access permissions before returning any passages.
3. **Generate:** Give the language model the question and only the permitted passages needed to answer it.
4. **Cite and check:** Show the supporting document details, check that the answer is grounded in retrieved evidence, and use a safe fallback when evidence is missing or contradictory.

RAG can reduce unsupported answers, but it **cannot guarantee that an AI answer is always correct**. Medical values, units, dates, and medicine details need careful handling and, where appropriate, human review.

## 4. Privacy and Security Requirements

Medical reports contain highly sensitive personal information. Security is a core feature, not an optional improvement.

### Access control

- Require a valid, authenticated session before accessing private report chat.
- Apply authorization checks on the backend for every chat, search, report, and source-detail request.
- Restrict retrieval to the current user's records and any records explicitly shared with that user through the existing consent system.
- Do not trust a `userId`, `patientId`, document ID, or permission flag supplied by the browser without checking it against the authenticated session and database.
- Test that one user cannot retrieve another user's reports by changing a request, identifier, or URL.

### Protect data in transit and at rest

- Use HTTPS in production.
- Keep database credentials, session secrets, API keys, and encryption keys in server-side environment variables or a suitable secrets manager; never put secrets in frontend code or commit them to Git.
- Use secure password/session practices, appropriate cookie settings, and short-lived credentials where applicable.
- Apply the application's database access controls and storage protections to uploaded files, extracted text, embeddings, chat history, and source metadata.
- Do not expose open public URLs to private reports. Authorize a source request on the backend before providing access to a document.

### AI-provider privacy

- Send only the minimum report passages needed for the current question to the model.
- Never send all of a user's records by default.
- Before using an external AI or embedding provider, review its data-retention and training policies and tell users what will be sent. Do not promise that a provider stores nothing unless that has been verified under the selected account and configuration.
- Where possible, support a local/self-hosted model for deployments that require tighter data control. A local model still needs authentication, authorization, secure logging, and infrastructure protection.
- Do not log full report text, prompts containing medical data, raw access tokens, passwords, or API keys in ordinary application logs.
- Make any optional chat-history storage clear to the user and apply the same access controls to it as to the underlying records.

### Safe handling of retrieved documents

Treat text extracted from reports as **data, not instructions**. A document may contain misleading text or prompt-injection instructions. The chatbot must not follow instructions embedded in an uploaded document that ask it to reveal secrets, ignore access controls, or retrieve unrelated records.

### Rate limits and monitoring

- Rate-limit chat and document-search endpoints.
- Apply upload-size and request-size limits.
- Record security events without storing sensitive medical content or raw tokens.
- Show a generic message to the user for unexpected server errors; keep technical details in protected server logs.

## 5. Medical Safety Rules

The chatbot should:

- Explain medical terms in simple language and support Telugu or other configured languages where available.
- Preserve the original result, value, unit, reference range, report date, and abnormal flag where available.
- Distinguish what the report explicitly says from a general explanation.
- Point out when reports have different dates, units, or reference ranges instead of comparing them carelessly.
- Cite the report evidence behind report-specific statements.
- Say “I couldn't find that information in your available reports” when the evidence is missing.
- Explain uncertainty and ask a clarifying question when the user's question is unclear.
- Encourage the user to discuss concerning or confusing results with a qualified clinician.
- Direct the user to local emergency services or urgent medical care if they describe a possible emergency; the chatbot must not delay emergency care.

The chatbot must **not**:

- Invent a test result, diagnosis, medicine, dosage, allergy, date, or doctor instruction.
- Tell a user to start, stop, or change a prescribed medicine based only on an AI response.
- claim that a normal-looking result proves the user is healthy, or that one abnormal value alone proves a specific disease.
- Present a report summary as a confirmed diagnosis.
- Use another patient's documents to answer the current user's question.
- Treat an AI-generated answer as a replacement for professional medical advice.

## 6. Suggested User Interface

### Floating button

- Circular button fixed near the bottom-right of the page.
- Clear chatbot icon and accessible label, such as **“Open MediPilot AI chat.”**
- Drag support with mouse and touch; keyboard-accessible alternatives should also be provided.
- Keep the button within the visible viewport and away from essential controls.
- Remembering its position should be optional and must not store medical information.
- Opening the chat should not reload the page or discard a form the user is working on.

### Chat panel

Include:

- Header: **MediPilot AI — Your report assistant**
- A short privacy note explaining that answers use reports the signed-in user is permitted to access.
- Message history for the current session, with a clear-chat option.
- Text input, send button, and loading indicator.
- Source chips or links beneath an answer, for example: `CBC Report · 10 Oct 2026 · Page 2`.
- Useful starter prompts such as “Explain my latest report” and “Compare my reports.”
- A visible warning that the assistant provides explanations, not a diagnosis.
- Friendly empty, no-evidence, offline, and error messages.

The visual design should match the existing MediPilot AI website and work at mobile widths. Avoid a large dashboard that blocks the page.

## 7. Suggested Architecture

Use the existing project stack rather than introducing a separate application.

- **Frontend:** Existing Next.js application; a reusable floating chatbot component and chat panel.
- **Backend:** Existing Express API; authenticated chat endpoint, permission checks, retrieval service, and model adapter.
- **Medical document pipeline:** Reuse the existing upload, OCR, extraction, and database records. Do not build a second, disconnected copy of the report system.
- **Retrieval layer:** Search indexed report text or embeddings, with user and document access filters enforced before any content reaches the model.
- **Language model:** A configurable provider adapter so the model can be changed without rewriting the UI. Never expose the provider API key to the browser.
- **Database:** Reuse the existing database for report ownership, permissions, and—only if needed—chat session metadata. Store chat content only under a clear retention policy.

### High-level flow

```text
Next.js floating chat
        |
        v
Express chat endpoint
        |
        +--> Validate session and permissions
        |
        +--> Retrieve only permitted report passages
        |
        +--> Build a limited, evidence-focused prompt
        |
        +--> Call configured LLM
        |
        +--> Validate response and attach source references
        |
        v
Answer + report citations returned to the chat
```

This diagram describes the intended flow. The exact model, vector database, and OCR implementation depend on the existing application and deployment choices.

## 8. API Design Example

These are **suggested endpoint shapes**, not a claim that these routes already exist. Adapt them to the backend's current API conventions.

### `POST /api/ai-chat/message`

Example request:

```json
{
  "message": "Explain my latest blood test in simple English",
  "sessionId": "optional-current-chat-session-id",
  "language": "en"
}
```

The backend should obtain the user identity from the verified session/token—not from the body—and retrieve only that user's permitted records.

Example response:

```json
{
  "answer": "Your report shows...",
  "sources": [
    {
      "documentId": "authorized-document-id",
      "documentName": "CBC Report",
      "date": "2026-10-10",
      "page": 2
    }
  ],
  "grounded": true,
  "disclaimer": "This is an explanation of your report, not a diagnosis."
}
```

The values above are illustrative. Real source details must come from the database and document-processing pipeline. The server must authorize every source before returning a link or document details.

Possible supporting endpoints include:

- `GET /api/ai-chat/sessions` — list the signed-in user's chat sessions, if history is enabled.
- `DELETE /api/ai-chat/sessions/:id` — delete a session owned by the signed-in user, subject to the documented retention policy.

Do not create every endpoint automatically if the project already has equivalent routes. Reuse existing services where possible.

## 9. Environment Configuration

Keep provider settings on the backend. Add only the variables required by the provider and retrieval system you actually implement.

Illustrative names:

```env
# Examples only — use names that match your implementation.
LLM_PROVIDER=your_selected_provider
LLM_API_KEY=keep_this_server_side
LLM_MODEL=your_selected_model
EMBEDDING_PROVIDER=your_selected_embedding_provider
```

- Do not paste real secrets into README files, source code, screenshots, or Git commits.
- Add secret-bearing `.env` files to `.gitignore` and commit a `.env.example` containing placeholders only.
- Validate required variables on backend startup and show a safe, actionable error if configuration is missing.
- If credentials have been accidentally exposed, rotate them and update the local environment.

## 10. Error and Fallback Behaviour

The chatbot should handle these cases gracefully:

| Situation | Expected behaviour |
|---|---|
| User is signed out | Ask the user to sign in; return no private report data. |
| No reports are uploaded | Explain that there are no available reports and guide the user to upload one. |
| No relevant passage is found | Say the answer could not be found in the available reports; do not invent one. |
| The model is unavailable | Show a friendly temporary error and allow retrying. |
| A report failed OCR | Explain that the document could not be read reliably and request a clearer upload or review. |
| Sources disagree | Explain the discrepancy and show dates/sources rather than silently choosing one. |
| A source is no longer accessible | Do not return its content or a working private link. |
| The request is too broad | Ask which report, date, or result the user wants to discuss. |

## 11. Testing Checklist

Before calling the feature ready, test the following.

### User interface

- [ ] Floating button opens and closes the chat.
- [ ] Button can be moved with mouse and touch and cannot be dragged off-screen.
- [ ] Chat works on desktop and mobile and supports keyboard navigation.
- [ ] Sending, loading, retry, empty, and error states work correctly.

### Report answers

- [ ] The assistant answers using actual uploaded reports, not sample data.
- [ ] Each report-specific answer shows accurate sources when available.
- [ ] Missing evidence results in a clear fallback rather than a guess.
- [ ] Values, units, dates, and reference ranges are preserved accurately.
- [ ] Telugu/language switching works if enabled and does not silently change the underlying report values.

### Security

- [ ] Requests require authentication.
- [ ] Changing IDs in browser requests never reveals another user's data.
- [ ] Retrieval filters are enforced on the server before text is sent to the model.
- [ ] Private report URLs cannot be opened by an unauthorized user.
- [ ] Secrets are absent from frontend bundles, source control, and ordinary logs.
- [ ] Rate limiting and request-size limits are enabled.
- [ ] Uploaded text cannot instruct the model to expose other records or secrets.
- [ ] If an external AI service is used, the data flow and provider settings are documented.

## 12. Definition of Done

The feature is ready for a demo only when all of these are true:

1. The movable round button works across the existing site's main pages.
2. The chat uses the existing sign-in system and real medical records.
3. Every search and answer is limited to records the current user is authorized to access.
4. Report-specific claims have traceable source details, where the source provides them.
5. The assistant admits when evidence is missing and follows the medical safety rules above.
6. Privacy and cross-user access tests pass.
7. The team can explain what data reaches the language model and whether any external provider processes it.
8. The README and demo accurately describe what is implemented—without claiming untested security, privacy, or integrations.

---

## Important Note

This chatbot is a document-understanding aid, not a medical decision-maker. **Authentication, server-side authorization, source-grounded retrieval, and honest handling of uncertainty are mandatory.** A floating button and an LLM alone do not make a secure medical chatbot.
