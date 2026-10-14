import assert from 'node:assert/strict';
import { auditUssdEnvironment } from './audit-ussd-env.mjs';
const env = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://live-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-placeholder',
  SUPABASE_SECRET_KEY: 'private-placeholder',
  NEXT_PUBLIC_SITE_URL: 'https://votecasthub.example',
  USSD_ENABLED: 'true', USSD_SIMULATOR_MODE: 'false', USSD_LIVE_LAUNCH_ENABLED: 'true',
  USSD_SESSION_PROTOCOL: 'arkesel-json', USSD_PAYMENT_PROVIDER: 'paystack',
  PAYSTACK_SECRET_KEY: 'sk_live_placeholder', ARKESEL_USSD_USER_ID: 'assigned',
  ARKESEL_USSD_SERVICE_CODE: '*928*123#',
  ARKESEL_USSD_CALLBACK_TOKEN: 'a'.repeat(32),
  ARKESEL_USSD_SHARED_SECRET: 'b'.repeat(32),
};
assert(auditUssdEnvironment(env, 'production').every(check => check.ok));
for (const changed of [
  { USSD_SIMULATOR_MODE: 'true' }, { PAYSTACK_SECRET_KEY: 'sk_test_placeholder' },
  { USSD_LIVE_LAUNCH_ENABLED: undefined }, { USSD_LIVE_LAUNCH_ENABLED: 'false' },
  { NEXT_PUBLIC_SUPABASE_URL: 'https://mpajnwllttagglxnlekf.supabase.co' },
  { ARKESEL_USSD_USER_ID: '' }, { ARKESEL_USSD_SERVICE_CODE: '*928*123' },
  { USSD_SIMULATOR_EVENT_IDS: '00000000-0000-4000-8000-000000000001' },
]) assert(auditUssdEnvironment({ ...env, ...changed }, 'production').some(check => !check.ok));
const preview = { ...env, PAYSTACK_SECRET_KEY: 'sk_test_placeholder', USSD_SIMULATOR_MODE: 'true',
  ARKESEL_USSD_USER_ID: '', USSD_SIMULATOR_EVENT_IDS: '00000000-0000-4000-8000-000000000001' };
assert(auditUssdEnvironment(preview, 'preview').every(check => check.ok));
assert(auditUssdEnvironment({ ...preview, USSD_SIMULATOR_EVENT_IDS: '1000' }, 'preview').some(check => !check.ok));
assert(!JSON.stringify(auditUssdEnvironment(env, 'production')).includes('private-placeholder'));
console.log('PASS: live/preview readiness, test isolation, UUID allowlist, subscription and secret-free output');
