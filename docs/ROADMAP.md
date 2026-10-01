# Build roadmap

## Phase 1 — Foundation (implementation complete; local Supabase validation pending)

- [x] Create a separate `votehub-gh` project folder and Git repository.
- [x] Record product boundary, architecture, phased plan, and unresolved owner decisions.
- [x] Bootstrap Next.js 16, React 19, TypeScript, locked npm dependencies, lint/typecheck/build scripts, and Node 24 pin.
- [x] Add Supabase SSR browser/server clients, environment validation, secure headers, generic error boundaries, loading state, and liveness endpoint.
- [x] Initialize a pinned local Supabase CLI and disable automatic API exposure for newly created tables.
- [ ] Start local Supabase, apply migrations, and validate the app on a clean checkout (Docker is not available in the current environment).
- [x] Lint, typecheck, production build, and production route smoke checks pass for the web shell.
- [ ] Run database lint and pgTAP policy checks against local PostgreSQL after Docker is available.
- [ ] Confirm fee/payout model, paid-voter identity requirements, and first release channels before processing paid votes.

**Exit checkpoint:** a clean checkout runs Next.js and local Supabase; the initial schema applies cleanly; lint/typecheck/build pass; the MVP scope is documented; secrets are not committed.

## Phase 2 — Data model and access control (implementation complete; local Docker validation pending)

- [x] Draft organizations, memberships, events, categories, nominees, payment attempts, vote batches, ledger entries, payout requests, provider events, and audit records.
- [x] Add initial schema constraints, indexes, SQL migration, default-deny data exposure, and RLS read policies.
- [x] Apply migration and check public RLS plus cross-tenant event RPC behavior in temporary PGlite.
- [ ] Apply the migration and run pgTAP on Supabase local (requires Docker/Podman).
- [x] Add pgTAP policy tests for tenant isolation, public/private visibility, and financial table access.
- [x] Verify 68 hosted RLS, cross-tenant, free-vote limit, idempotency, storage-policy, and invitation pgTAP assertions in a rolled-back transaction.
- [ ] Run the local Supabase pgTAP runner; it requires Docker/Podman in this environment.
- [x] Add validated database functions for draft event setup and lifecycle actions; direct table writes remain denied.

**Exit checkpoint:** two organizers cannot read or change each other’s private data; public users see only published event data; payment, voter-private, ledger, and audit data are inaccessible from public client APIs.

## Phase 3 — Organizer workflows (in progress)

- [x] Email/password sign-in and registration with email confirmation and generic duplicate-account responses.
- [x] Password recovery with non-enumerating reset requests, one-time recovery callback, password update, and global refresh-session revocation.
- [ ] Configure production SMTP, HTTPS auth redirect allowlist, CAPTCHA/rate-limit policy, and run hosted auth acceptance checks.
- [x] Document auth launch configuration and hosted acceptance checks in docs/AUTH_PRODUCTION_CHECKLIST.md.
- [x] Verified auth callback, safe internal return paths, server-side identity verification, and sign-out.
- [x] Organization onboarding through a validated atomic database function; membership-scoped organization listing.
- [x] Create and edit draft event details, add categories and nominees, and publish/pause/resume/close/archive through role-checked database functions.
- [x] Configure free or paid event mode, a verified-phone limit for free events, event rules, dates, and result visibility in draft setup.
- [x] Edit, hide, and reorder draft categories and nominees through audited, role-checked database functions.
- [x] Record event setup and lifecycle changes in append-only audit history.
- [ ] Run auth and onboarding against local Supabase, including confirmation email flow and RLS checks.
- [x] Add a private, membership-checked event preview.
- [x] Add nominee photo uploads with a private bucket, file type/size checks, role-checked paths, and public access only after publication.
- [x] Add team invitations with seven-day expiry, role limits, confirmed-email matching, revocation, single-use acceptance, and audit records. Managers share the generated link manually; automatic email delivery remains pending.
- [ ] Add member removal and role changes with owner-protection rules.
- [ ] Admin review and audit history for consequential changes.

**Exit checkpoint:** an organizer can prepare and publish an event without direct database edits, and invalid lifecycle changes are rejected server-side.

## Phase 4 — Public voting (free-vote path implemented; paid provider remains)

- [x] Public event directory, event details, category browsing, and nominee profiles through public RLS policies.
- [x] Show free/paid mode and organizer-written voting rules on public event pages.
- [x] Add verified-phone OTP sign-in and enforce the configured free vote limit server-side before accepting free votes.
- [x] Add an atomic, idempotent free-vote recording path and public results visibility policy.
- [x] Display public totals only when the event's results policy allows it.
- [ ] Vote quantity and price calculation on the server.
- [ ] Pending payment and vote-batch model.
- [ ] Add a simulated provider for successful, failed, delayed, and repeated payment callbacks.
- [ ] Confirmation/reference screen and organizer results.

**Exit checkpoint:** the full flow can be demonstrated; votes are created only after simulated verified payment; retries never duplicate votes.

## Phase 5 — Real mobile-money integration

- [ ] Select a Ghana-capable payment provider after onboarding, fees, settlement, refund, webhook-authentication, and reconciliation review.
- [ ] Implement provider adapter and secret storage.
- [ ] Verify callbacks and query provider status where supported.
- [ ] Atomically mark a payment confirmed and create its vote batch.
- [ ] Add ledger entries for gross amount, fees, organizer share, refunds, and adjustments.
- [ ] Add reconciliation and support screens.

**Exit checkpoint:** sandbox transactions reconcile end to end, duplicate/forged/out-of-order callbacks are handled safely, and refund/settlement operations are documented before production money is accepted.

## Phase 6 — Administration, reporting, and pilot readiness

- [ ] Role-scoped admin tools for organizers, events, payments, and disputes.
- [ ] CSV reports with documented totals and timestamps.
- [ ] Rate limits, abuse controls, backup/restore procedure, error monitoring, and incident runbook.
- [ ] Privacy notices, retention/deletion approach, and support/refund process reviewed for the operating model.
- [ ] Run a closed pilot with reconciliation after each event.

**Exit checkpoint:** pilot votes, provider transactions, fees, organizer earnings, refunds, and reports balance and can be explained from audit records.

## Phase 7 — USSD

- [ ] Select authorized USSD gateway and shortcode arrangement after commercial review.
- [ ] Implement bounded menus, session expiry, input validation, and callback authentication.
- [ ] Reuse the same event rules, payment adapter, and vote-recording function as web.
- [ ] Test interrupted sessions, retries, payment delays, and insufficient menu space.

**Exit checkpoint:** web and USSD produce identical vote and ledger outcomes for equivalent confirmed payments.

## Phase 8 — Production launch and operations

- [ ] Production Supabase project, backups, secrets, domains, and deployment pipeline.
- [ ] Load/abuse checks sized to the first event; verify restore and provider reconciliation.
- [ ] Launch with a limited event and named support contact.
- [ ] Review metrics and incidents, fix launch blockers, then broaden organizer access.

**Launch completion:** a real event runs from organizer setup through voting close, payment reconciliation, organizer reporting, and documented payout/refund handling. Ongoing support and maintenance continue after launch.

## Out of first release

Native voter apps, ticketing, public/political elections, advanced fraud scoring, automated payouts, and multi-country support. Revisit these only after the first pilot reveals a need.


