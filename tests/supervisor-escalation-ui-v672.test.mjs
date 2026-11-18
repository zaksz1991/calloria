import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('main application imports and normalises the supervisor escalation engine on save migration', () => {
  assert.match(main, /from '\.\/supervisor-escalation-engine\.js'/);
  assert.match(main, /migrated\.supervisorRequests\s*=\s*normalizeSupervisorRequests\(migrated\.supervisorRequests\)/);
  assert.match(main, /state\.supervisorRequests=normalizeSupervisorRequests\(state\.supervisorRequests\)/);
});

test('supervisor desk displays assigned ownership, severity and response-risk metrics', () => {
  assert.match(main, /Supervisor escalation &amp; assistance desk/);
  for (const metric of ['Unassigned', 'Critical', 'Overdue', 'Due soon', 'In progress']) assert.ok(main.includes(metric));
  assert.match(main, /supervisorEscalationMetrics\(state\.supervisorRequests,escalationNow\)/);
  assert.match(main, /supervisorEscalationCard\(item,supervisorActor,escalationNow\)/);
});

test('supervisor request workflow supports claiming, reassignment and evidence-based resolution', () => {
  assert.match(main, /data-action="claim-supervisor-escalation"/);
  assert.match(main, /data-supervisor-escalation-reassign/);
  assert.match(main, /data-supervisor-escalation-resolve/);
  assert.match(main, /claimSupervisorEscalation\(state\.supervisorRequests,requestId,actor/);
  assert.match(main, /reassignSupervisorEscalation\(state\.supervisorRequests,requestId,actor/);
  assert.match(main, /resolveSupervisorEscalation\(state\.supervisorRequests,requestId,actor/);
});

test('case and callback review closure is tied to the assigned escalation owner', () => {
  assert.match(main, /Claim this case escalation from the Supervisor desk/);
  assert.match(main, /Claim this callback escalation from the Supervisor desk/);
  assert.match(main, /closeLinkedSupervisorEscalation\(request/);
});

test('promise control blocks recovery review until the assigned supervisor owns the request', () => {
  assert.match(main, /Claim this request from the Supervisor desk before recording the recovery action/);
  assert.match(main, /closeLinkedSupervisorEscalation\(request,\{actor:reviewer,evidence:actionTaken\}/);
  assert.match(main, /data-action="open-supervisor"/);
});

test('supervisor escalation desk has responsive mobile styling', () => {
  for (const selector of ['.supervisor-escalation-desk', '.supervisor-escalation-card', '.supervisor-escalation-resolution', '.supervisor-escalation-reassign']) {
    assert.ok(styles.includes(selector), `Missing CSS selector ${selector}`);
  }
  assert.match(styles, /@media\(max-width:760px\)[\s\S]*supervisor-escalation-resolution/);
});

test('package syntax check includes the new escalation engine', () => {
  assert.match(pkg.scripts.check, /node --check js\/supervisor-escalation-engine\.js/);
});
