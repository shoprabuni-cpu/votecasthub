# Organizer analytics

Analytics opens with an animated event picker. No totals, standings, charts or
analytics RPC are loaded until the organizer selects one event. The selected
event defaults to Whole event (p_days=0), beginning at its earliest recorded
activity or creation day. Optional filters cover 7, 30 or 365 UTC calendar days.
Cards, standings, earnings and result downloads always cover the whole event. Date filters only change the chart within Explore voting activity.

Category leaders, ties, vote shares and distance behind first place come before
the voting activity chart. Zero-vote nominees have no displayed position or
winner. Standings always cover the whole event. Paid events have collapsed earnings details. Payment logs, organization
comparisons, SMS reports and moderation audits are absent from this page.
Financial records remain available through the Payments workspace and existing
protected export endpoints. Reduced-motion preferences disable the welcome animation.

## Metric definitions

- Valid votes: original free quantities and remaining fully funded paid votes,
  excluding reversed batches. A refund of 155 minor units at 100 per vote removes
  two votes. Vote trends use batch creation time.
- Gross collections: original confirmed paid-vote collections, before refunds.
- Refunds: current cumulative refunds on those payments.
- Organizer net: current earning after platform fees and refunds, not a payout.
- Revenue uses payment confirmation time, falling back to ledger creation time.
  Current adjustments are attributed to the original payment day, not refund-day
  cash flow. All amounts are GHS; exported money columns contain minor units.
- Event visitors: distinct stored browser identifiers over the selected period
  within an event. Organization totals sum distinct event/browser pairs because
  existing identifiers are event-specific. This is not distinct people across the
  organization. Page views cover event overview pages, not all website pages.
- Conversion is not displayed. Existing counters increment starts and successes
  on the same vote insert and cannot measure an actual conversion funnel.

## Exports and access

Votes export actual vote batches, recorded and valid quantities, and the paid/free
indicator. Payment/refund exports use the same confirmed ledger as the dashboard.
Nominees export period totals. The old settlements URL is retained as a payment
earnings export; it is not a payout report. SMS exports list organization-wide
purchase and send-attempt records from the real tables, with pending purchases
clearly labelled; credits are not a reconstructed balance. Moderation exports
remain restricted to platform administrators and are not offered to organizers.

Checked SECURITY DEFINER functions reject non-members and foreign event UUIDs,
use an empty search path, and are executable only by authenticated users. Internal
helpers are not callable by clients. JSON export payloads avoid the hosted default
row cap. Export responses are private/no-store and CSV values are escaped against
formula injection. Analytics failure displays an unavailable state, not zeroes.

## Release order and validation

Apply `20261117100000_scoped_organizer_analytics.sql` to the intended Supabase
environment **before deploying the updated app**. Do not push local Auth URL
configuration to production. No hosted migration or deployment was performed by
the local implementation.

Run `npm run test:analytics` (or `node scripts/test-analytics.mjs`) for embedded
PostgreSQL migration, event/tenant isolation, period boundaries, partial/full
refunds, consistent chart totals, visitor deduplication, exports above 1000 rows,
SMS purchases, category ties and CSV escaping. Run the payment regression script,
TypeScript, ESLint and production build as well. Finally verify event switching,
date changes, empty states and downloads with an authenticated organizer on the
hosted environment. Browser/inbox identifiers and client-reported views are
activity estimates and do not provide a bot-proof count of people.


## Event stages and freshness

Draft, upcoming, active, paused, ended and archived events have distinct guidance.
Upcoming events show a countdown; quiet active events offer a copy-link action.
Category summaries explain ties and vote margins. Active margins of ten votes or
less are described as close contests, not winner predictions.

The authorized analytics RPC returns its database snapshot time, valid votes today
(UTC), the latest valid vote/paid confirmation timestamp, and unresolved payment
attempts separately. Pending attempts never become counted votes until confirmed.
An ended event with unresolved attempts warns organizers before announcing results;
this page does not certify final results or automatically close payment attempts.

Active, upcoming and paused events, and events with unresolved payments, refresh
every 30 seconds while visible. Refresh pauses during form editing and requests in
flight. A manual refresh and elapsed snapshot age remain available for all stages.

