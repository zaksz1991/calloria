import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../public/knowledge-operations-engine.js');
const DATE = '2026-11-11';
const makeState = () => E.createInitialState(DATE);
const validArticle = (overrides = {}) => ({
  title: 'Updated customer access procedure', productId: 'general', category: 'Account & access',
  industry: 'General Customer Experience', summary: 'A practical procedure for resolving a customer access request safely.',
  steps: ['Confirm the affected service and access point.', 'Follow the approved verification and escalation process.'],
  keywords: 'access, login, account', owner: 'Knowledge Operations', reviewer: 'QA Lead', expiresAt: null, ...overrides
});

test('initial state contains the six RuffNeck services and a multi-industry support context', () => {
  const s = makeState();
  assert.equal(s.products.length, 6);
  assert.ok(s.industries.includes('General Customer Experience'));
  assert.ok(s.industries.includes('Banking (optional industry pack)'));
  assert.equal(s.articles.length, E.SEED_ARTICLES.length);
});

test('seed articles are published and use valid knowledge categories', () => {
  const s = makeState();
  assert.ok(s.articles.every((a) => a.status === 'Published'));
  assert.ok(s.articles.every((a) => E.CATEGORIES.includes(a.category)));
});

test('product catalogue includes all six named RuffNeck properties', () => {
  const names = E.PRODUCTS.map((p) => p.name);
  for (const name of ['RuffNeck LMS', 'RuffNeck Prospector', 'RuffNeck Connect', 'RuffNeck Social Hub', 'Kano Run', 'Kano Keke']) assert.ok(names.includes(name));
});

test('life and personal-development article includes non-clinical scope boundaries', () => {
  const article = E.getArticle(makeState(), 'kb-life-boundaries');
  assert.ok(article.summary.includes('not a substitute'));
  assert.ok(article.steps.some((step) => step.includes('Do not diagnose')));
});

test('Kano support article warns against inventing live telemetry', () => {
  const article = E.getArticle(makeState(), 'kb-games-player');
  assert.ok(article.steps.some((step) => step.includes('Quote player statistics only')));
});

test('published article search finds matches across title, keywords and steps', () => {
  const s = makeState();
  assert.ok(E.searchArticles(s, 'transfer', { publishedOnly: true }, DATE).some((a) => a.id === 'kb-voice-wrap'));
  assert.ok(E.searchArticles(s, 'player count', { publishedOnly: true }, DATE).some((a) => a.id === 'kb-games-player'));
});

test('article search supports product and category filters', () => {
  const s = makeState();
  const product = E.searchArticles(s, '', { productId: 'ruffneck-lms' }, DATE);
  assert.ok(product.length >= 1);
  assert.ok(product.every((a) => a.productId === 'ruffneck-lms'));
  const category = E.searchArticles(s, '', { category: 'Complaints & service recovery' }, DATE);
  assert.ok(category.every((a) => a.category === 'Complaints & service recovery'));
});

test('createArticle creates a draft and writes an activity record', () => {
  const s = makeState();
  const article = E.createArticle(s, validArticle(), DATE);
  assert.equal(article.status, 'Draft');
  assert.equal(article.version, 1);
  assert.equal(s.articles[0].id, article.id);
  assert.match(s.activity[0].text, /Draft article created/);
});

test('createArticle rejects a short title', () => {
  assert.throws(() => E.createArticle(makeState(), validArticle({ title: 'tiny' }), DATE), /title/);
});

test('createArticle rejects a missing category', () => {
  assert.throws(() => E.createArticle(makeState(), validArticle({ category: 'Not real' }), DATE), /category/);
});

test('createArticle rejects an unknown product', () => {
  assert.throws(() => E.createArticle(makeState(), validArticle({ productId: 'unknown-product' }), DATE), /product/);
});

test('createArticle requires a minimum-length summary', () => {
  assert.throws(() => E.createArticle(makeState(), validArticle({ summary: 'Too short' }), DATE), /summary/);
});

test('createArticle requires at least two actionable steps', () => {
  assert.throws(() => E.createArticle(makeState(), validArticle({ steps: ['Only one step'] }), DATE), /two actionable/);
});

