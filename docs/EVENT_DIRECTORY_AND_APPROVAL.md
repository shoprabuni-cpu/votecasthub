# Public event directory and admin approval

Apply `20261123100000_public_directory_and_event_approval.sql` before deploying the app changes. The homepage and `/events` use the same public directory RPC.

The Tailwind grid has two mobile columns, three tablet columns, four desktop columns, and five or six on larger screens. Each batch contains 24 cards; Load more adds rows. Search, voting type, actual voting-window status, and sort run on the server. Only the fetched batch receives signed image URLs. Public results exclude private events, suspended/closed organizations, purged events, and pending deletion targets, including when the visitor is signed in as an organizer.

Approval authenticates the admin, validates the event UUID, and uses a locked pending-review transition. Publication guards still check event dates, categories, nominees, payment account readiness, and voter verification resources. The previous API returned the same 400 for every RPC failure, while the UI silently discarded its response. Expected blockers now return explanatory 403/404/409 responses; unexpected failures are logged and return 500. The admin screen displays failures and permits retry after network errors.

The production console's 400 status alone does not establish which database condition blocked that event. Local database tests confirm valid approvals work across organization boundaries and invalid reviews remain pending. No production event was approved during development.

Validation:

- `npm run test:event-discovery`: actual React DOM filtering, pagination, default-filter reset, approval error/retry, and endpoint status responses. These tests check utility classes, not rendered browser geometry.
- `npm run test:verification`: all migrations, 100-event pagination, window filters, literal search, suspended-organization exclusion, valid approval, stale review, and publication blockers.
- Organization closure and admin deletion suites cover the existing lifecycle protections.

After migration and deployment, verify `/` and `/events` at mobile and desktop widths and retry the affected approval. Any displayed prerequisite must be corrected before approval can succeed.
