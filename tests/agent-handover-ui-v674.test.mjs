import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('main imports, saves and migrates agent handovers without discarding existing profile data', () => {
  assert.match(main, /from '\.\/agent-handover-engine\.js'/);
  assert.match(main, /agentHandovers:\s*\[\]/);
  assert.match(main, /'agentHandovers'/);
  assert.match(main, /migrated\.agentHandovers\s*=\s*normalizeAgentHandovers\(migrated\.agentHandovers\)/);
  assert.match(main, /state\.agentHandovers=normalizeAgentHandovers\(state\.agentHandovers\)/);
});

test('agent handover is exposed as a first-class employee operations view', () => {
  assert.match(index, /data-view="agentHandover"/);
  assert.match(main, /agentHandover:\['SHIFT CONTINUITY','Agent shift handover'/);
  assert.match(main, /case 'agentHandover': renderAgentHandover\(\)/);
});

test('agent handover UI previews digital contacts, promises and cases with outgoing ownership', () => {
  assert.match(main, /collectAgentHandoverCandidates\(resources,actor,actorId,state\.agentHandovers\)/);
  assert.match(main, /My outstanding customer work/);
  assert.match(main, /Customer callback promise/);
  assert.match(main, /Reopened case follow-up/);
  assert.match(main, /Open CRM case/);
});

test('agent handover form handlers call create, accept and cancel engine transitions', () => {
  assert.match(main, /createAgentShiftHandover\(resources,state\.agentHandovers/);
  assert.match(main, /acceptAgentShiftHandover\(agentHandoverResources\(\),state\.agentHandovers/);
  assert.match(main, /cancelAgentShiftHandover\(state\.agentHandovers/);
  assert.match(main, /data-agent-handover-create/);
  assert.match(main, /data-agent-handover-accept/);
  assert.match(main, /data-agent-handover-cancel/);
  assert.match(main, /'agent-handover'/);
});

test('UI declares local identity and active voice/outbound transfer boundaries', () => {
  assert.match(main, /not authenticated through an enterprise identity provider/);
  assert.match(main, /Active voice\/outbound calls are not interrupted or silently transferred/);
  assert.match(main, /activeInteraction\?'disabled':''/);
});

test('agent handover styles include desktop layout and phone responsiveness', () => {
  for (const selector of ['.agent-handover-overview', '.agent-handover-card', '.agent-handover-candidates', '.agent-handover-action']) {
    assert.ok(styles.includes(selector), `Missing CSS selector ${selector}`);
  }
  assert.match(styles, /@media\(max-width:760px\)[\s\S]*agent-handover-card/);
});

test('package syntax check includes the agent handover engine', () => {
  assert.match(pkg.scripts.check, /node --check js\/agent-handover-engine\.js/);
});
