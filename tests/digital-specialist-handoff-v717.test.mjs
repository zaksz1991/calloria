import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIGITAL_SPECIALIST_DEPARTMENTS,
  validateDigitalSpecialistHandoff,
  createDigitalSpecialistHandoffRequest,
  attachDigitalSpecialistHandoff
} from '../js/digital-specialist-handoff-v717.js';
import { transformDigitalSpecialistHandoffMain, calloriaDigitalSpecialistHandoffPluginV717 } from '../build/calloria-digital-specialist-handoff-v717.mjs';
import { writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const IMPORT_ANCHOR = "import { DIGITAL_CHANNELS, DIGITAL_STATUS, DIGITAL_SCENARIOS, createDigitalQueue, sortDigitalQueue, findDigitalContact, acceptDigitalContact, recordDigitalReply, deliverDigitalFollowUp, completeDigitalContact, digitalQueueMetrics, appendDigitalEvent } from './multichannel-engine.js';";
const FORM_ANCHOR = '<label class="form-field">DISPOSITION<select name="disposition" ${interactiveBlocked ? \'disabled\' : \'\'}><option value="resolved">Resolved</option><option value="pending_customer">Pending customer response</option><option value="escalated">Escalated to specialist team</option></select></label>';
const mainFixture = `${IMPORT_ANCHOR}
const formMarkup = \`<form id="digitalCloseForm">${FORM_ANCHOR}</form>\`;
function supervisorEscalationCard(request) { return \`<p>\${escapeHTML(request.reason || 'Agent assistance requested.')}</p><div class="supervisor-escalation-meta">\`; }
function finishDigitalContact(form) {
  const values = new FormData(form);
  const disposition = String(values.get('disposition') || '');
  try {
    const completed = completeDigitalContact(state.digitalQueue, contact.id, { disposition, notes: values.get('notes') }, queueSimulationNowMs());
    const statusLabel = disposition;
    const reference = \`DIG-\${contact.id}\`;
    const customerOutcome = digitalCustomerBehaviourSnapshot(ensureDigitalCustomerBehaviour(contact));
    const digitalCase = { reference, customer: contact.customer, customerRef: contact.customerRef || null, title: contact.subject, channel: contact.channelLabel, disposition, status: statusLabel, qa: contact.qaScore ?? 0, customerSentiment: customerOutcome.sentiment, customerMood: customerOutcome.mood, customerPersona: customerOutcome.personaLabel, supervisorRecommended: customerOutcome.needsSupervisor, owner: state.applicantName || 'Agent', notes: completed.notes, createdAt: completed.completedAt, messages: contact.messages.map(message => ({ type: message.type, text: message.text, at: message.at })) };
    state.cases.push(digitalCase);recordCustomerContinuityFromCase(digitalCase,{customerRef:contact.customerRef});
  } catch (error) { toast(error.message, 'warning'); }
}
`;

test('department whitelist is fixed and contains operational specialist teams', () => {
  assert.ok(DIGITAL_SPECIALIST_DEPARTMENTS.includes('Fraud & Payments'));
  assert.ok(DIGITAL_SPECIALIST_DEPARTMENTS.includes('RuffNeck Product Support'));
  assert.equal(new Set(DIGITAL_SPECIALIST_DEPARTMENTS).size, DIGITAL_SPECIALIST_DEPARTMENTS.length);
});

test('valid specialist destination and clear reason are accepted', () => {
  const result = validateDigitalSpecialistHandoff({ department: 'Fraud & Payments', reason: 'Suspected duplicate debit needs fraud investigation.' });
  assert.equal(result.ok, true);
  assert.equal(result.value.department, 'Fraud & Payments');
});

test('unknown department is rejected', () => {
  assert.match(validateDigitalSpecialistHandoff({ department: 'External Vendor', reason: 'Need specialist review of the issue.' }).error, /valid specialist destination/i);
});

test('short escalation reason is rejected', () => {
  assert.match(validateDigitalSpecialistHandoff({ department: 'Digital Support', reason: 'help' }).error, /at least 12/i);
});

test('overlong escalation reason is rejected rather than silently truncated', () => {
  assert.match(validateDigitalSpecialistHandoff({ department: 'Digital Support', reason: 'x'.repeat(241) }).error, /240 characters/i);
});

test('handoff request is linked to contact and CRM case without triggering legacy case-review action', () => {
  const request = createDigitalSpecialistHandoffRequest({
    id: 'SUP-TEST-1', contact: { id: 'DIG-10', customer: 'Customer A', channel: 'email', channelLabel: 'Email', priority: 'high' },
    caseReference: 'DIG-DIG-10', department: 'Transfers Support', reason: 'Beneficiary transfer requires trace by the transfers team.', actor: 'Training Agent', now: 1_800_000_000_000
  });
  assert.equal(request.contactId, 'DIG-10');
  assert.equal(request.linkedCaseReference, 'DIG-DIG-10');
  assert.equal(Object.hasOwn(request, 'caseReference'), false);
  assert.equal(request.status, 'open');
  assert.equal(request.source, 'digital-specialist-handoff-v717');
  assert.equal(request.handoff.stage, 'awaiting_supervisor_review');
  assert.equal(request.escalation, undefined);
});

test('invalid contact or reference is rejected before a request can be created', () => {
  assert.throws(() => createDigitalSpecialistHandoffRequest({ id: 'SUP-1', contact: null, caseReference: 'CASE-1', department: 'Digital Support', reason: 'Technical investigation needed.' }), /digital contact/i);
  assert.throws(() => createDigitalSpecialistHandoffRequest({ id: 'SUP-1', contact: { id: 'DIG-1' }, caseReference: '', department: 'Digital Support', reason: 'Technical investigation needed.' }), /request ID and CRM case reference/i);
});

test('an existing supervisor request is augmented without losing ownership or escalation state', () => {
  const existing = { id: 'SUP-2', status: 'open', reason: 'Customer sentiment intervention', escalation: { assignedTo: 'Supervisor One', stage: 'in_progress' } };
  const draft = createDigitalSpecialistHandoffRequest({ id: 'SUP-2', contact: { id: 'DIG-2', customer: 'Customer B' }, caseReference: 'DIG-DIG-2', department: 'Life & Advice', reason: 'Customer requires a specialist advice response.' });
  const updated = attachDigitalSpecialistHandoff(existing, draft);
  assert.equal(updated.escalation.assignedTo, 'Supervisor One');
  assert.equal(updated.escalation.stage, 'in_progress');
  assert.equal(updated.specialistDepartment, 'Life & Advice');
  assert.match(updated.reason, /Customer sentiment intervention/);
});

test('main transform injects form, validation, CRM linkage and supervisor destination display', () => {
  const result = transformDigitalSpecialistHandoffMain(mainFixture);
  assert.equal(result.changed, true);
  for (const expected of [
    'digital-specialist-handoff-v717.js',
    'data-digital-escalation-fields',
    'validateDigitalSpecialistHandoff',
    'createDigitalSpecialistHandoffRequest',
    'digitalCase.supervisorRequestId',
    'supervisor-handoff-destination',
    'CALLORIA_DIGITAL_SPECIALIST_HANDOFF_V717'
  ]) assert.ok(result.code.includes(expected), `Missing transformed content: ${expected}`);
});

test('main transform is idempotent', () => {
  const first = transformDigitalSpecialistHandoffMain(mainFixture);
  const second = transformDigitalSpecialistHandoffMain(first.code);
  assert.equal(second.changed, false);
  assert.equal(second.alreadyPatched, true);
  assert.equal(second.code, first.code);
});

test('source drift refuses partial transformation', () => {
  assert.throws(() => transformDigitalSpecialistHandoffMain(mainFixture.replace('function finishDigitalContact(form) {', 'function finishDigitalContactV2(form) {')), /finishDigitalContact function.*found 0/i);
});

test('Vite plugin only transforms js/main.js and reports a source rebase error', () => {
  const plugin = calloriaDigitalSpecialistHandoffPluginV717();
  assert.equal(plugin.transform.call({ error() { throw new Error('unexpected'); } }, mainFixture, '/repo/js/other.js'), null);
  let failed = false;
  try {
    plugin.transform.call({ error(message) { throw new Error(message); } }, mainFixture.replace(IMPORT_ANCHOR, ''), '/repo/js/main.js');
  } catch (error) {
    failed = /digital engine import/.test(error.message);
  }
  assert.equal(failed, true);
});

test('transformed fixture remains valid JavaScript syntax', async () => {
  const transformed = transformDigitalSpecialistHandoffMain(mainFixture).code;
  const filename = join(tmpdir(), `calloria-v717-${process.pid}.mjs`);
  try {
    await writeFile(filename, transformed);
    execFileSync(process.execPath, ['--check', filename]);
  } finally {
    await unlink(filename).catch(() => {});
  }
});


test('transform imports the dedicated responsive stylesheet', () => {
  const transformed = transformDigitalSpecialistHandoffMain(mainFixture).code;
  assert.ok(transformed.includes("import '../styles/calloria-digital-specialist-handoff-v717.css';"));
});

test('handoff transform does not perform an automatic ownership transfer', () => {
  const transformed = transformDigitalSpecialistHandoffMain(mainFixture).code;
  assert.ok(transformed.includes('A supervisor must claim and review it; selecting a destination does not transfer ownership automatically.'));
  assert.ok(transformed.includes('state.supervisorRequests.push(specialistHandoffDraft)'));
  assert.equal(transformed.includes('digitalCase.owner = specialistHandoffDraft.specialistDepartment'), false);
});

test('stylesheet includes narrow-screen support and hidden-state handling', async () => {
  const base = dirname(fileURLToPath(import.meta.url));
  const css = await readFile(join(base, '../styles/calloria-digital-specialist-handoff-v717.css'), 'utf8');
  assert.match(css, /\.digital-escalation-fields\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(css, /@media\s*\(max-width:\s*680px\)/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});
