import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDigitalDispositionEvidence } from '../js/digital-disposition-integrity-v719.js';
import { calloriaDigitalDispositionIntegrityPluginV719 } from '../build/calloria-digital-disposition-integrity-v719.mjs';

const notes = 'Reviewed the reported issue, documented the check, action and agreed customer outcome.';
function contact(overrides = {}) {
  return {
    id: 'DIG-TEST-001', status: 'awaiting_customer', replyCount: 1,
    messages: [
      { type: 'customer', text: 'I need help with this issue.' },
      { type: 'agent', text: 'I have reviewed the issue and explained the next step.' }
    ], customerBehaviour: { pendingResponse: '', needsSupervisor: false },
    ...overrides
  };
}

test('resolved with a customer reply after an agent response is accepted', () => {
  const result = validateDigitalDispositionEvidence({
    contact: contact({ messages: [...contact().messages, { type: 'customer', text: 'Thank you, that is resolved.' }] }),
    disposition: 'resolved', evidenceType: 'customer_confirmed', notes
  });
  assert.equal(result.allowed, true);
  assert.equal(result.customerReplyObserved, true);
});

test('customer-confirmed resolution is blocked without a customer reply after the agent', () => {
  const result = validateDigitalDispositionEvidence({ contact: contact(), disposition: 'resolved', evidenceType: 'customer_confirmed', notes });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /customer has replied/i);
});

test('one-touch resolution is accepted when no customer response or supervisor risk is pending', () => {
  const result = validateDigitalDispositionEvidence({
    contact: contact({ status: 'active', customerBehaviour: { pendingResponse: '', needsSupervisor: false } }),
    disposition: 'resolved', evidenceType: 'one_touch_resolution', notes
  });
  assert.equal(result.allowed, true);
});

test('one-touch resolution is blocked while a scripted customer response is pending', () => {
  const result = validateDigitalDispositionEvidence({
    contact: contact({ status: 'active', customerBehaviour: { pendingResponse: 'Please clarify the next step.', needsSupervisor: false } }),
    disposition: 'resolved', evidenceType: 'one_touch_resolution', notes
  });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /response pending/i);
});

test('customer risk cannot be closed as resolved before independent supervisor review', () => {
  const result = validateDigitalDispositionEvidence({
    contact: contact({ customerBehaviour: { pendingResponse: '', needsSupervisor: true } }),
    disposition: 'resolved', evidenceType: 'customer_confirmed', notes
  });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /supervisor-risk flag/i);
});

test('customer risk can be resolved after the supervisor review is recorded', () => {
  const result = validateDigitalDispositionEvidence({
    contact: contact({ customerBehaviour: { pendingResponse: '', needsSupervisor: true }, messages: [...contact().messages, { type: 'customer', text: 'Thank you, the issue is resolved.' }] }),
    disposition: 'resolved', evidenceType: 'customer_confirmed', notes, supervisorReviewRecorded: true
  });
  assert.equal(result.allowed, true);
});

test('pending customer requires the pending-information evidence code', () => {
  const accepted = validateDigitalDispositionEvidence({ contact: contact(), disposition: 'pending_customer', evidenceType: 'customer_information_pending', notes });
  const rejected = validateDigitalDispositionEvidence({ contact: contact(), disposition: 'pending_customer', evidenceType: 'one_touch_resolution', notes });
  assert.equal(accepted.allowed, true);
  assert.equal(rejected.allowed, false);
});

test('escalation requires a specialist referral and linked supervisor request', () => {
  const missing = validateDigitalDispositionEvidence({ contact: contact(), disposition: 'escalated', evidenceType: 'specialist_referral_created', notes });
  const present = validateDigitalDispositionEvidence({ contact: contact(), disposition: 'escalated', evidenceType: 'specialist_referral_created', notes, supervisorRequestOpen: true });
  assert.equal(missing.allowed, false);
  assert.equal(present.allowed, true);
});

