# USSD connection and launch

## What is implemented

Organizer request → admin quote → owner/admin acceptance → Paystack access payment
→ confirmed payment → admin activation period → numeric event-code menu.
An access purchase never creates votes or automatically activates a shortcode.
Refunds revoke access. The existing reconciliation cron handles missed callbacks.
Audit entries retain quote revisions, agreement and activation changes.

Carrier-verified free callers use Supabase's canonical verified phone user and the
same `cast_free_votes` function as website voters. Both channels share category
and nominee limits. Free USSD currently supports phone-verified events only;
email and private access methods remain on the website and cannot be activated
on USSD. No SMS credit is consumed by a USSD vote.

Paid votes reserve one attempt per session. Confirmation verifies provider state
before applying amount, fee, ledger and reversal changes. Completed sessions and
callback retries cannot create another vote. Session expiry is ten minutes.

## Native Arkesel session adapter

Implemented against the supplied Arkesel USSD reference: JSON POST fields
`sessionID`, `userID`, `newSession`, `msisdn`, `userData`, `network`; JSON response
fields `sessionID`, `userID`, `msisdn`, `message`, `continueSession`. The native
route stores incremental inputs and translates them into the shared vote engine.
The HTTP response is 200 JSON; the reference’s “100” response label is not used
as an HTTP status because 100 Continue is an informational HTTP response.

Set `USSD_SESSION_PROTOCOL=arkesel-json`, your assigned `ARKESEL_USSD_USER_ID`,
and a random server-only `ARKESEL_USSD_CALLBACK_TOKEN` of at least 32 characters.
Register the HTTPS callback URL `/api/ussd/arkesel?key=<callback-token>` in the
Arkesel subscription. Keep that full URL private, redact it from access logs and
never place it in a flyer or public page. `userID` alone is not authentication.
Arkesel documents no authorization header, so it must preserve the secret query
parameter. Confirm this and their network delivery/retry guarantees in testing.
If they do not preserve it, use an authenticated gateway; do not remove checks.

Free phone voting can run without `USSD_ADAPTER_URL` or `USSD_ADAPTER_TOKEN`.
Paid USSD uses Paystack Charge API by default; an alternate payment adapter is optional.
The native protocol does not supply a request sequence number. Inputs may repeat
legitimately across steps, so the app does not blindly deduplicate by input value.
A six-digit confirmation challenge prevents a retried quantity from authorizing
a vote. Busy callbacks return 503 for retry; completed sessions replay their JSON
response. Confirm retry ordering and unique session IDs with Arkesel.

Apply `20261209100000_arkesel_native_sessions.sql` after the operations migration.

## Provider information still required

Ask Arkesel support through their account portal for:

- Session callback body, response format, character/time limits and caller identity guarantee.
- Callback authentication/signature details and retry behavior.
- Optional Arkesel payment APIs only if switching away from the implemented Paystack payment path.
- Sandbox access and sample successful/failed/reversed transactions.
- Settlement destination, fees, network charges and multi-organizer hosting permission.
- Shortcode renewal/activation rules and cross-network testing arrangements.

Documentation entry point: https://developers.arkesel.com/

## Internal normalized adapter contract

This is VotecastHub's contract, **not Arkesel's documented native protocol**.
The native JSON session adapter described above provides the session translation.
Only deployments selecting `USSD_PAYMENT_PROVIDER=adapter` need the alternate
Mobile Money adapter below. The default Paystack integration is implemented.

Session callback: `POST /api/ussd/arkesel`, URL-encoded fields:
`sessionId`, `serviceCode`, `phoneNumber` (233 plus nine digits), `text` (cumulative
star-separated numeric input). Response is plain text `CON ...` or `END ...`.
Session IDs must be unique, preserved across retries and bound to one caller.

All adapter callbacks must have `x-vch-timestamp` (Unix seconds) and
`x-vch-signature` (lowercase hex HMAC-SHA256 over `timestamp + '.' + exact raw body`,
using `ARKESEL_USSD_SHARED_SECRET`). Requests older than five minutes are rejected.
The signature covers the caller and every input field. Resign legitimate retries.

