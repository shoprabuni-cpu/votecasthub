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
};

const mocks = {
  'server-only': {},
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
          update(val) {
            if (table === 'whatsapp_sessions') {
              for (const s of mockDbState.sessions) {
                if (this.filters.phone && s.phone === this.filters.phone) Object.assign(s, val);
                if (this.filters.id && s.id === this.filters.id) Object.assign(s, val);
              }
            }
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
            if (table === 'nominees') {
              const nom = mockDbState.nominees.find(n => n.id === query.filters.id);
              return { data: nom || null, error: null };
            }
            return { data: null, error: null };
          },
          single: async () => {
            if (table === 'events') return { data: mockDbState.event, error: null };
            if (table === 'nominees') {
              const nom = mockDbState.nominees.find(n => n.id === query.filters.id);
              return { data: nom || mockDbState.nominees[0], error: null };
            }
            return { data: null, error: null };
          },
          then(resolve) {
            if (table === 'nominees') {
              resolve({ data: mockDbState.nominees, error: null });
            } else {
              resolve({ data: null, error: null });
            }
          },
        };
        return query;
      },
      rpc: async (name, args) => {
        if (name === 'find_ussd_voter') return { data: 'user_verified_123', error: null };
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

console.log('PASS: WhatsApp parser, Rabuni/VoteCastHub central router, free vote verification, two-step paid checkout, and one-shot quick voting!');
