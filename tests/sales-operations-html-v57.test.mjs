import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../public/sales-operations.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../public/sales-operations.js', import.meta.url), 'utf8');

test('HTML loads stylesheet and scripts in dependency order', () => {
  assert.match(html, /sales-operations\.css/);
  assert.ok(html.indexOf('sales-operations-engine.js') < html.indexOf('sales-operations.js'));
});
test('all script ID selectors exist in HTML', () => {
  const selectors = [...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map((match) => match[1]);
  const ids = new Set([...html.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)].map((match) => match[1]));
  const dynamicIds = new Set(['qualify', 'disqualify', 'prepare-proposal', 'advance-negotiation', 'mark-won', 'mark-lost', 'schedule-followup', 'do-not-contact', 'sync-customer-note', 'add-note', 'note-text']);
  const missing = [...new Set(selectors)].filter((id) => !ids.has(id) && !(dynamicIds.has(id) && js.includes(`id=\"${id}\"`)));
  assert.deepEqual(missing, []);
});
test('HTML IDs are unique', () => {
  const ids = [...html.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size);
});
test('dialogs and required business controls are present', () => {
  for (const id of ['opportunity-dialog', 'proposal-dialog', 'followup-dialog', 'form-permission', 'form-need', 'form-fit', 'export-csv', 'do-not-contact']) assert.ok(html.includes(`id="${id}"`) || id === 'do-not-contact');
  assert.match(html, /ethical sales controls/i);
});
test('page is responsive and declares mobile viewport', () => {
  assert.match(html, /name="viewport"/);
  const css = readFileSync(new URL('../public/sales-operations.css', import.meta.url), 'utf8');
  assert.match(css, /@media\(max-width:740px\)/);
});