test('createArticle rejects an invalid expiry date', () => {
  assert.throws(() => E.createArticle(makeState(), validArticle({ expiresAt: 'tomorrow' }), DATE), /expiry/);
});

test('article review requires a draft or changes-requested state', () => {
  const s = makeState();
  assert.throws(() => E.submitForReview(s, 'kb-general-greeting', DATE), /Only a draft/);
});

test('article lifecycle moves Draft to In Review to Published', () => {
  const s = makeState();
  const a = E.createArticle(s, validArticle(), DATE);
  E.submitForReview(s, a.id, DATE);
  assert.equal(a.status, 'In Review');
  E.publishArticle(s, a.id, 'Reviewer One', DATE);
  assert.equal(a.status, 'Published');
  assert.equal(a.reviewer, 'Reviewer One');
  assert.equal(a.publishedAt, DATE);
});

test('publishing is blocked for articles not in review', () => {
  const s = makeState();
  const a = E.createArticle(s, validArticle(), DATE);
  assert.throws(() => E.publishArticle(s, a.id, 'QA', DATE), /Only an article in review/);
});

test('requestChanges needs a useful reviewer note and moves item to Changes Requested', () => {
  const s = makeState();
  const a = E.createArticle(s, validArticle(), DATE);
  E.submitForReview(s, a.id, DATE);
  assert.throws(() => E.requestChanges(s, a.id, 'fix', 'QA', DATE), /at least eight/);
  E.requestChanges(s, a.id, 'Clarify the escalation owner and due time.', 'QA', DATE);
  assert.equal(a.status, 'Changes Requested');
  assert.equal(a.reviewer, 'QA');
});

test('returned article can be resubmitted for review', () => {
  const s = makeState();
  const a = E.createArticle(s, validArticle(), DATE);
  E.submitForReview(s, a.id, DATE);
  E.requestChanges(s, a.id, 'Add a safer verification step.', 'QA', DATE);
  E.submitForReview(s, a.id, DATE);
  assert.equal(a.status, 'In Review');
  assert.equal(a.reviewNote, '');
});

test('editing an article creates a new draft revision and preserves prior version history', () => {
  const s = makeState();
  const a = E.getArticle(s, 'kb-general-greeting');
  const updated = E.updateArticle(s, a.id, validArticle({ title: 'Revised customer greeting standard' }), DATE);
  assert.equal(updated.version, 2);
  assert.equal(updated.status, 'Draft');
  assert.equal(updated.history.length, 1);
  assert.equal(updated.history[0].version, 1);
});

test('recordUsage increments views and usage count for a published article', () => {
  const s = makeState();
  const usage = E.recordUsage(s, 'kb-general-greeting', { channel: 'Email', caseRef: 'CASE-104', employee: 'Agent A', outcome: 'Resolved' }, DATE);
  const a = E.getArticle(s, 'kb-general-greeting');
  assert.equal(a.views, 1);
  assert.equal(a.usageCount, 1);
  assert.equal(usage.caseRef, 'CASE-104');
  assert.equal(s.articleUsage.length, 1);
});

test('recordUsage rejects drafts and expired published articles', () => {
  const s = makeState();
  const a = E.createArticle(s, validArticle(), DATE);
  assert.throws(() => E.recordUsage(s, a.id, {}, DATE), /not currently published/);
  const old = E.getArticle(s, 'kb-general-greeting'); old.expiresAt = '2026-11-10';
  assert.throws(() => E.recordUsage(s, old.id, {}, DATE), /not currently published/);
});

test('article availability excludes expired content from published search', () => {
  const s = makeState();
  const a = E.getArticle(s, 'kb-general-greeting'); a.expiresAt = '2026-11-10';
  assert.equal(E.articleIsAvailable(a, DATE), false);
  assert.ok(!E.searchArticles(s, 'greeting', { publishedOnly: true }, DATE).some((x) => x.id === a.id));
});

