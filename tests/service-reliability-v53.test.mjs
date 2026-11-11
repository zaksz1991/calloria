import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../public/service-reliability-engine.js');

const T0 = '2026-11-11T08:00:00.000Z';
const later = (minutes) => new Date(Date.parse(T0) + minutes * 60000).toISOString();
function validIncident(overrides = {}) {
  return {
    title: 'Learning platform enrolment interruption', productId: 'ruffneck-lms', severity: 'SEV 2 - High',
    category: 'Service degradation', summary: 'Customers are receiving a failure when submitting course enrolment requests and cannot complete the enrolment flow.',
    impact: 'Some customers cannot join learning programmes until the enrolment request succeeds.', estimatedCustomers: 125,
    channels: ['Voice', 'Email'], owner: 'Incident Lead', reporter: 'Service Desk', customerSummary: 'We are investigating an enrolment issue affecting some RuffNeck LMS customers. Further updates will be provided as facts are confirmed.',
    ...overrides
  };
}
function MemoryStorage(initial = {}) {
  this.data = new Map(Object.entries(initial));
  this.getItem = (key) => this.data.has(key) ? this.data.get(key) : null;
  this.setItem = (key, value) => this.data.set(key, String(value));
}
function driveToMonitoring(state, incident, at = T0) {
  E.acknowledgeIncident(state, incident.id, 'Lead Engineer', at);
  E.transitionIncident(state, incident.id, 'Investigating', '', at);
  E.transitionIncident(state, incident.id, 'Mitigating', '', at);
  E.transitionIncident(state, incident.id, 'Monitoring', '', at);
}

test('initial state has empty operational registers and correct version', () => {
  const state = E.createInitialState();
  assert.equal(state.version, '5.3.0');
  assert.deepEqual(state.incidents, []);
  assert.deepEqual(state.maintenance, []);
  assert.equal(E.getMetrics(state).active, 0);
});

test('normalisation safely restores known arrays and integration metadata', () => {
  const state = E.normaliseState({ incidents: [{ id: 'INC-1' }], activity: 'invalid', integration: { noticePushes: 4 } });
  assert.equal(state.incidents.length, 1);
  assert.deepEqual(state.activity, []);
  assert.equal(state.integration.noticePushes, 4);
});

test('local storage save and load round trip', () => {
  const storage = new MemoryStorage();
  const state = E.createInitialState();
  const incident = E.createIncident(state, validIncident(), T0);
  assert.equal(E.save(state, storage), true);
  const loaded = E.load(storage);
  assert.equal(loaded.incidents[0].id, incident.id);
  assert.equal(loaded.incidents[0].reference, incident.reference);
});

test('incident validation rejects short titles and summaries', () => {
  assert.throws(() => E.createIncident(E.createInitialState(), validIncident({ title: 'bad' }), T0), /title/);
  assert.throws(() => E.createIncident(E.createInitialState(), validIncident({ summary: 'too short' }), T0), /40 characters/);
});

test('incident validation rejects unknown products and severities', () => {
  assert.throws(() => E.createIncident(E.createInitialState(), validIncident({ productId: 'finacle' }), T0), /product/);
  assert.throws(() => E.createIncident(E.createInitialState(), validIncident({ severity: 'Urgent' }), T0), /severity/);
});

test('incident validation requires a valid channel and integer impact estimate', () => {
  assert.throws(() => E.createIncident(E.createInitialState(), validIncident({ channels: [] }), T0), /channel/);
  assert.throws(() => E.createIncident(E.createInitialState(), validIncident({ estimatedCustomers: 1.5 }), T0), /whole number/);
});

test('create incident stores reference, owner, channels and initial timeline', () => {
  const state = E.createInitialState();
  const incident = E.createIncident(state, validIncident(), T0);
  assert.match(incident.reference, /^INC-2026-\d{6}$/);
  assert.equal(incident.status, 'Detected');
  assert.equal(incident.owner, 'Incident Lead');
  assert.deepEqual(incident.channels, ['Voice', 'Email']);
  assert.equal(incident.timeline.length, 1);
});

test('scenario launch creates a marked synthetic incident', () => {
  const incident = E.launchScenario(E.createInitialState(), 'kano-login', T0);
  assert.equal(incident.productId, 'kano-run');
  assert.equal(incident.sourceScenario, 'kano-login');
  assert.equal(incident.reporter, 'CALLORIA simulation scenario');
});

test('unknown scenario is rejected', () => {
  assert.throws(() => E.launchScenario(E.createInitialState(), 'not-a-scenario', T0), /not found/);
});

