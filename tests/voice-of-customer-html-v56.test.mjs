import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '../public/voice-of-customer.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../public/voice-of-customer.css'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../public/voice-of-customer.js'), 'utf8');

test('HTML declares mobile viewport and CALLORIA page title', () => {
  assert.match(html, /name="viewport"/);
  assert.match(html, /CALLORIA · Voice of Customer/);
});
test('HTML includes the matching stylesheet and script assets', () => {
  assert.match(html, /href="\/voice-of-customer\.css"/);
  assert.match(html, /src="\/voice-of-customer-engine\.js"/);
  assert.match(html, /src="\/voice-of-customer\.js"/);
});
test('HTML includes navigation to existing customer operations pages', () => {
  assert.match(html, /href="\/agent-workbench\.html"/);
  assert.match(html, /href="\/customer-journey\.html"/);
});
test('HTML exposes the feedback, invitation and recovery registers', () => {
  for (const id of ['feedback-list', 'feedback-detail', 'invitation-rows', 'recovery-rows']) assert.match(html, new RegExp(`id="${id}"`));
});
test('HTML exposes all score and reporting metrics', () => {
  for (const id of ['metric-responses', 'metric-csat', 'metric-satisfied', 'metric-nps', 'metric-ces', 'metric-recovery', 'nps-bars', 'theme-bars', 'channel-rows']) assert.match(html, new RegExp(`id="${id}"`));
});
test('HTML exposes completed-contact import and CSV export controls', () => {
  assert.match(html, /id="import-contacts"/);
  assert.match(html, /id="export-feedback"/);
  assert.match(html, /id="export-recovery"/);
});
test('feedback dialog contains CSAT, NPS, CES and comment fields', () => {
  for (const id of ['input-csat', 'input-nps', 'input-ces', 'input-comment']) assert.match(html, new RegExp(`id="${id}"`));
});
test('recovery dialog contains owner, status and resolution controls', () => {
  for (const id of ['recovery-owner', 'recovery-status', 'recovery-resolution']) assert.match(html, new RegExp(`id="${id}"`));
});
test('all static HTML IDs are unique', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(duplicates, []);
});
test('page JavaScript binds its required controls', () => {
  for (const id of ['import-contacts', 'feedback-form', 'recovery-form', 'new-feedback', 'feedback-search', 'feedback-filter', 'export-menu-button']) assert.ok(js.includes(`#${id}`), `Missing binding for ${id}`);
});
test('responsive stylesheet includes tablet and mobile breakpoints', () => {
  assert.match(css, /@media\s*\(max-width:\s*1200px\)/);
  assert.match(css, /@media\s*\(max-width:\s*800px\)/);
  assert.match(css, /@media\s*\(max-width:\s*540px\)/);
});
test('UI clearly states that invitations do not send external surveys', () => {
  assert.match(html, /does not send email, SMS or any external survey/);
  assert.match(html, /No outbound survey is sent/);
});
test('UI includes a privacy warning against confidential information', () => {
  assert.match(html, /Do not enter real customer secrets/);
  assert.match(html, /passwords, authentication codes/);
});
test('feedback rendering escapes untrusted text before HTML insertion', () => {
  assert.match(js, /const escapeHtml/);
  assert.ok(js.includes('escapeHtml(item.comment)'));
});

test('product selector supports the engine product id field', () => {
  assert.match(js, /row\.value !== undefined \? row\.value : row\.id/);
});
