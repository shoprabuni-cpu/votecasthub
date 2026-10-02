# Pages and user journeys

## Public pages

| Page | Purpose | Main actions |
| --- | --- | --- |
| `/` | Explain the service and route users | Browse events, sign in, create organizer account |
| `/events` | Find currently published events | Search or open an event |
| `/events/[slug]` | Event overview with voting dates, price, categories, and nominees | Browse nominees; voting CTA is reserved for the payment phase |
| `/events/[slug]/nominees/[nomineeId]` | Show nominee biography and event/category context | Return to event; voting CTA comes with checkout |
| `/sign-in`, `/sign-up` | Organizer authentication | Sign in, register, confirm email |

## Organizer pages

| Page | Purpose | Main actions |
| --- | --- | --- |
| `/organizer` | List organizations and create one | Open an organization |
| `/organizer/[organizationId]/events` | Organization event workspace | Create or open an event; see lifecycle state |
| `/organizer/[organizationId]/events/new` | Create a draft event | Set name, description, dates, price, and result visibility |
| `/organizer/[organizationId]/events/[eventId]` | Configure one event | Add categories and nominees; preview; publish, pause, or close |

Later organizer pages include team management, event analytics, payments and reconciliation, reports, and audit history. Admin review and USSD are separate later phases.

## Main journeys

### Organizer setup

Register → confirm email → sign in → create organization → create draft event → add categories → add nominees → review event → publish. Every write checks the signed-in identity and organization role in a database function. A draft remains private to its organization until publication.

### Public discovery

Open `/events` → select a published event → browse its active categories and nominees → open a nominee profile. Public pages read through Supabase RLS and never expose payment, voter, owner, or internal organization data. Voting and checkout appear after the verified payment flow is implemented.

### Voting and payment (later phase)

Select nominee and quantity → server calculates price → create pending payment → provider confirmation → atomically record vote and ledger entries → show receipt/status. Browser input alone never confirms a payment or vote.

## Current implementation slice

The current build implements organizer draft creation and setup, lifecycle actions, private previews, private-bucket event cover and nominee image uploads, public browsing, verified-phone free voting, results visibility rules, and role-limited single-use team invitations. Invitation links are generated for managers to share manually. Paid checkout and payment confirmation, automatic invitation email delivery, member removal and role changes, reporting, admin review, and USSD are not implemented yet.