test('acknowledgement records owner and timestamp and advances to triaged', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0);
  E.acknowledgeIncident(state, incident.id, 'Operations Lead', later(5));
  assert.equal(incident.status, 'Triaged');
  assert.equal(incident.acknowledgedAt, later(5));
  assert.equal(incident.owner, 'Operations Lead');
});


test('acknowledgement requires an assigned incident owner', () => {
  const state = E.createInitialState();
  const incident = E.createIncident(state, validIncident({ owner: 'Unassigned' }), T0);
  assert.throws(() => E.acknowledgeIncident(state, incident.id, 'Unassigned', T0), /named incident owner/);
  E.assignOwner(state, incident.id, 'Duty Operations Manager', T0);
  E.acknowledgeIncident(state, incident.id, incident.owner, later(1));
  assert.equal(incident.owner, 'Duty Operations Manager');
});


test('Detected incidents must use the acknowledgement control before triage', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0);
  assert.throws(() => E.transitionIncident(state, incident.id, 'Triaged', '', later(1)), /Invalid lifecycle/);
  E.acknowledgeIncident(state, incident.id, incident.owner, later(1));
  assert.equal(incident.status, 'Triaged');
});

test('cannot acknowledge twice or acknowledge after a state change', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0);
  E.acknowledgeIncident(state, incident.id, 'Lead', T0);
  assert.throws(() => E.acknowledgeIncident(state, incident.id, 'Lead', later(1)), /already been acknowledged/);
});

test('SEV 1 acknowledgement SLA changes from pending to overdue and missed', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident({ severity: E.SEVERITIES[0] }), T0);
  assert.equal(E.getSla(incident, later(14)).ack, 'Pending');
  assert.equal(E.getSla(incident, later(16)).ack, 'Overdue');
  E.acknowledgeIncident(state, incident.id, 'Lead', later(20));
  assert.equal(E.getSla(incident, later(21)).ack, 'Missed');
});

test('SEV 3 acknowledgement target is four hours', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident({ severity: E.SEVERITIES[2] }), T0);
  assert.equal(E.getSla(incident, later(239)).ack, 'Pending');
  assert.equal(E.getSla(incident, later(241)).ack, 'Overdue');
});

test('lifecycle transitions enforce the prescribed sequence', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0);
  assert.throws(() => E.transitionIncident(state, incident.id, 'Mitigating', '', T0), /Invalid lifecycle/);
  E.acknowledgeIncident(state, incident.id, 'Lead', T0);
  E.transitionIncident(state, incident.id, 'Investigating', '', T0);
  E.transitionIncident(state, incident.id, 'Mitigating', '', T0);
  E.transitionIncident(state, incident.id, 'Monitoring', '', T0);
  assert.equal(incident.status, 'Monitoring');
});

test('incident cannot resolve without a substantive resolution summary', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0); driveToMonitoring(state, incident);
  assert.throws(() => E.transitionIncident(state, incident.id, 'Resolved', 'fixed', T0), /30 characters/);
});

test('valid resolution records the resolution timestamp', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0); driveToMonitoring(state, incident);
  E.transitionIncident(state, incident.id, 'Resolved', 'The enrolment service was restored and successful requests were verified.', later(40));
  assert.equal(incident.status, 'Resolved');
  assert.equal(incident.resolvedAt, later(40));
});

test('owner change requires a named accountable person', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0);
  assert.throws(() => E.assignOwner(state, incident.id, 'Unassigned', T0), /named/);
  E.assignOwner(state, incident.id, 'Technical Incident Commander', T0);
  assert.equal(incident.owner, 'Technical Incident Commander');
});

test('severity change requires a reason and is added to timeline', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0);
  assert.throws(() => E.changeSeverity(state, incident.id, E.SEVERITIES[0], 'scope', T0), /15 characters/);
  E.changeSeverity(state, incident.id, E.SEVERITIES[0], 'Customer impact expanded after further checks.', T0);
  assert.equal(incident.severity, E.SEVERITIES[0]);
  assert.equal(incident.timeline[0].type, 'severity');
});

test('updates require minimum content and an allowed audience', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0);
  assert.throws(() => E.addUpdate(state, incident.id, { message: 'short' }, T0), /30 characters/);
  assert.throws(() => E.addUpdate(state, incident.id, { message: 'This is a sufficiently long update with facts.', audience: 'Public social network' }, T0), /audience/);
});

test('customer update resets the next update response clock', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident({ severity: E.SEVERITIES[0] }), T0);
  E.acknowledgeIncident(state, incident.id, 'Lead', later(2));
  E.addUpdate(state, incident.id, { audience: 'Customer-facing', message: 'We have confirmed the enrolment problem and engineers are investigating the affected service.', eta: 'Next update in 30 minutes', channels: ['Email'] }, later(10));
  assert.equal(E.getSla(incident, later(20)).update, 'On track');
  assert.equal(E.getSla(incident, later(41)).update, 'Overdue');
});