test('short factual notes are rejected', () => {
  const result = validateDigitalDispositionEvidence({ contact: contact(), disposition: 'pending_customer', evidenceType: 'customer_information_pending', notes: 'Need update.' });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /20 characters/i);
});

test('unsupported statuses are rejected without mutating the contact', () => {
  const item = contact({ status: 'resolved' });
  const before = JSON.stringify(item);
  const result = validateDigitalDispositionEvidence({ contact: item, disposition: 'resolved', evidenceType: 'one_touch_resolution', notes });
  assert.equal(result.allowed, false);
  assert.equal(JSON.stringify(item), before);
});

test('Vite transform injects the evidence gate, form field and CRM evidence record', () => {
  const fixture = `import { ensureDigitalCustomerBehaviour, evaluateDigitalCustomerReaction, deliverAdaptiveDigitalCustomerResponse, digitalCustomerBehaviourSnapshot, digitalCustomerBehaviourMetrics } from './digital-customer-behaviour-engine.js';\nfunction renderDigital(){ const form = '<label class="form-field">DISPOSITION<select name="disposition"><option>Resolved</option></select></label><label class="form-field">CASE NOTES<textarea name="notes" rows="3" minlength="12" maxlength="1200" required placeholder="Issue, checks, action, owner and agreed next step."'; }\nfunction finishDigitalContact(form) {\n  const values = new FormData(form);\n  const disposition = String(values.get('disposition') || '');\n  try {\n    const completed = completeDigitalContact(state.digitalQueue, contact.id, { disposition, notes: values.get('notes') }, queueSimulationNowMs());\n    const digitalCase = { reference, notes: completed.notes, createdAt: completed.completedAt, messages: contact.messages };\n  } catch (error) {}\n}`;
  const plugin = calloriaDigitalDispositionIntegrityPluginV719();
  const warnings = [];
  const result = plugin.transform.call({ warn: message => warnings.push(message) }, fixture, '/repo/js/main.js');
  assert.ok(result);
  assert.match(result.code, /validateDigitalDispositionEvidence/);
  assert.match(result.code, /name="outcomeEvidence"/);
  assert.match(result.code, /dispositionEvidence: completed\.dispositionEvidence/);
  assert.match(result.code, /CALLORIA_V719_DIGITAL_DISPOSITION_INTEGRITY/);
  assert.deepEqual(warnings, []);
});

test('Vite transform is idempotent', () => {
  const fixture = `import { ensureDigitalCustomerBehaviour, evaluateDigitalCustomerReaction, deliverAdaptiveDigitalCustomerResponse, digitalCustomerBehaviourSnapshot, digitalCustomerBehaviourMetrics } from './digital-customer-behaviour-engine.js';\nconst markup = '</select></label><label class="form-field">CASE NOTES<textarea name="notes" rows="3" minlength="12" maxlength="1200" required placeholder="Issue, checks, action, owner and agreed next step."';\nfunction finishDigitalContact(form) {\n  const values = new FormData(form);\n  const disposition = String(values.get('disposition') || '');\n  try {\n    const completed = completeDigitalContact(state.digitalQueue, contact.id, { disposition, notes: values.get('notes') }, queueSimulationNowMs());\n    const digitalCase = { notes: completed.notes, createdAt: completed.completedAt, messages: contact.messages };\n  } catch (error) {}\n}`;
  const plugin = calloriaDigitalDispositionIntegrityPluginV719();
  const context = { warn() {} };
  const first = plugin.transform.call(context, fixture, '/repo/js/main.js');
  const second = plugin.transform.call(context, first.code, '/repo/js/main.js');
  assert.equal(second, null);
});

test('source drift skips the full transform without partial mutation', () => {
  const plugin = calloriaDigitalDispositionIntegrityPluginV719();
  const warnings = [];
  const source = 'function finishDigitalContact(form) {}';
  const result = plugin.transform.call({ warn: message => warnings.push(message) }, source, '/repo/js/main.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.equal(source, 'function finishDigitalContact(form) {}');
});
