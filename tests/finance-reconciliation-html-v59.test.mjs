import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/finance-reconciliation.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public/finance-reconciliation.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'public/finance-reconciliation-engine.js'), 'utf8');

test('finance page loads the v5.9 engine before its UI controller', () => {
  const engineAt = html.indexOf('/finance-reconciliation-engine.js');
  const appAt = html.indexOf('/finance-reconciliation.js');
  assert.ok(engineAt >= 0 && appAt > engineAt);
});

test('all static ID selectors referenced by the UI exist in the HTML', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]));
  const refs = [...app.matchAll(/\$\(['"]#([a-zA-Z0-9_-]+)['"]\)/g)].map((x) => x[1]);
  const missing = [...new Set(refs.filter((id) => !ids.has(id)))];
  assert.deepEqual(missing, []);
});

test('HTML contains no duplicate IDs', () => {
  const values = [...html.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
  assert.equal(values.length, new Set(values).size);
});

test('page exposes the required reconciliation, statement and period-close work areas', () => {
  for (const id of ['panel-overview', 'panel-statement', 'panel-matching', 'panel-close', 'panel-activity', 'statement-file', 'lines-body', 'suggestions-body', 'close-list']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('billing bridge uses the exact v5.8 storage key and never writes to billing storage', () => {
  assert.match(engine, /calloria\.billing-operations\.v58/);
  assert.match(app, /localStorage\.getItem\(E\.BILLING_KEY/);
  assert.doesNotMatch(app, /localStorage\.setItem\(E\.BILLING_KEY/);
});

test('page clearly discloses its local demonstration and bank-connection limits', () => {
  assert.match(html, /LOCAL DEMONSTRATION/);
  assert.match(html, /does not connect to banks, move money or verify bank accounts/);
  assert.match(html, /local control record/);
});

test('statement import uses a CSV-only file input', () => {
  assert.match(html, /type="file"[^>]*accept="\.csv,text\/csv"/);
});
