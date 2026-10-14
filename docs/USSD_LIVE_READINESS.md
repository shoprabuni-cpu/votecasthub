# USSD live readiness audit

The simulator has been exercised on the Preview branch with a separate Supabase
project and Paystack test transactions. This establishes simulator behavior; it
does not establish live carrier delivery or settlement.

## Code checked

- Native callbacks require the secret URL token and assigned subscription user ID
  outside simulator mode. Sessions bind caller, network and subscription identity.
- Vercel Production rejects simulator mode and test Paystack keys. Keep USSD
  disabled there until the subscription and launch checks are complete.
- Production also rejects the known simulator database and a nonempty test-event
  allowlist. Simulator access fixtures are blocked in the live voting menu.
- Free votes use the same phone identity and voting limits as web voting.
- Charges use the saved verified organizer subaccount and the existing 10% share.
- Confirmed declines and timeouts mark pending attempts failed and explain that
  no votes were recorded. Test-number declines identify the official test number.
- Unknown charge outcomes remain uncertain; the menu does not invite a repeat
  payment. Provider response bodies, email addresses, phone numbers and OTPs are
  not included in diagnostic logs.
- Success is verified by reference, amount, currency, test/live domain, fees and
  subaccount before votes are fulfilled. Signed Paystack webhooks reconcile votes
  even after the USSD session ends.
- Verified failed USSD transactions close recovery jobs without issuing votes.
  Pending outcomes stay pending; reversed transactions never produce a success
  message. Daily recovery queues missed callbacks before processing, rather than
  waiting an additional day. Paystack deployments do not call the unused adapter.

## Production settings to verify when ready

These are requirements, not a claim that remote Production settings were read.
The connected Vercel tools previously denied access to this project's deployment.

Admin → USSD now has a **Live service readiness** panel. Open it on Production
after deploying these changes. It reads the deployment's configuration without
displaying keys and probes the required USSD database columns. Preview cannot
claim live readiness. Complete provider details are marked **After purchase**.
The panel does not independently verify the provider account, webhook delivery,
assigned shortcode ownership or live settlement.

The private, Git-ignored `.env.ussd-production.local` file contains a prepared
USSD-only configuration with newly generated callback/session secrets. It is
not automatically loaded by Next.js. Copy its values into **Production only** in
Vercel, selecting no Git branch; keep existing live app credentials there.
Do not copy it over the Preview branch's test values. Keep `USSD_ENABLED=false`.
The file deliberately leaves assigned user ID and dialing code empty until
purchase. Preserve the existing `CRON_SECRET`, or create one of at least 32
random characters if absent. Redeploy `main` as Production after configuring.

The local `.env.local` audit found incomplete simulator settings: no server
database credential, an invalid or absent HTTPS site URL, an incomplete dialing
code and an empty event allowlist. The user configured values directly in Vercel;
local results do not describe that deployment. Synchronize local configuration
with the isolated test project before testing locally. Never copy the local test
file wholesale into Production.

| Setting | Live requirement |
| --- | --- |
| USSD_ENABLED | false until launch checks pass; true for the pilot |
| USSD_LIVE_LAUNCH_ENABLED | false/absent until purchase and live checks; true only for launch |
| USSD_SIMULATOR_MODE | false |
| USSD_SIMULATOR_EVENT_IDS | empty |
| USSD_SESSION_PROTOCOL | arkesel-json |
| USSD_PAYMENT_PROVIDER | paystack |
| PAYSTACK_SECRET_KEY | live key for the correct Paystack business |
| NEXT_PUBLIC_SUPABASE_URL / public key / server key | matching live project credentials |
| NEXT_PUBLIC_SITE_URL | stable live HTTPS website |
| ARKESEL_USSD_SERVICE_CODE | actual purchased extension code, including # |
| ARKESEL_USSD_USER_ID | assigned Arkesel subscription identity |
| ARKESEL_USSD_CALLBACK_TOKEN | new private secret; replace the value shared in chat |
| ARKESEL_USSD_SHARED_SECRET | separate private secret of at least 32 characters |

Register the live session callback as
`https://LIVE-HOST/api/ussd/arkesel?key=PRIVATE-CALLBACK-TOKEN`.
Register `https://LIVE-HOST/api/payments/paystack/webhook` in Paystack's live
webhook settings. Confirm external provider requests can reach both endpoints.
Preview protection bypass values belong only to testing; do not copy the test
endpoint into a live provider configuration.

The scripts under `supabase/test-data/` are manual simulator fixtures, not
migrations. They must never be applied to the live database or included in a
production database deployment. Their SMS balances and synthetic USSD access
approvals are test data. Do not transfer those records into live storage.

Verify the live project's migration history separately. Refresh organizer payout
verification using live credentials; test subaccounts are not live settlement
accounts. Complete normal event approval, accepted quote, verified access fee and
audited activation in the live database. Confirm Arkesel pricing, subscription
dates, multi-organizer permission and network session costs before activation.

Run the read-only `supabase/checks/ussd-production-readiness.sql` in the live SQL
Editor to check all required RPC signatures. A missing result requires the
corresponding migration, not simulator seed SQL. After purchase add the assigned
user ID and dialing code, register the secret callback URL, then enable the
gateway for controlled real-phone testing with both `USSD_ENABLED=true` and
`USSD_LIVE_LAUNCH_ENABLED=true`. Production rejects gateway requests while the
separate launch gate is absent or false, including if `USSD_ENABLED` was already
true in Vercel. Keep both false before purchase. Activate pilot events only after
confirming their quote/payment and testing acknowledgement. These final carrier
and settlement checks necessarily follow the purchase.

Run a free vote and a small paid vote on a real handset for each supported network.
Verify the paid vote, provider fee, platform share, organizer ledger and settlement.
Check payment rejection, delayed callback, duplicate callback and refund handling.

## Read-only environment check

Run against an explicitly prepared environment file:

```powershell
node --env-file=.env.local scripts/audit-ussd-env.mjs --preview
```

Use `--production` with a separately prepared live environment. The output contains
only check names and PASS/CHECK results. It does not change settings and cannot
confirm remote dashboard scope, provider ownership or database migration state.

References: [Paystack Charge API](https://paystack.com/docs/api/charge/),
[test payment details](https://paystack.com/docs/payments/test-payments/),
[webhook verification](https://paystack.com/docs/payments/webhooks/).
