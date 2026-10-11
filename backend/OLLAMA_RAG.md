# Ollama health assistant

The assistant uses Ollama for embeddings and generated answers. The default
endpoint is `http://127.0.0.1:11434`; set `OLLAMA_BASE_URL`,
`OLLAMA_MODEL`, and `OLLAMA_EMBEDDING_MODEL` in the backend environment to
configure it. Keep the endpoint on a trusted machine: requests include the
user's question and, when needed, excerpts from that user's records.

Patient retrieval always filters MongoDB records and cached chunks by the
authenticated user's ID. Embeddings and their source text are stored in the
MongoDB `ragchunks` collection, with patient and medical-reference scopes kept
separate. The assistant avoids showing semantic similarity as a medical
confidence score. It uses deterministic lookups for active medication lists
and latest matching lab results; comparison arithmetic is performed only for
numeric values recorded with the same unit.

## Reviewed medical references

General medical answers require retrieved content in the separate
`MedicalKnowledge` collection. There is no built-in medical corpus, and the
assistant declines general medical questions when no reviewed reference is
available. A `HOSPITAL_ADMIN` can add reviewed text using the authenticated
`POST /api/conversations/medical-knowledge` endpoint:

```json
{
  "source": "MedlinePlus",
  "title": "Reviewed reference title",
  "url": "https://medlineplus.gov/example.html",
  "category": "laboratory tests",
  "content": "At least 100 characters of reviewed reference text."
}
```

Only HTTPS URLs at CDC, FDA, MedlinePlus, NHS, NIDDK, NIH, or WHO domains are
accepted. The endpoint stores supplied text; it does not fetch or independently
verify the page. Administrators must check that the content matches the source,
is current, and is appropriate before approving it. Content remains separate
from patient records and is cited as a reviewed medical reference in the chat.

Emergency phrase detection is a conservative safeguard, not a substitute for
emergency triage. The assistant is informational only, is not a FHIR
conformance validator, and does not provide clinical diagnosis or treatment
recommendations.
