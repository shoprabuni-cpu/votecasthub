# Product and technology decisions

## Accepted starting decisions

1. Product scope is free or paid voting for awards and competitions, not legally binding public elections.
2. Build in a separate `votehub-gh` folder; the existing Flutter roster project is separate.
3. Web-first release: organizer dashboard, public voting, mobile-money payments, admin review, reporting.
4. Add USSD after web payments and vote reconciliation are proven.
5. Use Supabase Postgres/Auth/Storage/Realtime plus Edge Functions; use database functions for atomic, data-heavy operations.
6. Use a provider adapter so payment and USSD vendors can change without rewriting voting rules.
7. Use an append-only financial ledger; never accept client-submitted payment success or vote totals.
8. Free events use a per-verified-phone limit per category, selected by the organizer from 1 to 100 votes. Phone verification must be implemented before free voting opens; never trust a phone number supplied only in the browser.

## Decisions to confirm before implementing the related feature

- Organizer fee/commission and organizer payout process.
- Whether paid voters also need phone verification and what fraud controls justify collecting additional voter data.
- Vote limits per purchase and per event.
- Refund and dispute policy.
- Payment provider and USSD gateway, after Ghana availability, onboarding, fees, settlement, support, and callback security review.
- Privacy notice, retention period, and operational responsibility for voter data.

## Deferred

Native voter app, ticket sales, public elections, automatic payouts, advanced fraud scoring, and multi-country support.