test('resolved incidents reject additional customer updates', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0); driveToMonitoring(state, incident);
  E.transitionIncident(state, incident.id, 'Resolved', 'The service fix was deployed and confirmed through successful enrolment checks.', later(40));
  assert.throws(() => E.addUpdate(state, incident.id, { message: 'A later update should not be accepted after the service has been resolved.' }, later(41)), /locked/);
});

test('follow-up tasks require a named owner and valid date', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0);
  assert.throws(() => E.addTask(state, incident.id, { title: 'Review alerts', owner: 'A', dueDate: 'no-date' }, T0), /task and a named owner/);
  assert.throws(() => E.addTask(state, incident.id, { title: 'Review alert thresholds', owner: 'Engineer', dueDate: 'not-a-date' }, T0), /valid task due date/);
});

test('task completion is recorded once', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0);
  const task = E.addTask(state, incident.id, { title: 'Review alert thresholds', owner: 'Engineer', dueDate: '2026-11-15' }, T0);
  E.completeTask(state, incident.id, task.id, later(20));
  assert.equal(task.status, 'Complete');
  assert.throws(() => E.completeTask(state, incident.id, task.id, later(21)), /already complete/);
});

test('postmortem cannot be finalised before incident resolution', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0);
  assert.throws(() => E.savePostmortem(state, incident.id, {}, T0), /only be finalised while the incident is resolved/);
});

test('postmortem requires complete root cause, improvement action and owner', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0); driveToMonitoring(state, incident);
  E.transitionIncident(state, incident.id, 'Resolved', 'The service was restored and validated successfully across the affected enrolment route.', later(30));
  assert.throws(() => E.savePostmortem(state, incident.id, { rootCause: 'short' }, later(35)), /Complete impact/);
});

test('postmortem plus action item unlocks incident closure', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0); driveToMonitoring(state, incident);
  E.transitionIncident(state, incident.id, 'Resolved', 'The service was restored and validated successfully across the affected enrolment route.', later(30));
  assert.throws(() => E.transitionIncident(state, incident.id, 'Closed', '', later(31)), /post-incident review/);
  E.savePostmortem(state, incident.id, {
    impactSummary: 'Some customers were unable to complete course enrolment during the incident window.',
    rootCause: 'A service dependency returned intermittent errors while processing new enrolment requests.',
    contributingFactors: 'The retry policy did not handle the dependency response pattern correctly.',
    whatWentWell: 'Support and engineering teams shared regular evidence during the investigation.',
    improvements: 'Add dependency fault injection tests and revise retry handling with a monitored rollout.', reviewer: 'Reliability Lead',
    actions: [{ title: 'Add dependency fault injection coverage', owner: 'Platform Engineer', dueDate: '2026-11-20' }]
  }, later(35));
  E.transitionIncident(state, incident.id, 'Closed', '', later(40));
  assert.equal(incident.status, 'Closed');
  assert.equal(incident.postmortem.actions.length, 1);
});


test('closed incidents lock ownership, severity and follow-up task changes', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0); driveToMonitoring(state, incident);
  E.transitionIncident(state, incident.id, 'Resolved', 'The enrolment service was restored and validated successfully in the affected workflow.', later(20));
  E.savePostmortem(state, incident.id, {
    impactSummary: 'Customers could not complete course enrolment during the incident window.',
    rootCause: 'A dependency response caused the enrolment request to fail intermittently.',
    improvements: 'Add fault injection coverage and a safe retry policy for the affected dependency.', reviewer: 'Reliability Lead',
    actions: [{ title: 'Add retry policy regression test', owner: 'Platform Engineer', dueDate: '2026-11-20' }]
  }, later(25));
  E.transitionIncident(state, incident.id, 'Closed', '', later(30));
  assert.throws(() => E.assignOwner(state, incident.id, 'Another Manager', later(31)), /locked/);
  assert.throws(() => E.changeSeverity(state, incident.id, E.SEVERITIES[0], 'Scope changed after the closure review.', later(31)), /locked/);
  assert.throws(() => E.addTask(state, incident.id, { title: 'Add new follow-up item', owner: 'Engineer', dueDate: '2026-11-25' }, later(31)), /locked/);
});

test('maintenance window validates ordering and owner', () => {
  const state = E.createInitialState();
  assert.throws(() => E.createMaintenance(state, { title: 'Database maintenance', productId: 'general', owner: 'Ops', startAt: '2026-11-12T12:00', endAt: '2026-11-12T11:00' }, T0), /later than its start/);
  assert.throws(() => E.createMaintenance(state, { title: 'Database maintenance', productId: 'general', owner: 'A', startAt: '2026-11-12T12:00', endAt: '2026-11-12T13:00' }, T0), /owner/);
});

