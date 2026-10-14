# Testing before renting a shortcode

Simulator mode does not require an assigned extension userID. It still requires
the private callback URL, binds each session to its caller/network/userID and
refuses live Paystack keys or alternate payment adapters. It is disabled by default.

## Deploy a test environment

Use a preview/test deployment with a separate test Supabase project. Test voting
creates sessions, auth users, votes and test ledger records; do not connect it to
the production database. `.env.local` is ignored by Git and will not be uploaded
when deploying from Git. Copy the relevant values into the hosting platform's
test/preview environment settings, then redeploy.

Set these server variables from `.env.local`:

```env
USSD_ENABLED=true
USSD_SESSION_PROTOCOL=arkesel-json
USSD_PAYMENT_PROVIDER=paystack
USSD_SIMULATOR_MODE=true
PAYSTACK_SECRET_KEY=<your sk_test_ key>
ARKESEL_USSD_CALLBACK_TOKEN=<generated secret from .env.local>
ARKESEL_USSD_SHARED_SECRET=<generated secret from .env.local>
ARKESEL_USSD_SERVICE_CODE=*928*123#
ARKESEL_USSD_USER_ID=
USSD_SIMULATOR_EVENT_IDS=
```

Also configure the test project's normal Supabase URL, public key and server-only
`SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`), and the test site's
`NEXT_PUBLIC_SITE_URL`. The simulator needs the server credential to store sessions;
the public Supabase key alone is insufficient. Do not send secrets through chat.

Apply the USSD migrations in order: request, quote, operations, native sessions,
then Paystack charge. If already applied, do not replay them manually.

## Test the welcome menu first

In Arkesel's simulator use:

- Extension: Not linked to an extension.
- Endpoint: `https://TEST-HOST/api/ussd/arkesel?key=CALLBACK-TOKEN`.
- Dialled string: `*928*123#`, matching the configured service code.
- Dial from: a test Ghanaian number.
- Network: MTN, AIRTELTIGO or VODAFONE.

The token must be the actual generated callback secret; keep the full URL private.
Press Dial. The welcome menu should offer Vote and Exit. No real shortcode is needed.
Arkesel must preserve the query parameter when making its callback.

## Test an event

1. Create and approve a test event in the test database, with current voting dates,
   categories and nominees. Use phone verification for free USSD.
2. Request USSD access, issue and accept a quote, and pay it using Paystack test
   checkout. Configure the Paystack test webhook at
   `https://TEST-HOST/api/payments/paystack/webhook` for confirmation.
3. Put the test event's UUID (not its numeric dialing ID) into
   `USSD_SIMULATOR_EVENT_IDS`. Multiple test UUIDs are comma separated. Redeploy.
4. In Admin → USSD requests, set the matching dialing code and dates, acknowledge
   simulator testing and click **Enable simulator event**. Real-phone testing is
   not falsely certified by this acknowledgement. Payment/date/role checks remain.
5. Enter the event's numeric event code in the simulator. Walk through categories,
   nominees, quantity and confirmation. Paid tests use Paystack test transactions;
   free tests create test votes in the test database. Other events are blocked.

Public dialing cards/flyers are hidden in simulator mode. This environment is not
a live dialable service. Simulator testing does not prove carrier delivery or
live settlement; complete those checks after acquiring an extension.

Before live use disable `USSD_SIMULATOR_MODE`, configure the real assigned userID
and service code, use the correct live credentials/database and complete the live
activation checklist. Never copy test financial records into production.
