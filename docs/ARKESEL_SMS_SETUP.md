# Arkesel SMS setup

The application keeps Supabase responsible for generating, expiring, and verifying OTPs. Arkesel only delivers the signed SMS through the Supabase Send SMS HTTP Hook.

## Secrets

Set these server-only variables in Vercel. Do not prefix any of them with `NEXT_PUBLIC_`.

```text
ARKESEL_API_KEY=<Arkesel main SMS API key>
ARKESEL_SENDER_ID=VotecastHub
SUPABASE_SECRET_KEY=<production Supabase secret key, or service_role key if the project uses legacy keys>
SMS_DAILY_LIMIT=100
```

In Supabase Dashboard → Authentication → Hooks → Send SMS, create an HTTP hook secret and set:

```text
SUPABASE_SEND_SMS_HOOK_SECRET=<the exact v1,whsec_... value shown by Supabase>
```

The hook URL is:

```text
https://<your-production-domain>/api/auth/send-sms
```

Enable the Send SMS hook after the production deployment is live. The route verifies Supabase’s Standard Webhooks signature, rejects stale or unsigned requests, accepts only Ghanaian E.164 numbers and valid OTP shapes, and never logs OTPs or phone numbers. Arkesel’s API key is sent in the `api-key` header to `https://sms.arkesel.com/api/v2/sms/send`; it is never sent to the browser.

## Vercel dashboard

1. Open the Vercel project → Settings → Environment Variables.
2. Add each variable above, selecting **Production**. Add separate Preview values only if you have a separate test Arkesel account and Supabase project.
3. Save, then redeploy. Vercel applies environment-variable changes only to new deployments.

You can also use the CLI after linking the correct project:

```powershell
vercel env add ARKESEL_API_KEY production
vercel env add ARKESEL_SENDER_ID production
vercel env add SUPABASE_SECRET_KEY production
vercel env add SMS_DAILY_LIMIT production
```

Paste the value only when prompted. Never put these values in a Git commit, a `NEXT_PUBLIC_` variable, a client component, or a browser request. If the key was pasted into chat, a ticket, or a public log, revoke it in Arkesel and create a replacement before launch.

## Supabase production settings

In Authentication → Providers, enable Phone and SMS sign-in. In Authentication → CAPTCHA, configure Cloudflare Turnstile and set its secret key. The Vercel project needs the matching public site key as:

```text
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<Turnstile site key>
```

Configure the production SMS rate limits and OTP expiry in Supabase. Start with the database guard’s default of one request per number per minute, five per hour, ten per day, and a project-wide daily limit of 100. Adjust after observing real traffic and Arkesel balance usage.

Apply the migration before enabling the hook:

```powershell
supabase db push
```

## Acceptance test

Use a real Ghana test number on MTN, Telecel, and AirtelTigo where available. Confirm that a code arrives, an expired or reused code fails, the resend countdown prevents rapid repeats, and a verified voter can cast only the event’s allowed free votes. Also confirm that an unsigned request to the hook returns 401 and that the SMS delivery guard does not expose its table or RPCs to `anon` or `authenticated` clients.

Arkesel’s successful API response means the message was accepted for delivery; it is not proof that the handset received it. Use Arkesel’s delivery reporting for operational monitoring.

## SMS credit prices

The current approved packages are:

```text
100 credits   — GH₵20
500 credits   — GH₵80
1,000 credits — GH₵150
```
# SMS hook diagnostics

Search Vercel runtime logs for `sms_hook`. Each signed request has a non-sensitive `reference` shared by its log entries. Logs include `stage`, `elapsedMs`, HTTP status, safe database/network error codes and whether the provider accepted the send. They exclude phone numbers, verification codes, keys and raw provider bodies.

`delivery_claim_failed` identifies a database reservation failure before sending. `provider_http_error` records provider rejection; `provider_request_failed` records a network error or timeout, including `deliveryUncertain`. `receipt_write_failed` identifies failure to record the outcome after the response. A receipt failure after provider acceptance does not reject the Auth request. `completed` records the response sent to Supabase.

The synchronous flow has a 4.2-second application budget, leaving headroom within Supabase's five-second HTTP-hook window. Receipt recording runs with Next.js `after` and has a separate five-second timeout. Pending delivery reservations prevent an automatic duplicate paid send if recording fails. A provider timeout still returns failure because delivery cannot be confirmed safely.

Run `npm run test:sms-hook` for acceptance, a provider response taking more than two seconds, provider rejection, background receipt failures, duplicate guards and log privacy. Deploy the code before retesting live SMS request, OTP entry and voting. No database migration is required for this correction.

