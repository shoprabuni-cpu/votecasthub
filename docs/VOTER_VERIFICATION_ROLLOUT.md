# Event-page voter verification rollout

The correction is implemented locally. Apply the database migration before deploying the app that calls the new RPCs. Supabase config.toml changes affect local development; they do not enable settings in an existing hosted project.

## Apply and configure

1. Apply all pending migrations with `npx supabase db push` against the intended linked project. The new migration is `20261127100000_on_page_voter_verification.sql`. It relies on earlier migrations, including public search visibility; do not run it in isolation on an older schema.
2. In Supabase Authentication → Sign In / Providers, enable Anonymous Sign-Ins. These sessions are created only after valid private voting details pass preflight. No account registration screen is shown. The SQL and organizer route guard prevent contactless/background voters from creating organization workspaces.
3. Keep Cloudflare Turnstile enabled in Supabase Auth. Use the same widget's site key as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Store that widget's secret in Vercel as `TURNSTILE_SECRET_KEY`, for the environments being deployed. This validates code redemption by an already established session. Never put secret keys in chat or client-prefixed variables.
4. For Auth rate limits to use individual voter addresses instead of the Vercel server's address, add a modern `sb_secret_…` Supabase key as `SUPABASE_SECRET_KEY` on Vercel. Enable IP Address Forwarding in Supabase Authentication → Rate Limits. The server-only Auth client forwards only Vercel's trusted IP header. Legacy service-role keys cannot support this forwarding; the code falls back to ordinary Auth behavior when forwarding credentials are absent.
5. Confirm the Supabase email OTP template includes `{{ .Token }}` and its SMTP/email hook can deliver at the expected volume. Resend notification configuration on Vercel alone does not configure Supabase Auth email delivery. Confirm the existing SMS hook and organizer SMS credits are ready. Supabase also has project-wide email/SMS rate limits: size them for expected traffic and budgets.
6. Deploy after configuration and migration. Test one real voter for each enabled method on a test event: verify, vote, reload, attempt a duplicate, and verify another category respects its allowance. Verify a missing contact receives a clear list error without an OTP request. Check mobile layout with a real browser. Automated DOM checks do not establish visual layout or delivery readiness.

## Expected experience

- Open phone/email events: enter contact → receive OTP → enter OTP → vote on the same page.
- Approved contact list: the same flow, with a roster check before OTP sending.
- Index/other-ID list: enter ID and the organizer's private code together → vote. No unrelated phone/email sign-in.
- Private voting code: enter code → vote. Create a separate code with one redemption for each intended voter; shared codes allow the configured number of activations.
- Verification remains available across event categories in the current session. Existing database limits, code redemption counts and roster vote allowances continue to apply.
- A code already bound to another session cannot be reactivated to reset allowances. If the voter loses their original browser session, they must contact the organizer. This change does not implement credential recovery or transferable ballot links.

## Verification evidence

`npm run build`, `npm run typecheck`, `npm run test:verification`, `npm run test:voter-flow`, `npm run test:voter-ui`, `npm run test:auth-captcha`, `npm run test:event-discovery`, and `npm run test:event-review`.

The focused ESLint checks pass for the changed voting/auth components. Repository-wide lint still reports unrelated existing errors. Automated checks use embedded PostgreSQL and mocked provider calls: they send no live email/SMS and cast no production votes.

Provider reference: https://supabase.com/docs/guides/auth/rate-limits

## Connected-project check (9 October 2026)

A read-only check confirmed that Anonymous Sign-Ins are disabled (`external.anonymous_users=false`) and the new input-type RPC is not present. The local environment has neither `TURNSTILE_SECRET_KEY` nor a modern `SUPABASE_SECRET_KEY`. This check does not establish which variables are configured in Vercel. No hosted migration or setting was changed.

## Hosted configuration audit (9 October 2026)

Vercel production already contains TURNSTILE_SECRET_KEY, NEXT_PUBLIC_TURNSTILE_SITE_KEY, SUPABASE_SECRET_KEY, ARKESEL_API_KEY, ARKESEL_SENDER_ID, SUPABASE_SEND_SMS_HOOK_SECRET, RESEND_API_KEY and RESEND_FROM_EMAIL. Local absence is not evidence that hosted variables are missing. Vercel Secret values are not pullable, so their values and key format were not inspected.

Supabase Auth has Turnstile enabled and custom Resend SMTP enabled at smtp.resend.com:465, sender info@votecasthub.com. The SMS hook is enabled at https://votecasthub.vercel.app/api/auth/send-sms. Hosted email OTP length is eight digits; the new inputs support six to eight. Hosted email quota is 30 messages/hour; the SMS quota matches the local 30/hour default. Vercel SMS_DAILY_LIMIT is 100. These are project-wide limits in addition to per-voter protections. IP forwarding does not increase them.

Read-only SQL found 88 organizer SMS credits, no currently open published free-voting events, and one failed SMS attempt at 2026-10-08 19:45:27 UTC. No successful SMS attempts were recorded in the last 30 days. The provider failure reason remains unverified because the historical Vercel log query failed. Supabase SMS template has a missing closing brace; the custom SMS hook constructs its own message, so causality is not established.

The IP Address Forwarding switch and email OTP template body were not exposed by the CLI config comparison. They remain unverified. Browser automation failed to initialize. No live verification email/SMS was sent in this audit, despite receiving authorized test contacts. Real inbox receipt and OTP completion remain to be tested. No hosted settings were changed.
