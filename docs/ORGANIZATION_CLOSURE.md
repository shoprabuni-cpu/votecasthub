# Admin organization closure

Apply `supabase/migrations/20261121100000_admin_organization_closure.sql` before deploying the application changes.

Platform admins can review closure requests in `/admin/organizers`, approve them or close a workspace directly from its profile. Closure requires the exact organization name and a reason. Moderators can reject requests; support has read access. Owners and organization admins can submit one pending request at a time.

Closure permanently deactivates the workspace, revokes pending invitations, expires SMS sponsorships, hides public events/results, and blocks organizer changes, new votes, verification, SMS purchases and payment initialization. Closed workspaces cannot be reactivated through moderation. Events, membership, voting, payment, SMS and audit history remain retained for platform administration. This is soft closure, not a physical database purge.

Pending vote payments, SMS purchases, payouts and payment-account operations must be resolved before closure. Existing paid transactions can still settle during suspension. Restrictions permit organizer reads but block changes and voting; suspension removes organizer access. Reactivation restores access according to the existing event state and dates.

Validation: `npm run test:organization-closure`, `npm run test:verification`, `node scripts/test-payment-database.mjs`, targeted ESLint and `npm run build`. Database tests apply all migrations to embedded PostgreSQL. Hosted database migration and live browser validation remain separate deployment steps.
