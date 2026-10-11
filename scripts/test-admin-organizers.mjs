import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";

const source = ts.transpileModule(await fs.readFile("src/lib/admin/organizers.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const saved = Object.fromEntries(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"].map(key => [key, process.env[key]]));
let authorized = true, privilegedCalls = 0;
let rpc = { data: [], error: null };
let fallback = { data: [], error: null };
const filters = [];
const supabase = { rpc: async () => rpc };
const db = { from(table) { assert.equal(table, "organizations"); return this; }, select() { return this; },
  is(...args) { filters.push(args); return this; }, order() { return this; }, limit: async () => fallback };
const module = {};
new Function("require", "exports", source)(name => {
  if (name === "server-only") return {};
  if (name === "@/lib/auth/require-platform-admin") return { requirePlatformAdmin: async () => {
    if (!authorized) throw new Error("Admin access required");
    return { supabase, userId: "admin", role: "admin" };
  } };
  if (name === "@supabase/supabase-js") return { createClient: () => { privilegedCalls++; return db; } };
  throw new Error("Unexpected import: " + name);
}, module);
try {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-server-key";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  authorized = false;
  await assert.rejects(module.loadAdminOrganizers, /Admin access required/);
  assert.equal(privilegedCalls, 0, "Unauthorized requests never use privileged credentials");
  authorized = true;
  rpc = { data: [{ id: "rpc-account" }], error: null };
  assert.equal((await module.loadAdminOrganizers()).organizers[0].id, "rpc-account");
  assert.equal(privilegedCalls, 0, "A populated RPC result needs no fallback");
  rpc = { data: [], error: null };
  fallback = { data: [{ id: "empty-account", name: "No events", moderation_status: "active", events: [{ count: 0 }], organization_paystack_accounts: null },
    { id: "paid-account", name: "Connected", moderation_status: "restricted", events: [{ count: 3 }], organization_paystack_accounts: [{ status: "active", paystack_verified: true }] }], error: null };
  const loaded = await module.loadAdminOrganizers();
  assert.equal(loaded.error, false);
  assert.equal(loaded.organizers[0].event_count, 0);
  assert.equal(loaded.organizers[0].paystack_status, "not_connected");
  assert.equal(loaded.organizers[1].paystack_verified, true);
  assert.ok(filters.some(([key, value]) => key === "events.purged_at" && value === null));
  rpc = { data: null, error: { code: "42501" } };
  assert.equal((await module.loadAdminOrganizers()).organizers.length, 2, "The fallback handles listing function errors too");
  delete process.env.SUPABASE_SECRET_KEY;
  assert.equal((await module.loadAdminOrganizers()).error, true, "Missing server credentials produce an error, not a false empty list");
  console.log("PASS: admin authorization, empty/error RPC fallback, zero-event organizers, Paystack status, deleted-event counts and missing credential diagnostics.");
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
