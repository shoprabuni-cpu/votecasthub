# Architecture

## System shape

```text
Organizer dashboard / public voting website
                  │
     Supabase Auth + client APIs
                  │
        PostgreSQL protected by RLS
          ├── database functions for atomic vote/ledger operations
          ├── Storage for event and nominee media
          └── Realtime for approved result updates
                  │
       Supabase Edge Functions (trusted server boundary)
          ├── payment initiation and provider webhooks
          └── USSD gateway callbacks (later phase)
```

Start with one Next.js web application and Supabase. Do not add a separate NestJS API until a concrete need outgrows Supabase Edge Functions (for example, sustained long-running jobs, queue workers, or integration complexity that needs a separately operated service).

## Trust boundaries

- Browser clients use the Supabase publishable key and a signed-in user token where required. Every exposed table has least-privilege grants and RLS policies.
- The service-role/secret key is server-only. It never ships in browser code, mobile code, or checked-in files.
- Payment and USSD callbacks are untrusted requests until authenticated and validated. Verify signatures or provider-specific callback credentials, validate expected amount/currency/reference, and query provider status when supported.
- Only trusted server code can confirm a payment. A database transaction then creates the corresponding vote batch and ledger entries together.
- Provider requests and callbacks carry stable idempotency references. Replayed or out-of-order callbacks must not create extra votes or financial entries.

## Core domain records

- `profiles`, `organizations`, `organization_members`: identity and tenant access.
- `events`, `categories`, `nominees`: event configuration and lifecycle.
- `nominee-images` private Storage bucket: images are stored under event/nominee-scoped paths; storage policies allow organizer edits on drafts and public reads only for published active nominees.
- `payment_attempts`: immutable snapshot of selected nominee, quantity, unit price, total, currency, and provider reference.
- `vote_batches`: append-only vote quantities. Paid batches link uniquely to successful payments; free batches record only a verified Auth user and event/category/nominee. Avoid one row per individual vote.
- `ledger_entries`: append-only gross, provider fee, platform fee, organizer share, refund, and adjustment entries.
- `payout_requests`: organizer request and review state; actual payout execution is a later operational decision.
- `provider_events`, `ussd_sessions`, `audit_logs`: callback idempotency, session state, and investigation trail.

Use integer minor currency units (pesewas), not floating-point values. Store event timestamps in UTC and display them in Ghana local time. Snapshot the applicable vote price and fee terms on each payment so later event edits cannot rewrite transaction history.

## Main flows

### Publish an event

Organizer edits a draft → server validates dates/prices/category and nominee state → event becomes published → public reads are limited to published fields and configured result visibility.

### Free vote

Voter requests an SMS OTP → Supabase Auth confirms the phone → voter submits nominee and quantity → a database function checks the confirmed phone, event window, active nominee, and per-category limit under a transaction lock → a unique request key makes retries safe → append the vote batch and audit record together.

### Pay and vote

Client requests a vote purchase → server checks event window, nominee, quantity limits, and server-side price → create pending payment → provider initiates mobile-money prompt → verified callback/provider lookup → database function atomically confirms payment, writes vote batch, and writes balanced ledger entries → client can fetch status by opaque reference.

### USSD (later)

Gateway posts session ID, caller number, and menu input → callback validates gateway and session → short menu response or payment initiation → same payment confirmation and database vote function as web. Do not try to hold a USSD session open while waiting for asynchronous mobile-money approval.

## Results and money

- Public totals are derived from confirmed vote batches and the event’s visibility setting. Do not expose voter phone numbers or raw payment records in public queries.
- Organizer balances are computed from ledger entries. Never let a client set a wallet balance.
- Reconciliation compares provider transaction exports/status with local payment references and ledger entries; discrepancies create review items, not silent edits.
- Refunds and corrections are new ledger entries linked to the original transaction.

## Deployment shape

- Local: Next.js dev server plus Supabase CLI local stack.
- Preview/staging: separate Supabase project and provider sandbox credentials.
- Production: separate Supabase project, restricted secrets, migrations applied through a reviewed deployment step, backup/restore procedure, logging and error monitoring.

## Security and privacy baseline

Enable RLS on all tables exposed through client APIs. Define policies by organization membership and event publication state. Keep payment PII and audit access restricted. Minimize voter information collected, define retention and deletion rules, rate-limit public purchase/session endpoints, and avoid logging secrets, full phone numbers, or payment credentials. Review the chosen provider’s security and settlement model before production.
- Production responses use a per-request CSP nonce; pages that carry nonces are dynamically rendered and are marked private/no-store to prevent cross-user HTML reuse.
- Proxy redirects are an optimistic session check only. Every sensitive query and mutation must also verify the user's identity and organization role at the data layer.

Public clients receive column-level access only to published event details. Organizer event listings use `get_organization_events`, which checks membership inside a fixed-search-path function; internal organization identifiers and owner identifiers are not granted to public or authenticated table queries.
