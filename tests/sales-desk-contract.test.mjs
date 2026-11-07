import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../sales-desk.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../js/sales-desk-workbench.js', import.meta.url), 'utf8');
const vite = fs.readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/202611070012_calloria_sales_enablement.sql', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../supabase/functions/calloria-sales-desk/index.ts', import.meta.url), 'utf8');
const agentPage = fs.readFileSync(new URL('../agent-desk.html', import.meta.url), 'utf8');

test('every static Sales Desk DOM ID referenced by the workbench exists in the page', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const refs = new Set([...js.matchAll(/\$\(['"]#([^'"]+)['"]\)/g)].map(match => match[1]));
  const missing = [...refs].filter(id => !ids.has(id));
  assert.deepEqual(missing, []);
});

test('multi-page Vite configuration retains prior CALLORIA pages and adds Sales Desk', () => {
  for (const page of ['index.html','customer-care.html','case-desk.html','customer-360.html','agent-desk.html','workforce.html','performance.html','sales-desk.html']) {
    assert.ok(vite.includes(page), `Missing Vite page entry: ${page}`);
  }
});

test('migration creates isolated sales objects and does not mutate existing schemas', () => {
  assert.equal((migration.match(/create table if not exists public\.calloria_sales_/g) || []).length, 4);
  assert.equal(/\b(drop table|drop schema|alter table public\.(?!calloria_sales_))/i.test(migration), false);
  assert.ok(migration.includes('references public.calloria_crm_contacts'));
  assert.ok(migration.includes('references public.calloria_crm_consents'));
  assert.ok(migration.includes('marketing_consent_record_id uuid null references public.calloria_crm_consents(id) on delete cascade'));
  assert.ok(migration.includes('revoke all on public.calloria_sales_opportunities from public, anon, authenticated'));
  assert.ok(migration.includes('enable row level security'));
});

test('Edge Function validates staff JWT and gates proactive cross-sell on current marketing consent', () => {
  assert.ok(edge.includes('admin.auth.getUser(token)'));
  assert.ok(edge.includes("latestConsent(admin, row.crm_customer_id, 'marketing')"));
  assert.ok(edge.includes("consent?.status !== 'granted'"));
  assert.ok(edge.includes("row.source_type !== 'customer_requested'"));
  assert.ok(agentPage.includes('href="/sales-desk.html"'));
  assert.ok(edge.includes('CALLORIA_SALES_DESK_ACCESS'));
  assert.ok(edge.includes('CALLORIA_SALES_DESK_ENCRYPTION_SECRET'));
});

test('recommendation responses have a dedicated audit event and concurrency guard', () => {
  assert.ok(migration.includes('recommendation_responded'));
  assert.ok(edge.includes("'recommendation_responded'"));
  assert.ok(edge.includes(".eq('id', recommendationId).eq('status','presented')"));
  assert.ok(edge.includes("'recommendation_status'"));
});
