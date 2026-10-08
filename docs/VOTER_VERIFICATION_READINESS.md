# Voter verification readiness — 8 October 2026

Code and database rules are verified locally. Production delivery and deployment are not yet certified.

## Implemented

- Roster and access-code writes use membership-checked database RPCs. Browser users cannot read internal event organization IDs, credential hashes, or change usage/ownership fields directly.
- Roster identifiers support email, Ghana phone, index number, student ID, membership ID, and other text. Leading zeros are preserved. Imports accept CSV/TXT with quoted values and recognized identifier headers, with a 5,000-voter limit per request.
- Email and phone roster entries must match the signed-in account's confirmed contact. Ghana phone formatting is normalized, with compatibility for previously imported phone hashes.
- Index numbers and other identifiers require a randomly generated private claim code plus a confirmed sign-in account. Organizer imports return the plain codes once for CSV download; only hashes are stored. Send each voter only their own code. Reimporting an unused identifier rotates its code; redeemed identifiers retain their binding and do not issue another code.
- A roster entry cannot be reassigned to another account. Each account can redeem one roster entry per event. Redeemed entries cannot be deleted to reset vote history. Repeated redemption is safe.
- Roster vote allowances are enforced atomically across all categories, alongside each event's per-category/per-nominee limit. Repeated vote request keys do not consume votes twice. The UI displays the smaller remaining allowance.
- Private code verification checks event method/status, expiry, revocation, and capacity. Repeated redemption by the same account does not consume another use. Newly generated codes contain more random data than the previous ten-character codes.
- Private verification requests are limited per account/event to ten attempts in five minutes. Failure responses preserve the database counter. Old unprotected redemption RPCs are no longer callable by browser roles.
- Review submission, publication, and resume enforce the selected verification prerequisites in the database. Voter-list events require available roster entries; phone rosters require SMS credits; invite-code events require an active code; phone events require SMS credits. Email and index-only events do not require SMS credits. Unsupported methods fail closed.
- Database status transitions also require valid dates, active categories and nominees, and paid-checkout readiness where applicable.
- The all-method free-vote RPC no longer inserts into the nonexistent `vote_batches.channel` column and retains audit logging.
- Production OTP request actions require a configured CAPTCHA site key and a submitted token. Supabase must validate that token server-side.

## Evidence

`npm run test:verification` applies every migration to embedded PostgreSQL and executes requests as the real `authenticated` role with test JWT subjects. It covers all four methods, tenant isolation, direct-write denial, unreadable hashes, private-code requirements, account binding, normalized imports, publish gates, category prerequisites, repeated requests, exhausted global roster quotas, revocation, and persisted rate limits. It makes no changes to the hosted database.

`node scripts/test-payment-database.mjs` covers payment/SMS and lifecycle regressions. The optimized production build, TypeScript, and lint checks passed for the modified feature files. Repository-wide lint has existing failures in unrelated files and the pre-existing phone form changes.

A read-only check of the configured hosted public Auth settings confirmed email signup enabled, phone signup enabled, and email auto-confirmation disabled. This does not prove delivery or CAPTCHA enforcement.

## Outstanding launch checks

1. Apply `supabase/migrations/20261120100000_verification_production_readiness.sql` to the intended Supabase project and deploy the matching application together. The application calls new RPCs and requires the migration. This change has not been applied to the hosted project in this session.
2. Configure and test hosted SMTP and OTP templates. Both new-account and existing-account email codes must arrive, verify, and reject expired/wrong codes.
3. Verify deployed Arkesel API key, sender ID, Supabase secret key, signed Send SMS Hook secret, and the hosted hook configuration. These values were absent from the local `.env.local`; deployment configuration was not inspected. Test Ghana network delivery, expired/wrong codes, verified phone state, and SMS debits.
4. Enable backend Turnstile validation in hosted Supabase Auth. A site key in the browser alone is insufficient. Test missing, malformed, expired, replayed, and valid tokens.
5. Use two real test accounts in the deployed browser to exercise organizer import, claim-code download/distribution, blocked publication without prerequisites, admin approval, all four voter verification methods, voting, and rejection of credential reuse. Real OTP messages were not sent during this work.
6. Review existing roster redemptions before rollout: previous code allowed account reassignment and multiple identifiers per account. The new code prevents further reassignment and uses the earliest redemption consistently, but does not rewrite historical vote data.

Related setup: `docs/ARKESEL_SMS_SETUP.md`, `docs/RESEND_EMAIL_SETUP.md`, `docs/TURNSTILE_SETUP.md`.
