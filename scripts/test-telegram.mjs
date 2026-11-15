import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();

// Test state
let sentTelegramMessages = [];
let sentTelegramPhotos = [];
let paystackInitCalls = [];

const mockDbState = {
  sessions: [],
  event: {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Ghana Gospel Awards 2026',
    slug: 'gospel-awards',
    voting_mode: 'paid',
    unit_price_minor: 100,
    free_vote_limit_per_phone: 1,
    verification_method: 'phone',
    starts_at: new Date(Date.now() - 3600000).toISOString(),
    ends_at: new Date(Date.now() + 86400000).toISOString(),
    status: 'published',
    image_path: null,
  },
  nominees: [
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Kwame Mensah',
      public_code: '01',
      display_order: 0,
      image_path: null,
      category_id: '00000000-0000-0000-0000-000000000003',
      categories: {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'Best Male Vocalist',
        event_id: '00000000-0000-0000-0000-000000000001',
        is_active: true,
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Akua Donkor',
      public_code: '02',
      display_order: 1,
      image_path: null,
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
  '@/lib/payments/admin': {
    paymentAdmin: () => ({
      from: (table) => {
        const query = {
          table,
          filters: {},
          select() { return this; },
          eq(col, val) { this.filters[col] = val; return this; },
          gt() { return this; },
          lte() { return this; },
          neq() { return this; },
          order() { return this; },
          limit() { return this; },
          delete() {
            if (table === 'telegram_sessions') {
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
            if (table === 'telegram_sessions') mockDbState.sessions.push(fullRow);
            return Promise.resolve({ data: fullRow, error: null });
          },
          maybeSingle: async () => {
            if (table === 'telegram_sessions') {
              const active = mockDbState.sessions.find(s =>
                (!query.filters.chat_id || s.chat_id === query.filters.chat_id) &&
                s.state !== 'completed'
              );
              return { data: active || null, error: null };
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
            if (table === 'categories') {
              return { data: mockDbState.nominees[0].categories, error: null };
            }
            return { data: null, error: null };
          },
          then(resolve) {
            if (this.updateVal && table === 'telegram_sessions') {
              for (const s of mockDbState.sessions) {
                if (this.filters.chat_id && s.chat_id !== this.filters.chat_id) continue;
                if (this.filters.id && s.id !== this.filters.id) continue;
                Object.assign(s, this.updateVal);
              }
            }
            if (table === 'nominees') {
              resolve({ data: mockDbState.nominees, error: null });
            } else if (table === 'events') {
              resolve({ data: [mockDbState.event], error: null });
            } else if (table === 'categories') {
              resolve({ data: mockDbState.categories, count: mockDbState.categories.length, error: null });
            } else {
              resolve({ data: null, error: null });
            }
          },
        };
        return query;
      },
      rpc: async (name, args) => {
        if (name === 'find_ussd_voter') return { data: 'user_tg_123', error: null };
        if (name === 'check_whatsapp_voter_eligibility') {
          return { data: { eligible: true, method: 'phone', remaining_votes: 1 }, error: null };
        }
        if (name === 'cast_verified_whatsapp_vote') {
          return { data: 'batch_uuid_tg_123', error: null };
        }
        if (name === 'reserve_paystack_whatsapp_payment') {
          return {
            data: {
              id: 'att_tg_123',
              provider_reference: `VCH-TG-${Date.now()}`,
              total_amount_minor: args.p_quantity * mockDbState.event.unit_price_minor,
              subaccount_code: 'ACCT_mock123',
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      storage: {
        from: () => ({
          createSignedUrl: async () => ({ data: { signedUrl: 'https://images.unsplash.com/test.jpg' } }),
        }),
      },
      auth: {
        admin: {
          createUser: async () => ({ data: { user: { id: 'user_tg_123' } }, error: null }),
          updateUserById: async () => ({ data: {}, error: null }),
        },
      },
    }),
  },
  '@/lib/payments/gateway': {
    paystack: async (endpoint, payload) => {
      paystackInitCalls.push({ endpoint, payload });
      if (endpoint === '/transaction/initialize') {
        return { authorization_url: 'https://checkout.paystack.com/mock-tg-auth-123' };
      }
      return {};
    },
  },
  './api': {
    sendTelegramMessage: async (chatId, text, options) => {
      sentTelegramMessages.push({ chatId, text, options });
      return { success: true, messageId: Math.floor(Math.random() * 1000) };
    },
    sendTelegramPhoto: async (chatId, photo, caption, options) => {
      sentTelegramPhotos.push({ chatId, photo, caption, options });
      sentTelegramMessages.push({ chatId, text: caption, options });
      return { success: true, messageId: Math.floor(Math.random() * 1000) };
    },
    answerTelegramCallbackQuery: async () => ({ success: true }),
    editMessageText: async () => ({ success: true }),
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
    if (name.startsWith('.') || name.startsWith('@/')) {
      const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(['.ts', '.tsx'].map((ext) => base + ext).find(fs.existsSync));
    }
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}

// 1. Test Inbound Parser
const { extractTelegramInbound } = load('src/lib/telegram/parser.ts');

const msgUpdate = {
  update_id: 100,
  message: {
    message_id: 1,
    from: { id: 98765, first_name: 'Kwame', username: 'kwamem' },
    chat: { id: 98765, type: 'private' },
    date: 1700000000,
    text: '/start event_gospel-awards',
  },
};
const parsedMsg = extractTelegramInbound(msgUpdate);
assert.equal(parsedMsg.chatId, 98765);
assert.equal(parsedMsg.userId, 98765);
assert.equal(parsedMsg.text, '/start event_gospel-awards');
assert.equal(parsedMsg.isCallback, false);

// 2. Test Voting Engine
const { processTelegramVote } = load('src/lib/telegram/engine.ts');

// Step 1: Voter opens deep link /start event_gospel-awards
await processTelegramVote(parsedMsg);
assert.equal(sentTelegramMessages.length, 1);
assert.match(sentTelegramMessages[0].text, /Candidates:/);
assert.equal(mockDbState.sessions.length, 1);
assert.equal(mockDbState.sessions[0].state, 'idle');
assert.equal(mockDbState.sessions[0].metadata?.step, 'awaiting_candidate');

// Step 1b: Verify all generated inline keyboard callback_data are <= 64 bytes (strict Telegram constraint)
const initialButtons = sentTelegramMessages[0].options?.reply_markup?.inline_keyboard || [];
for (const row of initialButtons) {
  for (const btn of row) {
    if (btn.callback_data) {
      assert.ok(
        Buffer.byteLength(btn.callback_data, 'utf8') <= 64,
        `Button callback_data "${btn.callback_data}" exceeds Telegram 64-byte limit (${Buffer.byteLength(btn.callback_data, 'utf8')} bytes)`
      );
    }
  }
}

// Step 2: Voter selects candidate 1 by typing "1"
const candidatePickMsg = {
  chatId: 98765,
  userId: 98765,
  text: '1',
  isCallback: false,
  messageId: 2,
};
await processTelegramVote(candidatePickMsg);
assert.equal(sentTelegramMessages.length, 2);
assert.match(sentTelegramMessages[1].text, /How many votes would you like to cast/);
assert.equal(mockDbState.sessions[0].state, 'awaiting_quantity');

// Step 3: Voter selects quantity 15 by tapping button
const qtyCallback = {
  chatId: 98765,
  userId: 98765,
  text: 'qty:15',
  isCallback: true,
  callbackQueryId: 'cb_qty_15',
  messageId: 3,
};
await processTelegramVote(qtyCallback);
assert.equal(paystackInitCalls.length, 1);
assert.equal(paystackInitCalls[0].payload.amount, 1500); // 15 votes * 100 pesewas
assert.match(sentTelegramMessages[2].text, /Confirm Your Vote for Kwame Mensah/);
assert.equal(sentTelegramMessages[2].options?.reply_markup?.inline_keyboard?.[0]?.[0]?.url, 'https://checkout.paystack.com/mock-tg-auth-123');

// Step 4: Test selecting candidate directly via inline button (nom:<nomineeId>)
const candidateButtonCallback = {
  chatId: 98765,
  userId: 98765,
  text: `nom:${mockDbState.nominees[1].id}`,
  isCallback: true,
  callbackQueryId: 'cb_nom_2',
  messageId: 4,
};
await processTelegramVote(candidateButtonCallback);
assert.equal(sentTelegramMessages.length, 4);
assert.match(sentTelegramMessages[3].text, /Akua Donkor/);
assert.equal(mockDbState.sessions[0].state, 'awaiting_quantity');

// Step 5: Test browsing /events and tapping event button (event:<eventId>)
const eventsCommand = {
  chatId: 98765,
  userId: 98765,
  text: '/events',
  isCallback: false,
  messageId: 5,
};
await processTelegramVote(eventsCommand);
assert.equal(sentTelegramMessages.length, 5);
const eventsButtons = sentTelegramMessages[4].options?.reply_markup?.inline_keyboard || [];
for (const row of eventsButtons) {
  for (const btn of row) {
    if (btn.callback_data) {
      assert.ok(
        Buffer.byteLength(btn.callback_data, 'utf8') <= 64,
        `Event button callback_data "${btn.callback_data}" exceeds Telegram 64-byte limit`
      );
    }
  }
}

const tapEventCallback = {
  chatId: 98765,
  userId: 98765,
  text: eventsButtons[0][0].callback_data,
  isCallback: true,
  callbackQueryId: 'cb_event_pick',
  messageId: 6,
};
await processTelegramVote(tapEventCallback);
assert.equal(sentTelegramMessages.length, 6);
assert.match(sentTelegramMessages[5].text, /Candidates:/);

// Step 6: Test multi-category event in Telegram
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

const tapMultiCatEvent = {
  chatId: 98765,
  userId: 98765,
  text: `event:${mockDbState.event.id}`,
  isCallback: true,
  callbackQueryId: 'cb_multicat_event',
  messageId: 7,
};
await processTelegramVote(tapMultiCatEvent);
assert.equal(sentTelegramMessages.length, 7);
assert.match(sentTelegramMessages[6].text, /Select a Category:/);
const catButtons = sentTelegramMessages[6].options?.reply_markup?.inline_keyboard || [];
assert.ok(catButtons.some(row => row.some(b => b.callback_data?.startsWith('cat:'))));

// Voter clicks category callback
const tapCategoryCallback = {
  chatId: 98765,
  userId: 98765,
  text: catButtons[0][0].callback_data,
  isCallback: true,
  callbackQueryId: 'cb_cat_pick',
  messageId: 8,
};
await processTelegramVote(tapCategoryCallback);
assert.equal(sentTelegramMessages.length, 8);
assert.match(sentTelegramMessages[7].text, /Candidates:/);

// Step 7: Test Photo Cards callback
mockDbState.nominees[0].image_path = 'nominee_kwame.jpg';
const tapCardsCallback = {
  chatId: 98765,
  userId: 98765,
  text: `cards:${mockDbState.categories[0].id}`,
  isCallback: true,
  callbackQueryId: 'cb_cards_pick',
  messageId: 9,
};
await processTelegramVote(tapCardsCallback);
// At least 2 messages: the photo card(s) and the navigation controls
assert.ok(sentTelegramMessages.length >= 10);
const lastMsg = sentTelegramMessages[sentTelegramMessages.length - 1];
assert.match(lastMsg.text, /Photo Cards|Tap \[🗳️ Vote\]/i);

console.log('PASS: Telegram parser, deep linking, 64-byte callback_data limits, multi-category selection, candidate photo cards, candidate button callbacks, vote packages, Paystack URL buttons, and state routing!');
