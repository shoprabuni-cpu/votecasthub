# Auth Turnstile token handling

The shared `AuthCaptcha` protects password sign-in, organizer registration, password-reset requests, confirmation-email resend, email OTP requests, and phone OTP requests/resends. OTP confirmation and authenticated password updates do not reuse a Turnstile token from the earlier request.

The original widget imperatively assigned a token to a hidden input with `defaultValue=""`. Hidden-input value/defaultValue reflection allowed React's parent rerender, triggered by enabling Submit, to erase that token. The widget still displayed success while the submission guard found an empty field.

The response is now a controlled React value, synchronized with the input when callbacks fire. Errors, timeouts, expiry and completed action attempts clear it; completed attempts reset the widget for a fresh single-use token. Form readiness starts enabled when no public site key is configured; existing server and Supabase CAPTCHA enforcement remain in place, including production OTP configuration checks.

Run `npm run test:auth-captcha`. It renders all six real forms in jsdom with simulated Turnstile callbacks and auth action responses. It checks actual FormData tokens, rerenders, failed-action retries, phone resend, OTP confirmation, unverified submission blocking, expiration/error/timeout handling and no-site-key readiness. No email, SMS or live authentication requests are sent.

The optional `--browser` flag uses Playwright, if installed locally or available in the Codex runtime. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an installed Chromium executable. Chromium launch timed out in the current environment; the default DOM suite passed. Live Cloudflare/Supabase behavior and production site-key/domain configuration need verification after deployment.

Targeted ESLint, `npm run typecheck` and `npm run build` also passed. This is an application deployment change; no database migration is required for the CAPTCHA fix.
