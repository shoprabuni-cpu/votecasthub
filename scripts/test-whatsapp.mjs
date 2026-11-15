import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();

// Test state
let sentMessages = [];
let forwardedToRabuni = [];
let dbVotesCast = [];
let paystackInitCalls = [];

const mockDbState = {
  sessions: [],
  event: {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Ghana Gospel Awards 2026',
    slug: 'gospel-awards',
    voting_mode: 'free',
    unit_price_minor: 100,
    free_vote_limit_per_phone: 1,
    verification_method: 'phone',
    starts_at: new Date(Date.now() - 3600000).toISOString(),
    ends_at: new Date(Date.now() + 86400000).toISOString(),
    status: 'published',
  },
  nominees: [
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Kwame Mensah',
      public_code: '01',
      display_order: 0,
      category_id: '00000000-0000-0000-0000-000000000003',
      categories: {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Best Male Vocalist',
        event_id: '00000000-0000-0000-0000-000000000001',
        is_active: true,
      },
    },
  ],
  categories: [
    {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Best Male Vocalist',
      event_id: '00000000-0000-0000-0000-000000000001',
      display_order: 0,
      is_active: true,
    },
  ],
};

const mocks = {
  'server-only': {},
  '@supabase/supabase-js': {
    createClient: () => ({
      auth: {
        signInWithOtp: async ({ email }) => {
          mockDbState.emailOtpSentTo = email;
          return { data: {}, error: null };
        },
        verifyOtp: async ({ email, token }) => {
          if (token === '123456') {
            mockDbState.emailOtpVerified = true;
            return { data: { user: { id: 'user_verified_123', email } }, error: null };
          }
          return { data: null, error: new Error('Invalid code') };
        },
      },
    }),
  },
  '@/lib/payments/admin': {
    paymentAdmin: () => ({
      from: (table) => {
        const query = {
          table,
          filters: {},
          select() { return this; },
          eq(col, val) { this.filters[col] = val; return this; },
          gt() { return this; },
          neq() { return this; },
          or() { return this; },
          order() { return this; },
          limit() { return this; },
          delete() {
            if (table === 'whatsapp_sessions') {
              mockDbState.sessions = mockDbState.sessions.filter(s => s.state === 'completed');
            }
            return this;
          },
          update(val) {
            this.updateVal = val;
            return this;
          },
          insert(val) {
            const row = Array.isArray(val) ? val[0] : val;
            const fullRow = { id: `sess_${Date.now()}`, ...row };
            if (table === 'whatsapp_sessions') mockDbState.sessions.push(fullRow);
            return Promise.resolve({ data: fullRow, error: null });
          },
          maybeSingle: async () => {
            if (table === 'whatsapp_sessions') {
              const active = mockDbState.sessions.find(s =>
                (!query.filters.phone || s.phone === query.filters.phone) &&
                (!query.filters.reference || s.reference === query.filters.reference) &&
                s.state !== 'completed'
              );
              return { data: active || null, error: null };
            }
            if (table === 'event_ussd_requests') {
              if (query.filters.event_code === 1000) {
                return { data: { event_id: mockDbState.event.id, event_code: 1000 }, error: null };
              }
              return { data: null, error: null };
            }
            if (table === 'events') {
              return { data: mockDbState.event, error: null };
            }
            if (table === 'event_voter_list_entries') {
              if (query.filters.identifier_type === 'email' && mockDbState.rosterEmail) {
                return {
                  data: {
                    id: 'entry_email_123',
                    label: 'Prof. Kwame (kwame@knust.edu.gh)',
                    redeemed_by: null,
                  },
                  error: null,
                };
              }
              return { data: null, error: null };
            }
            if (table === 'nominees') {
              const nom = mockDbState.nominees.find(n => n.id === query.filters.id);
              return { data: nom || null, error: null };
            }
            return { data: null, error: null };
          },
          single: async () => {
            if (table === 'events') return { data: mockDbState.event, error: null };
            if (table === 'categories') return { data: mockDbState.categories[0], error: null };
            if (table === 'nominees') {
              const nom = mockDbState.nominees.find(n => n.id === query.filters.id);
              return { data: nom || mockDbState.nominees[0], error: null };
            }
            return { data: null, error: null };
          },
          then(resolve) {
            if (this.updateVal && table === 'whatsapp_sessions') {
              for (const s of mockDbState.sessions) {
                if (this.filters.phone && s.phone !== this.filters.phone) continue;
                if (this.filters.id && s.id !== this.filters.id) continue;
                Object.assign(s, this.updateVal);
              }
            }
            if (table === 'nominees') {
              resolve({ data: mockDbState.nominees, error: null });
            } else if (table === 'categories') {
              resolve({ data: mockDbState.categories, error: null });
            } else if (table === 'events') {
              resolve({ data: [mockDbState.event], error: null });
            } else {
              resolve({ data: null, error: null });
            }
          },
        };
        return query;
      },
      rpc: async (name, args) => {
        if (name === 'find_ussd_voter') return { data: 'user_verified_123', error: null };
        if (name === 'check_whatsapp_voter_eligibility') {
          if (mockDbState.event.verification_method === 'invite_code') {
            return { data: { eligible: mockDbState.inviteCodeVerified || false, method: 'invite_code', reason: 'requires_invite_code' }, error: null };
          }
          if (mockDbState.event.verification_method === 'voter_list') {
            if (mockDbState.voterListVerified) {
              return { data: { eligible: true, method: 'voter_list', remaining_votes: 1 }, error: null };
            }
            if (mockDbState.phoneOnRoster) {
              mockDbState.voterListVerified = true;
              return { data: { eligible: true, method: 'voter_list', auto_redeemed_phone: true, remaining_votes: 1 }, error: null };
            }
            return { data: { eligible: false, method: 'voter_list', reason: 'requires_identifier' }, error: null };
          }
          return { data: { eligible: true, method: 'phone' }, error: null };
        }
        if (name === 'redeem_whatsapp_access_code') {
          if (args.p_code === 'VIP-8492') {
            mockDbState.inviteCodeVerified = true;
            return { data: { success: true }, error: null };
          }
          return { data: { success: false, error: 'Invalid access code. Please check and try again.' }, error: null };
        }
        if (name === 'redeem_whatsapp_voter_id') {
          if (args.p_identifier === '10892341' || args.p_identifier === 'kwame@knust.edu.gh') {
            mockDbState.voterListVerified = true;
            return { data: { success: true, label: args.p_identifier === 'kwame@knust.edu.gh' ? 'Prof. Kwame (kwame@knust.edu.gh)' : 'Kwame Mensah (10892341)', max_votes: 1, used_votes: 0 }, error: null };
          }
          if (args.p_identifier === '10894500') {
            if (!args.p_claim_code) {
              return { data: { success: false, requires_claim_code: true, label: 'Akua Donkor (10894500)' }, error: null };
            }
            if (args.p_claim_code === '4821') {
              mockDbState.voterListVerified = true;
              return { data: { success: true, label: 'Akua Donkor (10894500)', max_votes: 1, used_votes: 0 }, error: null };
            }
            return { data: { success: false, error: 'Incorrect voting PIN / claim code.' }, error: null };
          }
          return { data: { success: false, error: 'Identifier not found on the approved voter roll.' }, error: null };
        }
        if (name === 'cast_verified_whatsapp_vote') {
          dbVotesCast.push(args);
          return { data: 'batch_uuid_123', error: null };
        }
        if (name === 'reserve_paystack_whatsapp_payment') {
          return {
            data: {
              id: 'att_123',
              provider_reference: `VCH-WA-${Date.now()}`,
              total_amount_minor: args.p_quantity * mockDbState.event.unit_price_minor,
              subaccount_code: 'ACCT_mock123',
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      auth: {
        admin: {
          createUser: async () => ({ data: { user: { id: 'user_created_123' } }, error: null }),
        },
      },
    }),
  },
  '@/lib/payments/gateway': {
    paystack: async (endpoint, payload) => {
      paystackInitCalls.push({ endpoint, payload });
      if (endpoint === '/transaction/initialize') {
        return { authorization_url: 'https://checkout.paystack.com/mock-auth-code-123' };
      }
      return {};
    },
  },
  '@/lib/whatsapp/sendazi': {
    normalizePhone: (p) => {
      const digits = p.replace(/\D/g, '');
      if (digits.startsWith('233') && digits.length === 12) return digits;
      if (digits.startsWith('0') && digits.length === 10) return `233${digits.slice(1)}`;
      return digits;
    },
    sendWhatsAppMessage: async (to, msg) => {
      sentMessages.push({ to, msg });
      return { success: true };
    },
    sendWhatsAppImage: async (to, url, caption) => {
      sentMessages.push({ to, msg: caption || url, isImage: true });
      return { success: true };
    },
    sendWhatsAppInteractiveButtons: async (to, header, body, buttons) => {
      sentMessages.push({ to, msg: `${header}\n${body}`, buttons });
      return { success: true };
    },
    sendWhatsAppInteractiveList: async (to, header, body, label, sections) => {
      sentMessages.push({ to, msg: `${header}\n${body}`, sections });
      return { success: true };
    },
  },
};

function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)((name) => {
    if (mocks[name]) return mocks[name];
    if (name === './sendazi' || name.endsWith('/sendazi')) return mocks['@/lib/whatsapp/sendazi'];
    if (name.startsWith('.') || name.startsWith('@/')) {
      const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(['.ts', '.tsx'].map((ext) => base + ext).find(fs.existsSync));
    }
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}

// 1. Test Inbound Parser
const { extractInboundMessage } = load('src/lib/whatsapp/parser.ts');
const { normalizePhone } = load('src/lib/whatsapp/sendazi.ts');

assert.equal(normalizePhone('0245259221'), '233245259221');
assert.equal(normalizePhone('+233245259221'), '233245259221');
assert.equal(normalizePhone('233245259221'), '233245259221');

// Sendazi simple payload
const sendaziMsg = extractInboundMessage({ phone: '0245259221', message: 'VOTE 1000 01' });
assert(sendaziMsg);
assert.equal(sendaziMsg.phone, '233245259221');
assert.equal(sendaziMsg.text, 'VOTE 1000 01');

// Meta Cloud API format
const metaMsg = extractInboundMessage({
  entry: [{
    changes: [{
      value: {
        messages: [{
          from: '233592992566',
          type: 'text',
          text: { body: 'VOTE gospel 01' },
        }],
      },
    }],
  }],
});
assert(metaMsg);
assert.equal(metaMsg.phone, '233592992566');
assert.equal(metaMsg.text, 'VOTE gospel 01');

// 2. Test Central Router Logic (VoteCastHub vs Rabuni Shops)
const { isVotingKeyword, routeInboundMessage } = load('src/lib/whatsapp/router.ts');

assert.equal(isVotingKeyword('VOTE 1000 01'), true);
assert.equal(isVotingKeyword('vch gospel 01'), true);
assert.equal(isVotingKeyword('ballot 1000'), true);
assert.equal(isVotingKeyword('Hello, how much for the red bag?'), false);
assert.equal(isVotingKeyword('Hi'), false);

const rabuniMsg = { phone: '233201112233', text: 'Where is your shop located?', rawPayload: {} };
const rabuniRoute = await routeInboundMessage(rabuniMsg, JSON.stringify(rabuniMsg), new Headers());
assert.equal(rabuniRoute, 'rabuni');

const voteRoute = await routeInboundMessage(sendaziMsg, JSON.stringify(sendaziMsg), new Headers());
assert.equal(voteRoute, 'votecasthub');

// 3. Test Free Vote Execution
const { processWhatsAppVote } = load('src/lib/whatsapp/engine.ts');

mockDbState.event.voting_mode = 'free';
sentMessages = [];
dbVotesCast = [];

await processWhatsAppVote(sendaziMsg);
assert.equal(dbVotesCast.length, 1);
assert.equal(dbVotesCast[0].p_nominee, mockDbState.nominees[0].id);
assert.equal(sentMessages.length, 1);
assert.match(sentMessages[0].msg, /Vote Cast Successfully/i);

// 4. Test Paid Vote Execution (Two-step flow: prompt for quantity then payment link)
mockDbState.event.voting_mode = 'paid';
mockDbState.sessions = [];
sentMessages = [];
paystackInitCalls = [];

// Step 1: Voter sends VOTE 1000 01
await processWhatsAppVote(sendaziMsg);
assert.equal(sentMessages.length, 1);
assert.match(sentMessages[0].msg, /How many votes would you like to cast/i);
assert.equal(mockDbState.sessions.length, 1);
assert.equal(mockDbState.sessions[0].state, 'awaiting_quantity');

// Step 2: Voter replies with quantity '10'
const qtyMsg = { phone: '233245259221', text: '10', rawPayload: {} };
await processWhatsAppVote(qtyMsg);
assert.equal(paystackInitCalls.length, 1);
assert.equal(paystackInitCalls[0].payload.amount, 1000); // 10 votes * 100 pesewas
assert.equal(sentMessages.length, 2);
assert.match(sentMessages[1].msg, /checkout\.paystack\.com/);
assert.match(sentMessages[1].msg, /GH₵10\.00/);

// 5. One-Shot Quick Vote (VOTE 1000 01 20)
sentMessages = [];
paystackInitCalls = [];
const quickVoteMsg = { phone: '233245259221', text: 'VOTE 1000 01 20', rawPayload: {} };
await processWhatsAppVote(quickVoteMsg);
assert.equal(paystackInitCalls.length, 1);
assert.equal(paystackInitCalls[0].payload.amount, 2000); // 20 votes * 100 pesewas
assert.match(sentMessages[0].msg, /GH₵20\.00/);

// 6. Test Free Vote with Private 1-Time Invite Code
mockDbState.event.voting_mode = 'free';
mockDbState.event.verification_method = 'invite_code';
mockDbState.inviteCodeVerified = false;
mockDbState.sessions = [];
sentMessages = [];
dbVotesCast = [];

// Step 1: Voter attempts to vote without an invite code
const inviteVoteMsg = { phone: '233245259221', text: 'VOTE 1000 01', rawPayload: {} };
await processWhatsAppVote(inviteVoteMsg);
assert.equal(dbVotesCast.length, 0); // No vote cast yet
assert.equal(sentMessages.length, 1);
assert.match(sentMessages[0].msg, /Access Code Required/i);
assert.equal(mockDbState.sessions.length, 1);
assert.equal(mockDbState.sessions[0].state, 'awaiting_invite_code');

// Step 2: Voter replies with an invalid invite code
const badCodeMsg = { phone: '233245259221', text: 'BAD-CODE-99', rawPayload: {} };
await processWhatsAppVote(badCodeMsg);
assert.equal(dbVotesCast.length, 0); // Still no vote
assert.equal(sentMessages.length, 2);
assert.match(sentMessages[1].msg, /Invalid access code/i);
assert.equal(mockDbState.sessions[0].state, 'awaiting_invite_code'); // Session preserved

// Step 3: Voter replies with valid invite code 'VIP-8492'
const goodCodeMsg = { phone: '233245259221', text: 'VIP-8492', rawPayload: {} };
await processWhatsAppVote(goodCodeMsg);
assert.equal(dbVotesCast.length, 1); // Vote successfully auto-cast!
assert.equal(dbVotesCast[0].p_nominee, mockDbState.nominees[0].id);
assert.equal(sentMessages.length, 3);
assert.match(sentMessages[2].msg, /Invite Code Verified/i);
assert.equal(mockDbState.sessions[0].state, 'completed');

// 7. Test Voter-List with Phone Roster Auto-matching (Zero typing)
mockDbState.event.voting_mode = 'free';
mockDbState.event.verification_method = 'voter_list';
mockDbState.voterListVerified = false;
mockDbState.phoneOnRoster = true;
mockDbState.sessions = [];
sentMessages = [];
dbVotesCast = [];

const phoneRosterMsg = { phone: '233245259221', text: 'VOTE 1000 01', rawPayload: {} };
await processWhatsAppVote(phoneRosterMsg);
assert.equal(dbVotesCast.length, 1); // Auto-redeemed and vote cast immediately!
assert.equal(sentMessages.length, 1);
assert.match(sentMessages[0].msg, /Vote Cast Successfully/i);

// 8. Test Voter-List with Student ID (Non-phone roster without PIN)
mockDbState.event.voting_mode = 'free';
mockDbState.event.verification_method = 'voter_list';
mockDbState.voterListVerified = false;
mockDbState.phoneOnRoster = false;
mockDbState.sessions = [];
sentMessages = [];
dbVotesCast = [];

// Step 1: Voter attempts to vote; not on phone roster -> bot asks for Student ID
const studentVoteMsg = { phone: '233245259221', text: 'VOTE 1000 01', rawPayload: {} };
await processWhatsAppVote(studentVoteMsg);
assert.equal(dbVotesCast.length, 0);
assert.equal(sentMessages.length, 1);
assert.match(sentMessages[0].msg, /Voter Roll Verification/i);
assert.equal(mockDbState.sessions.length, 1);
assert.equal(mockDbState.sessions[0].state, 'awaiting_voter_id');

// Step 2: Voter replies with bad Student ID
const badStudentIdMsg = { phone: '233245259221', text: '99999999', rawPayload: {} };
await processWhatsAppVote(badStudentIdMsg);
assert.equal(dbVotesCast.length, 0);
assert.equal(sentMessages.length, 2);
assert.match(sentMessages[1].msg, /Identifier not found/i);
assert.equal(mockDbState.sessions[0].state, 'awaiting_voter_id');

// Step 3: Voter replies with valid Student ID '10892341'
const goodStudentIdMsg = { phone: '233245259221', text: '10892341', rawPayload: {} };
await processWhatsAppVote(goodStudentIdMsg);
assert.equal(dbVotesCast.length, 1);
assert.equal(sentMessages.length, 3);
assert.match(sentMessages[2].msg, /Voter Identity Verified/i);
assert.match(sentMessages[2].msg, /Kwame Mensah/i);
assert.equal(mockDbState.sessions[0].state, 'completed');

// 9. Test Voter-List with Student ID + Secret Voting PIN / Claim Code
mockDbState.event.voting_mode = 'free';
mockDbState.event.verification_method = 'voter_list';
mockDbState.voterListVerified = false;
mockDbState.phoneOnRoster = false;
mockDbState.sessions = [];
sentMessages = [];
dbVotesCast = [];

// Step 1: Initial vote attempt
await processWhatsAppVote(studentVoteMsg);
assert.equal(mockDbState.sessions[0].state, 'awaiting_voter_id');

// Step 2: Voter enters ID '10894500' which requires a secret PIN
const idWithPinMsg = { phone: '233245259221', text: '10894500', rawPayload: {} };
await processWhatsAppVote(idWithPinMsg);
assert.equal(dbVotesCast.length, 0);
assert.equal(sentMessages.length, 2);
assert.match(sentMessages[1].msg, /Voting PIN Required/i);
assert.equal(mockDbState.sessions[0].state, 'awaiting_claim_code');

// Step 3: Voter enters incorrect PIN
const badPinMsg = { phone: '233245259221', text: '0000', rawPayload: {} };
await processWhatsAppVote(badPinMsg);
assert.equal(dbVotesCast.length, 0);
assert.equal(sentMessages.length, 3);
assert.match(sentMessages[2].msg, /Incorrect voting PIN/i);
assert.equal(mockDbState.sessions[0].state, 'awaiting_claim_code');

// Step 4: Voter enters correct PIN '4821'
const goodPinMsg = { phone: '233245259221', text: '4821', rawPayload: {} };
await processWhatsAppVote(goodPinMsg);
assert.equal(dbVotesCast.length, 1);
assert.equal(sentMessages.length, 4);
assert.match(sentMessages[3].msg, /Voter PIN Confirmed/i);
assert.match(sentMessages[3].msg, /Akua Donkor/i);
assert.equal(mockDbState.sessions[0].state, 'completed');

// 10. Test Voter-List with Institutional Email OTP Verification
mockDbState.event.voting_mode = 'free';
mockDbState.event.verification_method = 'voter_list';
mockDbState.voterListVerified = false;
mockDbState.phoneOnRoster = false;
mockDbState.rosterEmail = true;
mockDbState.emailOtpVerified = false;
mockDbState.sessions = [];
sentMessages = [];
dbVotesCast = [];

// Step 1: Initial vote attempt -> prompts for voter roll ID
const emailVoteMsg = { phone: '233245259221', text: 'VOTE 1000 01', rawPayload: {} };
await processWhatsAppVote(emailVoteMsg);
assert.equal(dbVotesCast.length, 0);
assert.equal(sentMessages.length, 1);
assert.match(sentMessages[0].msg, /Voter Roll Verification/i);
assert.equal(mockDbState.sessions[0].state, 'awaiting_voter_id');

// Step 2: Voter replies with institutional email 'kwame@knust.edu.gh'
const emailMsg = { phone: '233245259221', text: 'kwame@knust.edu.gh', rawPayload: {} };
await processWhatsAppVote(emailMsg);
assert.equal(mockDbState.emailOtpSentTo, 'kwame@knust.edu.gh');
assert.equal(sentMessages.length, 2);
assert.match(sentMessages[1].msg, /Verification Code Sent/i);
assert.equal(mockDbState.sessions[0].state, 'awaiting_email_otp');

// Step 3: Voter replies with invalid OTP code
const badOtpMsg = { phone: '233245259221', text: '999999', rawPayload: {} };
await processWhatsAppVote(badOtpMsg);
assert.equal(dbVotesCast.length, 0);
assert.equal(sentMessages.length, 3);
assert.match(sentMessages[2].msg, /invalid or has expired/i);
assert.equal(mockDbState.sessions[0].state, 'awaiting_email_otp');

// Step 4: Voter replies with correct OTP '123456'
const goodOtpMsg = { phone: '233245259221', text: '123456', rawPayload: {} };
await processWhatsAppVote(goodOtpMsg);
assert.equal(dbVotesCast.length, 1);
assert.equal(sentMessages.length, 4);
assert.match(sentMessages[3].msg, /Email Verified & Vote Recorded/i);
assert.match(sentMessages[3].msg, /kwame@knust\.edu\.gh/i);
assert.equal(mockDbState.sessions[0].state, 'completed');

// 11. Test Multi-Category Selection Flow
mockDbState.categories = [
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Best Male Vocalist',
    event_id: '00000000-0000-0000-0000-000000000001',
    display_order: 0,
    is_active: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Best Female Vocalist',
    event_id: '00000000-0000-0000-0000-000000000001',
    display_order: 1,
    is_active: true,
  },
];
mockDbState.event.voting_mode = 'free';
mockDbState.event.verification_method = 'phone';
mockDbState.sessions = [];
sentMessages = [];
dbVotesCast = [];

// Step 1: Voter initiates vote with event slug only (no nominee code)
const browseEventMsg = { phone: '233245259221', text: 'VOTE gospel-awards', rawPayload: {} };
await processWhatsAppVote(browseEventMsg);
assert.equal(sentMessages.length, 1);
assert.match(sentMessages[0].msg, /Categories:/i);
assert.match(sentMessages[0].msg, /Best Male Vocalist/i);
assert.equal(mockDbState.sessions.length, 1);
assert.equal(mockDbState.sessions[0].metadata?.step, 'awaiting_category');

// Step 2: Voter replies with category choice '1'
const pickCategoryMsg = { phone: '233245259221', text: '1', rawPayload: {} };
await processWhatsAppVote(pickCategoryMsg);
assert.equal(sentMessages.length, 2);
assert.match(sentMessages[1].msg, /Candidates:/i);
assert.equal(mockDbState.sessions[0].metadata?.step, 'awaiting_candidate');

// Step 3: Voter selects candidate '1'
const pickNomineeMsg = { phone: '233245259221', text: '1', rawPayload: {} };
await processWhatsAppVote(pickNomineeMsg);
assert.equal(dbVotesCast.length, 1);
assert.equal(sentMessages.length, 3);
assert.match(sentMessages[2].msg, /Vote Cast Successfully/i);

// 12. Test Candidate Photo Cards in WhatsApp
mockDbState.nominees[0].image_path = 'nominee_kwame.jpg';
mockDbState.sessions = [];
sentMessages = [];
dbVotesCast = [];

// Voter navigates to category with photo-enabled contestants
const browseCatWithPhotosMsg = { phone: '233245259221', text: `CAT ${mockDbState.event.id} ${mockDbState.categories[0].id}`, rawPayload: {} };
await processWhatsAppVote(browseCatWithPhotosMsg);
assert.equal(sentMessages.length, 1);
assert.match(sentMessages[0].msg, /Kwame Mensah/i);
assert.match(sentMessages[0].msg, /Tap the button below to vote/i);

console.log('PASS: WhatsApp parser, router, category selection, nominee photo cards, free votes, paid checkout, quick vote, invite code, phone roster auto-match, student ID, voting PIN, and institutional email OTP verification!');
