import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const savedEnv = { ...process.env };
const cache = new Map();
let fail = false;
const mocks = {
 '@/lib/seo/public-data': { loadSearchPages: async (offset, limit) => {
  if (fail) throw new Error('Database unavailable');
  return { total: 1001, pages: offset === 1000 ? [{ path: '/events/final-event', updated_at: '2026-10-08T10:00:00Z' }] : [{ path: '/events/a&b', updated_at: '2026-10-08T10:00:00Z' }].slice(0, limit) };
 } },
};
function load(file) {
 file = path.resolve(file);
 if (cache.has(file)) return cache.get(file).exports;
 const compiled = { exports: {} }; cache.set(file, compiled);
 const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 const localRequire = name => {
  if (mocks[name]) return mocks[name];
  if (name.startsWith('@/') || name.startsWith('.')) {
   const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(file), name);
   return load(['.ts', '.tsx'].map(ext => base + ext).find(fs.existsSync) ?? base);
  }
  return require(name);
 };
 new Function('require', 'module', 'exports', code)(localRequire, compiled, compiled.exports);
 return compiled.exports;
}
const xml = content => new JSDOM(content, { contentType: 'application/xml' }).window.document;
try {
 process.env.NEXT_PUBLIC_SITE_URL = 'https://www.votecasthub.com/';
 delete process.env.VERCEL_ENV;
 const seo = load('src/lib/seo/metadata.ts');
 const metadata = seo.publicMetadata('Nominee & event', ' A useful\n description ', '/events/test', '/api/og?event=test');
 assert.equal(metadata.alternates.canonical, 'https://www.votecasthub.com/events/test');
 assert.equal(metadata.description, 'A useful description');
 assert.equal(metadata.openGraph.images[0].url, 'https://www.votecasthub.com/api/og?event=test');
 assert.equal(metadata.twitter.card, 'summary_large_image');
 assert.ok(!seo.jsonLd({ title: '</script><script>alert(1)</script>' }).includes('<'));
 process.env.VERCEL_ENV = 'preview';
 assert.equal(seo.publicMetadata('Preview', 'Preview', '/').robots.index, false);
 assert.equal(load('src/app/robots.ts').default().rules.disallow, '/');
 delete process.env.VERCEL_ENV;
 const robots = load('src/app/robots.ts').default();
 assert.ok(robots.rules.disallow.includes('/organizer'));assert.ok(robots.rules.allow.includes('/api/og'));
 assert.equal(robots.sitemap, 'https://www.votecasthub.com/sitemap.xml');
 const { GET: index } = load('src/app/sitemap.xml/route.ts');
 const response = await index(); assert.equal(response.status, 200);
 const locations = [...xml(await response.text()).querySelectorAll('loc')].map(item => item.textContent);
 assert.deepEqual(locations, ['https://www.votecasthub.com/sitemaps/static.xml', 'https://www.votecasthub.com/sitemaps/0.xml', 'https://www.votecasthub.com/sitemaps/1.xml']);
 const { GET: shard } = load('src/app/sitemaps/[file]/route.ts');
 const request = file => shard(new Request('https://www.votecasthub.com/sitemaps/' + file), { params: Promise.resolve({ file }) });
 const staticXml = xml(await (await request('static.xml')).text());
 assert.ok([...staticXml.querySelectorAll('loc')].some(item => item.textContent.endsWith('/guides/voter-verification-and-voting-limits')));
 assert.equal(staticXml.querySelectorAll('lastmod').length, 0);
 assert.equal(xml(await (await request('0.xml')).text()).querySelector('loc').textContent, 'https://www.votecasthub.com/events/a&b');
 assert.equal(xml(await (await request('1.xml')).text()).querySelector('lastmod').textContent, '2026-10-08T10:00:00Z');
 assert.equal((await request('2.xml')).status, 404);assert.equal((await request('-1.xml')).status, 404);
 assert.equal((await request('junk.xml')).status, 404);
 fail = true;assert.equal((await index()).status, 503);assert.equal((await request('0.xml')).status, 503);
 assert.equal((await request('static.xml')).status, 200);
 console.log('PASS: Canonicals/social cards, safe JSON-LD, preview exclusion, robots, sitemap index/shards, escaped XML, true modification dates and retryable database failures.');
} finally {
 for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
 Object.assign(process.env, savedEnv);
}
