# Authentication production checklist

## Implemented in the application

- Email and password registration with server-side validation, a 12-character minimum, non-enumerating signup responses, and confirmation email callback.
- Password sign-in and sign-out using the Supabase SSR cookie client.
- Verified session checks on organizer pages and database-enforced organization membership for reads and writes.
- Safe internal post-auth redirects.
- Password reset requests use a response that does not disclose whether an address is registered.
- Users can request another signup confirmation email with a response that does not disclose whether the address has a pending account; provider errors are logged without account identifiers.
- The recovery callback exchanges its one-time code for a session. Password updates require a valid signed-in reset session, match confirmation, enforce the same 12-character minimum, and revoke refresh sessions globally.
- Expired and invalid recovery links return to the recovery page with a clear message.
- Free voters can request a Supabase SMS OTP using a Ghana E.164 number and must verify it before the database accepts a free vote. The RPC reads `auth.users.phone_confirmed_at`; a browser-supplied phone number is never trusted.

## Verification completed

- Hosted development migration history matches all six local migrations (through `20261006100000_team_invitations.sql`).
- The hosted public Auth settings endpoint reports email signup enabled, email auto-confirmation disabled (confirmation required), and no external identity providers enabled.
- A read-only linked-project config preview reports the hosted password minimum is 6 and recent reauthentication for password changes is disabled, while local policy is 12 and enabled. The hosted settings must be raised to 12 and recent reauthentication enabled. The CLI preview does not safely support applying only those fields from the current localhost-based config.
- A clean optimized production build completed. With an HTTPS-only test origin, public/auth pages returned 200 with CSP and no-store headers; anonymous requests to `/organizer` and `/reset-password` returned 307 redirects to sign-in. This verifies the route guards, not live email delivery or authenticated two-account behavior.
- Invalid confirmation and recovery callback codes were exercised locally; confirmation failures redirect to sign-in and recovery failures return to the reset request page with a clear status.
- The linked database passed 68 RLS, public visibility, direct-write denial, cross-tenant, free-vote, media-access, and team-invitation assertions in a rolled-back transaction.
- The pgTAP extension and all fixed test users, organizations, and events were created inside a rolled-back transaction; a follow-up catalog/data query confirmed none persisted.
- Security advisor findings were reviewed: six sensitive tables have RLS enabled with no policies and no direct anon/authenticated grants (deny by default). Seven callable SECURITY DEFINER RPCs have an empty search path, authenticated-only grants, and role/membership checks; the RLS suite covers these paths.
- The real email confirmation, password recovery, and two-account browser flows remain unverified until hosted SMTP and allowed callback URLs are configured.
## Required before production launch

1. **Use separate Supabase projects for development, staging, and production.** Do not link a production deployment to the development database.
2. **Set deployment environment variables** for the production Supabase URL, publishable key, and HTTPS site URL. Keep secret/service-role keys server-only and out of NEXT_PUBLIC variables.
3. **Set Supabase Auth URL Configuration** in the production project:
   - Set Site URL to the exact HTTPS website origin.
   - Allow the HTTPS auth callback URL on that domain.
   - Add only the preview URLs the team actually uses. Keep localhost redirects in the development project.
   - Never allow an untrusted wildcard host.
4. **Keep email confirmation enabled** and set the hosted minimum password length to 12 so direct Auth API requests cannot bypass the app form's validation. The linked project currently reports 6; also enable recent reauthentication for password changes (currently disabled).
5. **Configure a custom SMTP provider** for confirmation and password recovery mail. Verify sender-domain SPF and DKIM, and confirm deliverability to addresses outside the Supabase organization. Supabase's built-in sender is only for limited testing.
6. **Configure an SMS provider for Auth phone OTP** before opening free events. Set country/rate limits, OTP expiry and resend policy, and test delivery across the Ghana mobile networks expected in the pilot. Do not launch a free event until phone verification has been tested end to end.
7. **Review Auth protection settings** in the hosted project: signup/email/SMS rate limits, password reset limits, refresh-token rotation, token lifetime, secure password changes, and abuse monitoring. Add CAPTCHA before opening signup broadly; the UI must pass a provider token if CAPTCHA is enabled.
8. **Review auth email templates** and test confirmation and recovery links through the production domain. Link tracking must not rewrite the verification URL.
9. **Run the hosted acceptance checks below** using two test accounts before inviting real organizers.

The local Supabase configuration uses localhost redirect URLs and is for local development only. Do not push that local URL configuration to the production project. Configure production Site URL and redirect allowlist for the deployed HTTPS domain in the production Supabase project.

## Hosted acceptance checks

- A new address receives a confirmation email; it cannot access organizer pages before confirmation.
- The confirmation link returns to the app, creates a session, and survives a page refresh.
- A signed-out request to an organizer URL redirects to sign-in; signing out prevents new authenticated requests.
- Two accounts in separate organizations cannot read or mutate one another's organization data, even when requests are sent directly to the API.
- Password reset produces the same public response for a known and unknown address.
- A valid reset email opens the reset form; invalid, reused, and expired links cannot update a password.
- Short passwords and mismatched confirmation are rejected. A successful reset revokes refresh sessions, and the new password works while the old password fails.
- Confirmation and recovery email delivery succeeds from the production domain and all redirects stay on that domain.
- A voter receives and verifies an SMS OTP; expired/reused codes and repeated requests are limited; an unverified user cannot cast free votes.

A global sign-out revokes refresh sessions. Already-issued access tokens may remain usable until their short JWT expiry, so keep token lifetime bounded and enforce sensitive access through database RLS and role checks.

## Remaining product security decisions

- Enforce multi-factor authentication for privileged organizer/admin accounts before enabling sensitive financial or platform administration.
- Add an app-level CAPTCHA widget and token plumbing before high-volume public organizer signup if hosted Auth CAPTCHA protection is enabled.
- Add support and recovery procedures for email delivery failures and compromised accounts.
