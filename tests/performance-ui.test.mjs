import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'performance.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/performance-workbench.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202611070011_calloria_performance_career.sql'), 'utf8');

test('performance page has unique IDs and all workbench ID references resolve', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
  const idSet = new Set(ids);
  const refs = [...js.matchAll(/\$id\('([^']+)'\)/g)].map(match => match[1]);
  const missing = [...new Set(refs)].filter(id => !idSet.has(id));
  assert.deepEqual(missing, []);
});

test('page wires its CSS and module entry points', () => {
  assert.match(html, /href="\/styles\/performance\.css"/);
  assert.match(html, /src="\/js\/performance-workbench\.js"/);
  assert.match(html, /<meta name="viewport"/);
});

test('performance is linked from Workforce and Agent Desk', () => {
  for (const file of ['workforce.html','agent-desk.html']) {
    const contents = fs.readFileSync(path.join(root,file),'utf8');
    assert.match(contents, /href="\/performance"/);
  }
});

test('migration is isolated, RLS protected and does not drop existing objects', () => {
  assert.match(migration, /calloria_perf_scorecards/);
  assert.match(migration, /calloria_perf_exam_attempts/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.%I from anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.calloria_perf_open_exam.*to service_role/is);
  assert.match(migration, /calloria_perf_finalize_review/);
  assert.doesNotMatch(migration, /\bdrop\s+(table|schema|function|trigger|policy)\b/i);
  assert.doesNotMatch(migration, /alter\s+table\s+public\.(profiles|organizations|organization_memberships)\b/i);
});

test('production build includes the new HTML page and function configuration', () => {
  const vite = fs.readFileSync(path.join(root,'vite.config.js'),'utf8');
  const config = fs.readFileSync(path.join(root,'supabase/config.toml'),'utf8');
  assert.match(vite, /performance:\s*resolve\(process\.cwd\(\), 'performance\.html'\)/);
  assert.match(config, /\[functions\.calloria-performance\]\s+verify_jwt = false/);
});
