import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('cloud sync is centralised as the eleventh plugin after v7.31 and before the V8 gate', () => {
  const vite = read('vite.config.js');
  const suite = read('build/calloria-workforce-development-suite-v8.mjs');
  const gate = read('build/calloria-production-integration-gate-v8.mjs');
  assert.match(suite, /import \{ calloriaWorkforceTrendCloudSyncPluginV801 \} from '\.\/calloria-workforce-trend-cloud-sync-v801\.mjs';/);
  const trendAt = suite.indexOf('calloriaWorkforceTrendHistoryPluginV731()');
  const cloudAt = suite.indexOf('calloriaWorkforceTrendCloudSyncPluginV801()');
  assert.ok(trendAt >= 0 && cloudAt > trendAt);
  assert.equal((suite.match(/calloriaWorkforceTrendCloudSyncPluginV801\(\)/g) || []).length, 1);
  assert.match(gate, /calloria-workforce-trend-cloud-sync-v8-1/);
  assert.equal((vite.match(/\.\.\.calloriaWorkforceDevelopmentSuitePluginsV8\(\)/g) || []).length, 1);
  assert.ok(vite.indexOf('calloriaProductionIntegrationGatePluginV8()') > vite.indexOf('...calloriaWorkforceDevelopmentSuitePluginsV8()'));
  assert.doesNotMatch(vite, /calloriaWorkforceTrendCloudSyncPluginV801/);
});

test('package scripts preserve v8 production audits and expose a focused cloud-history check', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.prebuild, 'node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs');
  assert.equal(pkg.scripts.build, 'vite build');
  assert.equal(pkg.scripts.postbuild, 'node tools/calloria-build-artifact-audit.mjs');
  assert.match(pkg.scripts.test, /tests\/\*\.test\.mjs/);
  assert.match(pkg.scripts['verify:workforce-cloud-history'], /workforce-trend-cloud-sync-v801/);
  assert.match(pkg.scripts['verify:workforce-cloud-history'], /workforce-trend-cloud-sync-v802\.test\.mjs/);
  assert.equal(pkg.engines.node, '22.x');
});

test('database migration scopes access, strips unapproved properties and bounds retention', () => {
  const sql = read('supabase/migrations/202611220001_calloria_workforce_trend_cloud_history.sql');
  assert.match(sql, /create table if not exists public\.calloria_workforce_trend_snapshots/);
  assert.match(sql, /public\.has_calloria_org_permission\(p_org_id, 'reports:read'\)/);
  assert.match(sql, /for select to authenticated/);
  assert.match(sql, /grant select on table public\.calloria_workforce_trend_snapshots to authenticated/);
  assert.match(sql, /grant execute on function public\.calloria_save_workforce_trend_snapshots\(uuid, jsonb\) to authenticated/);
  assert.match(sql, /revoke all on table public\.calloria_workforce_trend_snapshots from public, anon, authenticated/);
  assert.match(sql, /offset 90/);
  assert.match(sql, /calloria_normalise_workforce_trend_snapshot_v801/);
  assert.match(sql, /'workstreams'/);
  assert.match(sql, /'departments'/);
  const tableStart = sql.indexOf('create table if not exists public.calloria_workforce_trend_snapshots');
  const tableEnd = sql.indexOf('create index if not exists', tableStart);
  assert.ok(tableStart >= 0 && tableEnd > tableStart, 'snapshot table DDL is present');
  const tableDdl = sql.slice(tableStart, tableEnd);
  assert.doesNotMatch(tableDdl, /captured_by|employee_id|customer_id|transcript/i);
  assert.match(sql, /jsonb_build_object\([\s\S]*?'schemaVersion'[\s\S]*?'departments'/);
  assert.match(sql, /jsonb_typeof\(p_snapshot -> 'summary'\) is distinct from 'object'/);
  assert.doesNotMatch(sql, /create table if not exists public\.(?!calloria_)/);
  assert.doesNotMatch(sql, /service_role/i);
});


test('cloud history stylesheet defines accessible responsive controls', () => {
  const css = read('styles/calloria-workforce-trend-cloud-sync-v801.css');
  assert.match(css, /\.wth-cloud-sync/);
  assert.match(css, /\.wth-cloud-sync-buttons/);
  assert.match(css, /\.wth-cloud-status/);
  assert.match(css, /@media/);
});


test('v8.3 migration prevents last-writer-wins updates and reports timestamp conflicts', () => {
  const sql = read('supabase/migrations/202611220002_calloria_workforce_trend_conflict_guard.sql');
  assert.match(sql, /create or replace function public\.calloria_sync_workforce_trend_snapshots_v802\(/);
  assert.match(sql, /create or replace function public\.calloria_save_workforce_trend_snapshots\(/);
  assert.equal((sql.match(/on conflict \(organization_id, captured_at\) do nothing/gi) || []).length, 2);
  assert.doesNotMatch(sql, /on conflict \(organization_id, captured_at\) do update/i);
  assert.match(sql, /v_existing is distinct from v_snapshot/);
  assert.match(sql, /v_existing is not distinct from v_snapshot/);
  assert.match(sql, /'conflictCapturedAt', v_conflict_times/);
  assert.match(sql, /has_calloria_org_permission\(p_org_id, 'reports:read'\)/);
  assert.match(sql, /grant execute on function public\.calloria_sync_workforce_trend_snapshots_v802\(uuid, jsonb\) to authenticated/);
  assert.doesNotMatch(sql, /create table|alter table|drop table/i);
});
