# VotecastHub GH

A Ghana-focused platform for organizers to run free or paid voting for awards, competitions, and events. The first release is a web platform; this product is not designed for legally binding public elections.

## Stack

- Next.js 16, React 19, TypeScript 6 on Node.js 24
- Supabase PostgreSQL, Auth, Storage, and Realtime
- Supabase Edge Functions (TypeScript/Deno) for payment and USSD integrations
- SQL migrations and the project-pinned Supabase CLI
- Zod for server boundary validation; ESLint and TypeScript checks
- Accessible, responsive UI using maintained project CSS
- Payment and USSD provider adapters selected after Ghana onboarding, fees, settlement, and security review

## Local setup

1. Install Node.js 24 and Docker Desktop.
2. Run `npm ci` from this folder.
3. Run `npm run supabase:start` for the local Supabase stack.
4. Copy `.env.example` to `.env.local` and use the local Supabase URL and publishable key printed by the CLI.
5. Run `npm run dev` and open `http://localhost:3000`.

Local email signup requires confirmation. The Supabase CLI starts an email testing inbox (Inbucket); use the local dashboard or CLI output to open the confirmation message. For staging and production, configure a real SMTP provider, set the site URL and allowed redirect URLs, and keep email confirmation enabled.

The local Supabase stack requires Docker. The app is linked to a development Supabase project; configure phone SMS in Supabase Auth before voter OTP can be delivered. No mobile-money payment provider or USSD gateway is connected. Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable or client component.

## Checks

Run `npm run lint`, `npm run typecheck`, and `npm run build`. Run `npm run db:lint` and `npm run db:test` after the local Supabase stack starts. Database changes belong in `supabase/migrations`; do not make untracked production-only changes in the Supabase dashboard.

## Project docs

- `docs/ROADMAP.md` — delivery phases and exit criteria
- `docs/ARCHITECTURE.md` — service boundaries and trust model
- `docs/PAGES_AND_FLOWS.md` — page map and user journeys
- `docs/DECISIONS.md` — settled assumptions and decisions still needed
- `docs/AUTH_PRODUCTION_CHECKLIST.md` — hosted auth setup and acceptance checks
- `docs/ARKESEL_SMS_SETUP.md` — Arkesel SMS hook, secrets, and Vercel deployment
- `docs/RESEND_EMAIL_SETUP.md` — Resend SMTP for all current automated emails and Cloudflare contact routing

## Status

The app includes organizer email/password authentication, organization onboarding, event setup and lifecycle actions, draft category and nominee editing, rules, free/paid modes, a private draft preview, nominee photo uploads, confirmed-phone OTP voting, public results visibility controls, and public event/nominee pages. Free votes are checked transactionally against event dates, nominee visibility, per-category limits, verified identity, and idempotency keys. Nominee media uses a private bucket and event-aware storage policies. Organization managers can create seven-day, role-limited invitations; the recipient must use a confirmed matching email, and acceptance is single-use and audited. Managers share the generated invite link manually. The linked development database is synchronized through all current migrations; 68 hosted RLS, isolation, vote-limit, media-access, and invitation assertions pass in a rolled-back transaction. Supabase SMS delivery, production email/auth settings, paid checkout, provider reconciliation, member removal/role changes, admin tools, USSD, and pilot operations remain unfinished, so the full product is not production-ready.
