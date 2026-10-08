# Admin event and organization deletion

Apply `supabase/migrations/20261122100000_admin_data_purge.sql` after the closure migration, then deploy the application. This change does not purge existing items automatically. An active platform admin must request each event or organization deletion.

## Admin flow

Event and organization detail pages show a deletion preview with content counts, retained references and financial blockers. Admins can download a JSON results snapshot containing event configuration and counted nominee standings; it does not include image files or individual voter identities. Deletion requires the exact item name and a reason of 20–1,000 characters.

Unused draft events without votes or financial records and empty organizations without financial activity are eligible for immediate deletion. Other items are closed/archived immediately and scheduled for purge after a fixed 30-day grace period. Pending event payments, organization payouts and payment-account operations block event deletion; organization deletion also blocks on pending SMS purchases. Checks repeat when the worker executes.

Admins can cancel during the grace period. Cancellation leaves the item closed/archived; it does not reopen voting or reactivate an organization. Cancellation is unavailable after the grace period ends because some purge batches may already have committed. Organizers, moderators and support cannot request or cancel deletions. The latter two can view previews and the deletion history page.

## Purge and retained history

Purge removes free-vote batches, voter roster entries, private access codes/redemptions, analytics detail/totals for the purged event, USSD sessions, correction requests, notices, moderation flags and disposable event content. Organization purge also removes membership, invitations, closure requests, notifications and SMS sponsorships. User authentication accounts are retained because they can belong to other organizations.

Events without financial references are physically deleted. Paid events retain small event/category/nominee reference rows required by foreign keys; descriptions, biographies, images, public codes and voter instructions are cleared. Paid vote batches, payments, financial ledgers, refunds, payouts, SMS purchases/usage, payment accounts/history and audit logs stay available for reconciliation. Organizations referenced by financial history or audit logs retain a closed reference row; otherwise the organization row is physically deleted. An unused organization with an existing audit reference therefore retains a small reference even though its workspace content is removed.

## Worker and retries

The existing authenticated daily `/api/payments/paystack/reconcile` cron processes deletion batches before payment reconciliation, using `CRON_SECRET` and the service database credentials already configured for that route. No new hosting scheduler is required. The worker processes two due jobs per transaction, up to ten transactions or 15 seconds per invocation. High-volume vote/roster/analytics deletes are limited to 5,000 rows per batch; organization event cleanup handles two events per batch. Large jobs resume on subsequent runs. File paths are queued transactionally in `event_image_cleanup`; the Storage API removes up to 50 objects per run and failed removals stay queued for retry.

Unresolved financial activity or database failures keep the job pending, record its error and retry the next day. `/admin/deletions` shows pending jobs first, completion outcomes, attempts and retry errors. The daily maintenance job also removes USSD sessions and rate limits expired for more than a day, and individual analytics visitor hashes older than 30 days; aggregate analytics totals for retained events remain.

Deleting rows creates reusable database space and does not guarantee an immediate reduction in allocated disk or hosting charges. Monitor actual table/index sizes and Storage usage after rollout.

## Validation

`npm run test:admin-deletion` applies every migration to embedded PostgreSQL and checks admin permissions, exact-name confirmation, blockers, immediate deletion, scheduling/cancellation, frozen items, resumable roster batches, failed-job retry, free-vote deletion, immutable paid history, post-purge refunds, image cleanup queuing, results snapshots, the actual HTTP handler and operational retention. Regression suites: `npm run test:verification`, `npm run test:organization-closure`, `node scripts/test-payment-database.mjs`. Also run targeted ESLint and `npm run build`.

These checks do not apply migrations to the hosted database or perform destructive browser tests against production. Hosted migration, scheduler execution and Storage deletion need verification after deployment.