test('createNotice validates severity, effective date and summary', () => {
  const s = makeState();
  assert.throws(() => E.createNotice(s, { title: 'Status change', summary: 'short' }, DATE), /at least 20/);
  assert.throws(() => E.createNotice(s, { title: 'Status change', summary: 'This is a valid notice summary of enough length.', effectiveAt: 'soon' }, DATE), /valid effective date/);
  const n = E.createNotice(s, { title: 'Important service change', summary: 'Agents must follow the updated service route from the effective date.', severity: 'Important' }, DATE);
  assert.equal(n.status, 'Draft');
  assert.equal(n.severity, 'Important');
});

test('publishNotice publishes an existing notice and rejects unknown IDs', () => {
  const s = makeState();
  assert.throws(() => E.publishNotice(s, 'missing', DATE), /not found/);
  const n = E.createNotice(s, { title: 'Scheduled platform notice', summary: 'Use the updated approved support procedure from today.', severity: 'Information' }, DATE);
  E.publishNotice(s, n.id, DATE);
  assert.equal(n.status, 'Published');
});

test('importBriefings imports academy sessions once and ignores cancelled records', () => {
  const s = makeState();
  const academy = { sessions: [
    { id: 'brief-1', date: DATE, time: '07:30', topic: 'New product workflow', trainer: 'Trainer', audience: 'all', summary: 'Agents should use the new workflow.' },
    { id: 'brief-2', date: DATE, time: '14:00', topic: 'Cancelled workflow', status: 'Cancelled' }
  ] };
  const first = E.importBriefings(s, academy, DATE);
  const second = E.importBriefings(s, academy, DATE);
  assert.equal(first.imported, 1);
  assert.equal(first.skipped, 1);
  assert.equal(second.imported, 0);
  assert.equal(s.notices.length, 1);
  assert.equal(s.notices[0].sourceBriefingId, 'brief-1');
});

test('importBriefings rejects missing academy session data', () => {
  assert.throws(() => E.importBriefings(makeState(), null, DATE), /not found/);
});

test('metrics count published, draft, review, expired and notice records', () => {
  const s = makeState();
  const draft = E.createArticle(s, validArticle(), DATE);
  E.submitForReview(s, draft.id, DATE);
  const expired = E.getArticle(s, 'kb-general-greeting'); expired.expiresAt = '2026-11-10';
  const notice = E.createNotice(s, { title: 'Critical service event', summary: 'A service issue is being investigated by the operations team.', severity: 'Critical' }, DATE);
  E.publishNotice(s, notice.id, DATE);
  const metrics = E.getMetrics(s, DATE);
  assert.equal(metrics.inReview, 1);
  assert.equal(metrics.expiredArticles, 1);
  assert.equal(metrics.criticalNotices, 1);
  assert.equal(metrics.drafts, 0);
});

test('exportCSV returns quoted CSV with doubled embedded quotes', () => {
  const s = makeState();
  const a = E.getArticle(s, 'kb-general-greeting'); a.title = 'Agent says "hello"';
  const csv = E.exportCSV(s);
  assert.match(csv, /"id","title","product"/);
  assert.ok(csv.includes('Agent says ""hello""'));
});

test('load and save persist the versioned state through a storage adapter', () => {
  const map = new Map();
  const storage = { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  const s = E.load(storage, DATE);
  const article = E.createArticle(s, validArticle(), DATE);
  assert.equal(E.save(s, storage), true);
  const loaded = E.load(storage, DATE);
  assert.ok(E.getArticle(loaded, article.id));
  assert.equal(loaded.version, E.VERSION);
});

test('storage failure is handled without throwing', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(E.load(blocked, DATE).articles.length, E.SEED_ARTICLES.length);
  assert.equal(E.save(makeState(), blocked), false);
});

test('page shell contains every application mount point and engine script', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../public/knowledge-operations.html', import.meta.url), 'utf8');
  for (const id of ['page-title', 'page-subtitle', 'notice', 'metrics', 'workspace', 'import-briefings', 'export-articles']) assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  assert.ok(html.includes('/knowledge-operations-engine.js'));
  assert.ok(html.includes('/knowledge-operations.js'));
});

test('briefing import key matches Learning Academy v5.1 storage contract', () => {
  assert.equal(E.ACADEMY_KEY, 'calloria.learning-academy.v51');
});
