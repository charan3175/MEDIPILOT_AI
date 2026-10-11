# Reminders

## Implemented

- Reused the authenticated patient workspace and existing MongoDB `Reminder` collection/API. No second reminder store or fake reminder events were added.
- Replaced the basic reminders form/list with a responsive reminder center: due-today timeline, All/Today/Upcoming/Completed/Needs attention filters, search, summary counts, create/edit, pause/resume, dismiss, completion, and cancellation history.
- Reminder times are stored as instants alongside the user's IANA time zone and displayed in that zone. Appointment reminders explicitly link to a confirmed patient appointment and use a selected lead time; rescheduling updates linked reminders, while appointment completion/cancellation disables linked reminders without deleting their history.
- Medication reminders require an active medication owned by the patient. The reminder UI shows only saved medicine instructions and asks the user to select a date/time rather than deriving one from a frequency or inventing a dose schedule.
- Follow-up reminders may link an explicitly selected patient-owned source document. Reminder creation validates linked medication, appointment, and document ownership on the server.
- Duplicate active reminders with identical category, source links, scheduled instant, and recurrence are rejected with HTTP 409.
- Reminder completion is a user action; dismissing is distinct from completion. A reminder cannot be marked complete before its scheduled time. Completing a medication reminder does not change the medication or claim a notification was delivered.
- Personal Copilot reminder queries are routed to patient-scoped saved reminder lookups.
- The UI explicitly states that reminders are persisted in-app only. No browser, email, push, or durable background delivery service is configured, so the app does not claim that notifications are scheduled or sent.

## Limitations

- The dashboard is an in-app reminder list, not a durable job scheduler. A saved future reminder will not generate an automatic notification while the app is closed.
- New reminders support one-time schedules only. Existing `DAILY`/`WEEKLY` values can remain in stored records but are not expanded into occurrences or delivered; the UI labels them as saved configuration only.
- Reminder completion is not a medication dose-event record. It records that the reminder was completed, not a verified administration event.
- Browser timezone is used for new task reminders. Appointment-linked reminders use the appointment's stored timezone. A user can edit the time and timezone only through their local browser context.
- No MongoDB-backed browser E2E tests or real notification-provider acceptance tests are configured.

## Verification

- Backend tests cover patient-scoped reminder creation, linked active-medication and confirmed-appointment validation, dismissal/cancellation retention, explicit completion, appointment reminder cleanup, and reminder query classification.
- Frontend production build, focused frontend tests, lint, and Problems diagnostics were run during implementation. Existing lint warnings in unrelated files and the large AnatomyViewer bundle warning remain.
