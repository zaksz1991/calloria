import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('main application imports the adaptive customer behaviour engine', () => {
  assert.match(main, /from '\.\/digital-customer-behaviour-engine\.js'/);
});

test('agent acceptance initialises a persistent customer persona', () => {
  assert.match(main, /acceptDigitalContact\([\s\S]{0,180}ensureDigitalCustomerBehaviour\(contact\)/);
});

test('each digital agent reply updates sentiment and prepares a customer response', () => {
  assert.match(main, /evaluateDigitalCustomerReaction\(contact, result\.quality, String\(reply \|\| ''\), now\)/);
  assert.match(main, /contact\.followUpDelivered = false/);
});

test('customer follow-up action delivers the adaptive message instead of relying only on one canned line', () => {
  assert.match(main, /if \(customerBehaviour\.pendingResponse\) deliverAdaptiveDigitalCustomerResponse/);
  assert.match(main, /Receive customer response/);
});

test('agent screen displays persona, sentiment, patience and intervention recommendation', () => {
  assert.match(main, /Customer behaviour monitor/);
  assert.match(main, /Sentiment/);
  assert.match(main, /Patience/);
  assert.match(main, /request-digital-supervisor/);
});

test('digital supervisor assistance is recorded in the shared supervisor request queue', () => {
  assert.match(main, /function requestDigitalSupervisor\(contactId\)/);
  assert.match(main, /case 'request-digital-supervisor'/);
  assert.match(main, /Agent requested supervisor assistance for a digital customer interaction/);
});

test('customer persona and outcome are copied into the synthetic CRM case record', () => {
  assert.match(main, /customerSentiment: customerOutcome\.sentiment/);
  assert.match(main, /customerMood: customerOutcome\.mood/);
  assert.match(main, /customerPersona: customerOutcome\.personaLabel/);
});

test('responsive styles cover the adaptive customer behaviour monitor', () => {
  assert.match(styles, /\.digital-customer-behaviour/);
  assert.match(styles, /\.customer-mood-badge/);
  assert.match(styles, /@media\(max-width:600px\)[\s\S]*customer-behaviour-head/);
});

test('package syntax checks include the new customer behaviour engine', () => {
  assert.match(packageJson.scripts.check, /digital-customer-behaviour-engine\.js/);
});