test('maintenance status can move through planned, in progress and completed', () => {
  const state = E.createInitialState();
  const item = E.createMaintenance(state, { title: 'Planned database maintenance', productId: 'ruffneck-lms', owner: 'Platform Lead', startAt: '2026-11-12T12:00', endAt: '2026-11-12T13:00', customerImpact: 'Some requests may be delayed.' }, T0);
  E.setMaintenanceStatus(state, item.id, 'In progress', later(10));
  E.setMaintenanceStatus(state, item.id, 'Completed', later(70));
  assert.equal(item.status, 'Completed');
});

test('metrics count active incidents, severity, overdue clocks and reviews', () => {
  const state = E.createInitialState();
  const critical = E.createIncident(state, validIncident({ severity: E.SEVERITIES[0] }), T0);
  const high = E.createIncident(state, validIncident({ title: 'Social publishing queue failures', productId: 'ruffneck-social-hub', severity: E.SEVERITIES[1] }), T0);
  const m = E.getMetrics(state, later(40));
  assert.equal(m.active, 2);
  assert.equal(m.critical, 1);
  assert.equal(m.high, 1);
  assert.equal(m.overdueAcknowledgements, 2);
  assert.ok(critical && high);
});

test('knowledge notice reader ignores missing or malformed v5.2 data', () => {
  assert.deepEqual(E.listKnowledgeNotices(new MemoryStorage()), []);
  const bad = new MemoryStorage({ [E.KNOWLEDGE_KEY]: '{' });
  assert.deepEqual(E.listKnowledgeNotices(bad), []);
});

test('knowledge notice reader exposes published notices only', () => {
  const storage = new MemoryStorage({ [E.KNOWLEDGE_KEY]: JSON.stringify({ notices: [
    { id: 'n1', title: 'Published service update', productId: 'kano-run', status: 'Published', severity: 'Important', summary: 'A valid published update for the player service.', effectiveAt: '2026-11-11' },
    { id: 'n2', title: 'Draft update', productId: 'general', status: 'Draft', summary: 'This draft is not visible.' }
  ] }) });
  const notices = E.listKnowledgeNotices(storage);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].id, 'n1');
});

test('push to Knowledge Operations requires a supported incident state and existing v5.2 records', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0);
  const storage = new MemoryStorage();
  assert.throws(() => E.pushKnowledgeNotice(state, incident.id, storage, T0), /Mitigating/);
  driveToMonitoring(state, incident);
  assert.throws(() => E.pushKnowledgeNotice(state, incident.id, storage, T0), /records were not found/);
});

test('push creates a draft notice in v5.2 and prevents duplicate notices', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident(), T0); driveToMonitoring(state, incident);
  const storage = new MemoryStorage({ [E.KNOWLEDGE_KEY]: JSON.stringify({ version: '5.2.0', notices: [], activity: [] }) });
  const first = E.pushKnowledgeNotice(state, incident.id, storage, later(10));
  assert.equal(first.created, true);
  assert.equal(first.notice.status, 'Draft');
  assert.equal(first.notice.productId, 'ruffneck-lms');
  assert.equal(first.notice.severity, 'Important');
  const raw = JSON.parse(storage.getItem(E.KNOWLEDGE_KEY));
  assert.equal(raw.notices.length, 1);
  assert.equal(raw.notices[0].sourceIncidentId, incident.id);
  const second = E.pushKnowledgeNotice(state, incident.id, storage, later(20));
  assert.equal(second.created, false);
  assert.equal(JSON.parse(storage.getItem(E.KNOWLEDGE_KEY)).notices.length, 1);
});

test('critical incident maps to a critical knowledge notice', () => {
  const state = E.createInitialState(); const incident = E.createIncident(state, validIncident({ severity: E.SEVERITIES[0] }), T0); driveToMonitoring(state, incident);
  const storage = new MemoryStorage({ [E.KNOWLEDGE_KEY]: JSON.stringify({ notices: [], activity: [] }) });
  const result = E.pushKnowledgeNotice(state, incident.id, storage, T0);
  assert.equal(result.notice.severity, 'Critical');
});

test('CSV export includes headings and escapes embedded quotation marks', () => {
  const state = E.createInitialState();
  E.createIncident(state, validIncident({ title: 'LMS "enrolment" failure' }), T0);
  const csv = E.exportIncidentsCSV(state, T0);
  assert.match(csv, /\"reference\",\"title\",\"product\"/);
  assert.match(csv, /"LMS ""enrolment"" failure"/);
});
