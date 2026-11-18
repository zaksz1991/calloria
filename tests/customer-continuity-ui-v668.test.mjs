import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('v6.68 continuity engine is part of the live main application and old saves migrate', () => {
  assert.match(main, /from '\.\/customer-continuity-engine\.js'/);
  assert.match(main, /customerContinuity: createCustomerContinuityState\(\)/);
  assert.match(main, /migrated\.customerContinuity = normalizeCustomerContinuityState\(migrated\.customerContinuity\)/);
  assert.match(packageJson.scripts.check, /customer-continuity-engine\.js/);
});

test('live inbound voice displays the returning-customer context panel', () => {
  assert.match(main, /renderCustomerContinuityPanel\(contact\.customer \|\| scenario\.customer, 'inbound_voice'/);
  assert.match(main, /\$\{voiceMonitor\}\$\{continuityPanel\}/);
  assert.match(main, /Customer 360 continuity/);
});

test('live digital work displays cross-channel context before the agent responds', () => {
  assert.match(main, /renderCustomerContinuityPanel\(active\.customer, active\.channel/);
  assert.match(main, /\$\{continuityPanel\}[\s\S]{0,220}<section class="panel"><div class="panel-head"><div><h3>Customer and routing/);
});

test('live outbound conversations display cross-channel context beside campaign records', () => {
  assert.match(main, /renderCustomerContinuityPanel\(task\.customer, 'outbound_voice'/);
  assert.match(main, /<aside class="call-side-stack">\$\{continuityPanel\}<section class="panel"><div class="panel-head"><div><h3>Campaign & customer record/);
});

test('inbound, outbound and digital wrap-up records update the shared customer continuity profile', () => {
  assert.match(main, /state\.cases\.push\(record\);recordCustomerContinuityFromCase\(record/);
  assert.match(main, /state\.cases\.push\(outboundCase\);recordCustomerContinuityFromCase\(outboundCase/);
  assert.match(main, /state\.cases\.push\(digitalCase\);recordCustomerContinuityFromCase\(digitalCase/);
});

test('customer continuity stores only compact case metadata and does not copy free-form notes into the continuity record', () => {
  const helper = main.slice(main.indexOf('function recordCustomerContinuityFromCase'), main.indexOf('function renderCustomerContinuityPanel'));
  assert.match(helper, /title: record\.title/);
  assert.match(helper, /status: record\.status/);
  assert.doesNotMatch(helper, /notes:|messages:|transcript:/);
});
