// Read-only readiness checks. Output contains setting names, never their values.
// node --env-file=.env.local scripts/audit-ussd-env.mjs --preview
// Audit an explicitly prepared live environment with --production instead.
import { pathToFileURL } from 'node:url';

export function auditUssdEnvironment(env, target) {
  const checks = [];
  const add = (name, ok) => checks.push({ name, ok: Boolean(ok) });
  const https = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
  const present = name => typeof env[name] === 'string' && env[name].trim().length > 0;
  add('NEXT_PUBLIC_SUPABASE_URL: HTTPS', https(env.NEXT_PUBLIC_SUPABASE_URL));
  add('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: present', present('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'));
  add('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY: present', present('SUPABASE_SECRET_KEY') || present('SUPABASE_SERVICE_ROLE_KEY'));
  add('NEXT_PUBLIC_SITE_URL: HTTPS', https(env.NEXT_PUBLIC_SITE_URL));
  add('USSD_ENABLED: explicit true or false', ['true', 'false'].includes(env.USSD_ENABLED));
  if (target === 'production') {
    add('USSD_SIMULATOR_MODE: disabled', env.USSD_SIMULATOR_MODE !== 'true');
    add('USSD_SIMULATOR_EVENT_IDS: empty', !env.USSD_SIMULATOR_EVENT_IDS?.trim());
    add('Production database: not the known simulator project', !env.NEXT_PUBLIC_SUPABASE_URL?.includes('mpajnwllttagglxnlekf'));
    add('Production site: not a branch Preview URL', !env.NEXT_PUBLIC_SITE_URL?.includes('-git-'));
  }
  if (env.USSD_ENABLED === 'true') {
    if (target === 'production') add('USSD_LIVE_LAUNCH_ENABLED: enabled after provider checks', env.USSD_LIVE_LAUNCH_ENABLED === 'true');
    add('USSD_SESSION_PROTOCOL: arkesel-json', env.USSD_SESSION_PROTOCOL === 'arkesel-json');
    add('USSD_PAYMENT_PROVIDER: paystack', (env.USSD_PAYMENT_PROVIDER ?? 'paystack') === 'paystack');
    add('ARKESEL_USSD_SERVICE_CODE: complete dialing code', /^\*[0-9*]{2,30}#$/.test(env.ARKESEL_USSD_SERVICE_CODE ?? ''));
    add('ARKESEL_USSD_CALLBACK_TOKEN: at least 32 characters', (env.ARKESEL_USSD_CALLBACK_TOKEN?.length ?? 0) >= 32);
    add('ARKESEL_USSD_SHARED_SECRET: at least 32 characters', (env.ARKESEL_USSD_SHARED_SECRET?.length ?? 0) >= 32);
    add('USSD callback secrets: distinct', env.ARKESEL_USSD_CALLBACK_TOKEN !== env.ARKESEL_USSD_SHARED_SECRET);
    add('PAYSTACK_SECRET_KEY: correct environment', env.PAYSTACK_SECRET_KEY?.startsWith(target === 'production' ? 'sk_live_' : 'sk_test_'));
    if (target === 'production' || env.USSD_SIMULATOR_MODE !== 'true') add('ARKESEL_USSD_USER_ID: assigned subscription present', present('ARKESEL_USSD_USER_ID'));
    if (target === 'preview' && env.USSD_SIMULATOR_MODE === 'true') {
      const ids = (env.USSD_SIMULATOR_EVENT_IDS ?? '').split(',').map(value => value.trim());
      add('USSD_SIMULATOR_EVENT_IDS: event UUIDs configured', ids.length > 0 && ids.every(id => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)));
    }
  }
  return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv.includes('--production') ? 'production' : process.argv.includes('--preview') ? 'preview' : null;
  if (!target) {
    console.error('Choose --preview or --production. This audit does not change any setting.');
    process.exitCode = 1;
  } else {
    const checks = auditUssdEnvironment(process.env, target);
    for (const check of checks) console.log(`${check.ok ? 'PASS' : 'CHECK'}: ${check.name}`);
    console.log('Environment values checked only; dashboard scope, provider registration, webhooks, database isolation, migrations and real-phone settlement require separate verification.');
    if (checks.some(check => !check.ok)) process.exitCode = 1;
  }
}
