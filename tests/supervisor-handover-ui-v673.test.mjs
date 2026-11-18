import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

 test('main imports and migrates saved supervisor handovers without discarding legacy saves', () => {
  assert.match(main, /from '\.\/supervisor-handover-engine\.js'/);
  assert.match(main, /supervisorHandovers:\s*\[\]/);
  assert.match(main, /'supervisorHandovers'/);
  assert.match(main, /migrated\.supervisorHandovers\s*=\s*normalizeSupervisorHandovers\(migrated\.supervisorHandovers\)/);
});

test('Supervisor desk previews owned requests and provides create, accept and cancel handover forms', () => {
  assert.match(main, /Supervisor shift handover/);
  assert.match(main, /supervisorHandoverCandidates\(state\.supervisorRequests,state\.supervisorHandovers,supervisorActor/);
  assert.match(main, /data-supervisor-handover-create/);
  assert.match(main, /data-supervisor-handover-accept/);
  assert.match(main, /data-supervisor-handover-cancel/);
  assert.match(main, /Incoming supervisor acknowledgement/);
  assert.match(main, /incoming name is not authenticated by an enterprise identity provider/);
});

test('handover submissions call the engine and record operation timeline events', () => {
  assert.match(main, /createSupervisorHandover\(state\.supervisorRequests,state\.supervisorHandovers/);
  assert.match(main, /acceptSupervisorHandover\(state\.supervisorRequests,state\.supervisorHandovers/);
  assert.match(main, /cancelSupervisorHandover\(state\.supervisorHandovers/);
  assert.match(main, /'supervisor-handover'/);
  assert.match(main, /Ownership changes only after the named recipient accepts/);
});

test('handover interface is responsive and supports small screens', () => {
  for (const selector of ['.supervisor-handover-panel', '.supervisor-handover-compose', '.supervisor-handover-card', '.supervisor-handover-action']) {
    assert.ok(styles.includes(selector), `Missing CSS selector ${selector}`);
  }
  assert.match(styles, /@media\(max-width:760px\)[\s\S]*supervisor-handover-compose/);
});

test('package syntax check includes the new handover engine', () => {
  assert.match(pkg.scripts.check, /node --check js\/supervisor-handover-engine\.js/);
});
