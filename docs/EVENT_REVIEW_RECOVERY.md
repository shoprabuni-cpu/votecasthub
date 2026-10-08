# Event review, communication, and editing

Apply `20261124100000_event_review_recovery.sql` before deploying these app changes. No production records were changed during development.

Organizers submit drafts for review. The event remains private until approved. Submission checks require valid dates with a future closing time and retain the existing category, nominee, verification, and payment-account gates.

An organizer can withdraw a pending review even when its scheduled start or end has passed. Owners/admins can also return an unused published or paused event to draft. Both paths clear approval; editing and resubmission require another platform review. Events with vote batches or any payment attempts cannot return to draft. Permanently closed/archived events remain closed. Database row locks coordinate recovery with new voting/payment activity.

Admin Return for changes saves a required explanation, restores a draft, and notifies the organization. Dashboard cards show Changes requested, Awaiting approval, actual voting status, expired-date warnings, current feedback, and the relevant editing action. Admin and organizer event pages include a private message thread; organization managers can reply. Notifications link to the event and refresh while the app is visible or regains focus. Review feedback and correction history are private to the organization/platform team, including historical review notices.

Published events allow description and cover updates. Competition identity, voter instructions, prices/eligibility, results settings, and recorded activity remain protected. Sensitive corrections require platform review. The correction queue now collects the review note already required by the database, passes it to approval, reports errors, and notifies the organizer of the outcome. Expired live events can reopen with a public explanation using their selected verification method; email events no longer require SMS credits.

Checks:

- `npm run test:event-review`: all migrations; expired review withdrawal/return; editable draft dates; resubmission/reapproval; private messages and correction history; linked notifications; safe live edits; sensitive correction approval; activity/closure locks; email reopening without SMS.
- `npm run test:event-discovery`: actual React dashboard warnings, submission labels, editor field locks, review-note form, and approval/return/correction HTTP responses.
- Existing verification, deletion, and closure suites check retained safeguards.

DOM tests do not establish rendered mobile/desktop geometry. Production browser and approval checks remain after migration/deployment.
