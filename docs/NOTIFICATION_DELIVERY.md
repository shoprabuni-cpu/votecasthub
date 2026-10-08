# Event notification delivery

Apply `20261125100000_notification_email_outbox.sql` after the event review recovery migration, then deploy the application.

Vercel must have `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL` (the canonical HTTPS site URL), the existing Supabase service key and `CRON_SECRET`. The sender is `VotecastHub <info@votecasthub.com>`; its domain must be verified in Resend.

Draft → awaiting review queues one email per active platform admin with a confirmed email. Awaiting review → published queues one per organization owner/admin with a confirmed email. Phone-only accounts continue to receive in-app notifications. Existing events are not backfilled to avoid sending historical alerts.

Emails are queued transactionally, dispatched after submission/approval responses, and recovered by the authenticated `/api/notifications/process` cron endpoint. Claims use leases and `SKIP LOCKED` to prevent concurrent workers from sending the same job. Frozen payloads and Resend idempotency keys protect retries. A Resend acceptance is recorded as `sent`, not proof of inbox delivery. Inspect delivery/bounce information in the Resend dashboard using `provider_id`.

The included fallback cron runs daily at 04:00 UTC to remain compatible with Vercel Hobby. Immediate delivery runs after event actions; due retries also run whenever another review or approval triggers the worker. For timely retries and larger queues, configure a scheduler to GET `/api/notifications/process` every minute with `Authorization: Bearer <CRON_SECRET>`, or change the cron schedule to `* * * * *` on a Vercel plan supporting it. Each run claims at most five emails.

Inspect `notification_email_jobs` through a service/admin database connection. It stores status, attempts, last error, next attempt time and provider ID. Authenticated app users cannot read email addresses or invoke the claim RPC. Removed recipients and purged events are cancelled. Sent/cancelled receipts are removed after 30 days; failed records remain for investigation. Do not reset an uncertain failure before checking Resend logs: requests with an ambiguous outcome stop before the provider's 24-hour idempotency window expires.

No live messages are sent by automated tests. Validate the deployed flow with a test event and controlled admin/organizer accounts after migration and deployment.
