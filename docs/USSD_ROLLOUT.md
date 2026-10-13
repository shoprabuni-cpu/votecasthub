# USSD rollout

One provider shortcode serves VotecastHub GH. Events receive numeric routing IDs;
these are not separately rented shortcodes. Confirm multi-organizer hosting and
all rental/session/payment charges with the provider before activation.

## Delivery checklist

- [x] Organizer request/cancellation in Voting settings, independent of web voting.
- [x] Review summary and admin request queue; no automatic activation or billing.
- [ ] Provider contract: shortcode, activation dates, session charges, payment API,
  authentication protocol, sandbox, and multi-organizer authorization.
- [x] Admin quotes and owner/admin acceptance with price, terms, expiry and stale-quote protection.
- [x] Payment tracking, unique event IDs,
  activation period and audit history. Never activate from a request alone.
- [x] Internal secure gateway: mandatory provider authentication, caller/session binding,
  expiry, duplicate-request protection, numeric event lookup, paginated menus.
- [x] Phone-verified free voting shares web identities, limits and idempotency.
  Email/private events remain website-only; the gateway never bypasses their access rules.
- [x] Internal paid voting: usable quantity/confirmation menus, verified payment amount,
  currency and provider, ledger fulfillment, retries, reversals and reconciliation.
- [x] Active-only instructions on event/nominee pages and flyers; disclose any
  network session charge, keep SMS credits separate, stop access on event closure.
- [x] Database and route tests for internal free/paid outcomes, permissions and retries.
- [x] Native Arkesel JSON session adapter from the supplied API reference.
- [x] Paystack Charge API for Ghana Mobile Money, using native Arkesel session network.
- [ ] Provider sandbox and real-phone tests across supported networks and settlement.

## First delivery

Organizers can request a quote or cancel the request. Admin can see the queue.
Requests do not enable the unfinished gateway, promise a price, deduct credits,
block website approval, or expose a dialing code to voters.

Apply `20261206100000_event_ussd_requests.sql` before deploying this delivery.

## Quote delivery

Apply `20261207100000_ussd_quotes.sql` after the request migration. Quotes record
price and terms. Owner/admin acceptance does not charge money or enable a code.
Accepted agreements cannot be overwritten or cancelled through the request form.
Payment tracking, immutable audit history and activation are implemented in the operations delivery.

## Operations delivery

Apply `20261208100000_ussd_operations.sql` after the quote migration. Organizer
access fees use Paystack, separate from SMS and voter charges. Configured events
get a unique numeric routing code. Audited activation requires confirmed access
payment, published status, valid dates and provider test acknowledgement.

Local checks: request/quote permissions, all migrations, ledger/reversal behavior,
shared web/USSD phone vote limits, signed callbacks, session binding and expiry,
confirmation menus, pagination, replay handling, existing setup and deletion flows.

USSD stays disabled by default. The remaining external work is account configuration, sandbox and real-phone validation.
See [provider connection instructions](USSD_PROVIDER_CONTRACT.md). No shortcode
was purchased, credentials changed, migration applied remotely or deployment made.

## Native session delivery

Native Arkesel JSON callbacks, incremental inputs, JSON responses and subscription
checks are implemented. Apply the native-session migration after operations.
Free phone voting does not need the payment adapter. Paid USSD now uses Paystack Charge API, so Arkesel Mobile Money is not required.
Voice Connect remains a separate service. See the provider contract for secure callback registration.

## Paystack Mobile Money delivery

Apply `20261210100000_paystack_ussd_charge.sql` after native sessions. Set
`USSD_PAYMENT_PROVIDER=paystack` (default). Native Arkesel menus identify the
network; Paystack provider codes are mtn, atl and vod. Charges snapshot the
organizer settlement account and keep the existing 10% platform share.

Paystack requires a customer email. A verified email linked to the caller phone
is reused; otherwise the USSD menu asks for a receipt email. Payment OTPs travel
in memory only, never in navigation paths or logs. PIN and birthday/card flows
are not collected through this Mobile Money menu. Native session leases and a
single-initiation claim prevent retry charges. Pending checks wait at least ten
seconds. Webhooks and transaction verification record votes, fees and reversals
through the existing Paystack pipeline, including after the USSD session ends.

No live charges were made. Live work remaining: register the secure callback URL,
configure assigned subscription details, enable Ghana MoMo in Paystack, apply
migrations, verify settlement, test all supported networks, then activate.
