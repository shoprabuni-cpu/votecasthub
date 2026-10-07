# Supabase email templates

Paste each HTML file into its corresponding hosted Supabase email template and
save. Saving files here does not update the hosted project.

| Supabase template | HTML file | Subject |
| --- | --- | --- |
| Confirm signup | `confirm-signup.html` | Verify your email — VotecastHub |
| Magic Link | `voter-email-otp.html` | Your email verification code — VotecastHub |
| Reset password | `reset-password.html` | Reset your password — VotecastHub |

Confirm signup uses Supabase's Go template condition
`{{ if .Data.terms_accepted_at }}`. Organizer signup already sets this metadata
along with the accepted terms version. New voter OTP signup does not. Organizers
therefore see the confirmation button and fallback URL; first-time email voters
see only the verification code. This controls email presentation, not account
permissions or organization membership. Returning email voters use Magic Link.

After saving, test with two new addresses: an organizer signup should receive
only a confirmation link, and an email voter signup should receive only a code.
Also test a returning voter and an organizer confirmation resend. Hosted template
rendering and delivery remain unverified until these tests pass. Supabase's
generic preview may have no organizer metadata and therefore show the voter
version; use a real organizer signup to test the organizer branch.