Payment initiation: the app sends `POST {USSD_ADAPTER_URL}/payments` with Bearer
`USSD_ADAPTER_TOKEN`, and JSON `{reference, phoneNumber, amount, currency:"GHS"}`.
Amounts are integer pesewas. Response: `{reference, accepted:true}`. The adapter
MUST durably deduplicate by reference and return the same operation on retries.
The app does not automatically resend an uncertain initiation. Support should
verify the reference with the provider before any new checkout.

Verification: `GET {USSD_ADAPTER_URL}/payments/{reference}` with the same Bearer
token returns `{reference, transactionId, mode, status, amount, currency, fees}`.
`transactionId` is a stable, provider-unique positive safe integer; `mode` is
`live` or `test`; `status` is `pending`, `success`, `failed` or `reversed`;
`currency` must be `GHS`; amount and fees are integer pesewas. The adapter must
query authoritative provider state, not return unverified callback assertions.
If the provider uses string IDs, the adapter needs a persistent one-to-one ID map.
Use distinct live/test environments and never report test transactions as live.

Payment callback: signed JSON `POST /api/ussd/arkesel/payment` containing
`{reference}`. The app then calls verification. Retry HTTP 503 callbacks. It does
not grant votes based on a callback's claimed amount/status.

## Environment and activation

Keep USSD_ENABLED=false until provider configuration and live tests are complete.
For native sessions set USSD_SESSION_PROTOCOL=arkesel-json, your assigned
ARKESEL_USSD_USER_ID, ARKESEL_USSD_CALLBACK_TOKEN (32+ random characters),
ARKESEL_USSD_SHARED_SECRET (32+ random characters), and the real
ARKESEL_USSD_SERVICE_CODE. Register the secret HTTPS callback URL with Arkesel.

The default USSD_PAYMENT_PROVIDER=paystack uses the existing server-only Paystack
key, webhook and reconciliation cron. No Arkesel payment URL or alternate adapter
is required. Confirm Ghana Mobile Money and organizer subaccount settlement in
Paystack. For the optional adapter provider only, configure USSD_ADAPTER_URL,
USSD_ADAPTER_TOKEN, normalized-v1 contract and the explicit live/test mode.
Legacy ARKESEL_USSD_PAYMENT_URL is not used by the app.

Apply request, quote, operations, native-session and Paystack-charge migrations
in order. Run local tests and then sandbox/real-phone checks on supported networks.
Only activate a published, paid-for event after testing. No live charge, shortcode
purchase, remote migration, credential change or deployment was performed here.

## Default Paystack payment path

Configure `USSD_PAYMENT_PROVIDER=paystack` and your server-only Paystack key.
Arkesel’s network field maps MTN → mtn, AirtelTigo/AT → atl, Telecel/Vodafone → vod.
The caller’s phone is formatted locally for `POST /charge`, with GHS integer
pesewas, the customer receipt email, the reserved reference, organizer subaccount,
`bearer=account` and the existing platform split. Charge initiation is claimed
once in the database. An uncertain request is verified instead of resubmitted.

`send_otp` prompts for the payment OTP and calls `/charge/submit_otp`; OTPs are not
saved. `pending` offers a status check no earlier than ten seconds. `pay_offline`
ends the menu and asks the caller to approve the network’s Mobile Money prompt.
`failed`/`timeout` do not grant votes. Unexpected verification methods direct the
caller to web/support, never request a MoMo PIN through the app. `success` still
runs server-side transaction verification. The existing authenticated Paystack
webhook and reconciliation cron handle later successes, refunds and reversals.

References: https://paystack.com/docs/payments/payment-channels/#mobile-money
and https://paystack.com/docs/api/charge/ . Confirm Ghana MoMo availability and
subaccount settlement in your account before live activation. No Arkesel payment
API URL is required for this path. Apply the Paystack USSD migration after native
sessions and run the USSD tests before deployment.
