# Existing Turnstile widget

Site key: `0x4AAAAAAFOS_e-_Oy73qBmS` (public).

The shared `AuthCaptcha` component protects organizer sign-in, sign-up,
confirmation resend, password recovery, voter email-code requests, and voter
phone-code requests/resends. It loads Cloudflare's script directly, owns a single
hidden token field, rejects browser submissions without a token, clears expired
or failed challenges, and resets after completed server actions. React retains
control of submit buttons while requests are pending.

The existing server actions reject missing tokens when the site key is configured
and reject tokens longer than 2048 characters. They pass `captchaToken` to
Supabase Auth. **Supabase is the verification backend:** enable its Turnstile
provider with the matching secret. Do not redeem the token in a second Next.js
Siteverify request; Turnstile tokens are single-use, so Supabase would reject it.
This uses Supabase's supported integration rather than Spin's custom-handler
Siteverify example. Custom expected-action/hostname checks from that example are
not implemented by these server actions; restrict hostnames on the widget.

## Production configuration

1. In the existing Cloudflare widget's hostname list, allow
   `votecasthub.vercel.app` and `votecasthub.com`. Add
   `www.votecasthub.com` if forms are served there. Use a separate test widget or
   Cloudflare's official test keys for local tests when possible.
2. In Vercel's production environment, set
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAFOS_e-_Oy73qBmS` and redeploy.
   Next.js bundles public variables at build time. The local ignored `.env.local`
   and `.env.example` already contain this site key.
3. In the corresponding Supabase project, open Authentication → Bot and Abuse
   Protection, enable CAPTCHA protection, choose Turnstile, and save the existing
   widget's secret directly in the dashboard. Never put it in a public variable,
   source control, logs, or chat. No Next.js secret variable is needed here.
4. Test sign-up, sign-in, password recovery, and both OTP request flows on the
   deployed hostname. Confirm requests with no token or a malformed token fail.
   Use a fresh real token for one successful backend request, then confirm a
   replay is rejected. Confirm a failed auth attempt presents a fresh challenge
   and an expired token cannot submit.

The site key alone does not enable backend verification. Hosted configuration,
real-token acceptance, and replay rejection must be checked before claiming the
integration is active in production.

## Existing-widget secret recovery

The requested [Cloudflare Spin existing-widget flow](https://developers.cloudflare.com/turnstile/spin/prompt.md)
requires an approved canonical Wrangler executable outside this repository,
version 4.109 or later, a pinned account, an exact supported secret destination,
and explicit confirmation of a write manifest before retrieving any secret.
No Wrangler executable was available on PATH during this integration. No widget
was created, and no secret was retrieved or stored. Use the Supabase dashboard
step above to store the secret through the backend's normal secret-management
flow.

References: [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha),
[Cloudflare client rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/).
