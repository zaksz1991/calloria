import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = readFileSync(resolve(root, 'build/calloria-ojt-runtime.js'), 'utf8');
const handlers = [];
const sandbox = { document: { addEventListener: (...args) => handlers.push(args) } };
vm.runInNewContext(`${runtime}\nthis.__transition = calloriaOJTShadowingTransition; this.__ensure = calloriaEnsureOJTShadowingSession;`, sandbox, { filename: 'calloria-ojt-runtime.js' });
const transition = sandbox.__transition;

function advance(session, event) {
  const result = transition(session, event);
  assert.equal(result.ok, true, result.message);
  return result.session;
}

test('OJT shadowing is a real sequential simulation, not a generic next-slide clicker', () => {
  assert.match(runtime, /data-calloria-shadowing-event="accept-contact"/);
  assert.match(runtime, /data-calloria-shadowing-form="crm"/);
  assert.match(runtime, /data-calloria-shadowing-form="knowledge"/);
  assert.match(runtime, /data-calloria-shadowing-form="wrapup"/);
  assert.doesNotMatch(runtime, /data-calloria-shadowing-next/);
});

test('existing profiles with completed shadowing are not reset to the queue', () => {
  const profile = { progress: { shadowing: true } };
  const session = sandbox.__ensure(profile);
  assert.equal(session.step, 'complete');
});

test('shadowing cannot greet or log a contact before the queue offer is accepted', () => {
  const initial = { version: 1, step: 'queue', events: [] };
  assert.equal(transition(initial, { type: 'observe-greeting' }).ok, false);
  assert.equal(transition(initial, { type: 'save-crm', contactReason:'Customer requests an update', actionTaken:'Agent checked the record', nextStep:'Owner will follow up' }).ok, false);
});

test('shadowing validates CRM fields before moving to the knowledge base', () => {
  let session = { version: 1, step: 'queue', events: [] };
  session = advance(session, { type: 'accept-contact' });
  assert.equal(session.step, 'greeting');
  session = advance(session, { type: 'observe-greeting' });
  assert.equal(session.step, 'crm');
  assert.equal(transition(session, { type: 'save-crm', contactReason:'too short', actionTaken:'too short', nextStep:'short' }).ok, false);
  session = advance(session, { type: 'save-crm', contactReason:'Customer requested a service update after the previous contact.', actionTaken:'Agent checked the service record and the approved procedure.', nextStep:'Assigned service team owns the next update and will contact the customer.' });
  assert.equal(session.step, 'knowledge');
  assert.equal(session.crmRecord.recordType, 'training-only');
});

test('knowledge and wrap-up disposition must match the verified route', () => {
  let session = { version: 1, step: 'queue', events: [] };
  session = advance(session, { type: 'accept-contact' });
  session = advance(session, { type: 'observe-greeting' });
  session = advance(session, { type: 'save-crm', contactReason:'Customer requested a service update after the previous contact.', actionTaken:'Agent checked the service record and the approved procedure.', nextStep:'Assigned service team owns the next update and will contact the customer.' });
  assert.equal(transition(session, { type: 'check-knowledge', articleReviewed:false, route:'case-required' }).ok, false);
  session = advance(session, { type: 'check-knowledge', articleReviewed:true, route:'case-required' });
  assert.equal(session.step, 'wrapup');
  assert.equal(transition(session, { type: 'complete-wrapup', disposition:'resolved', summary:'The case has been created and assigned to the service team for investigation.' }).ok, false);
  session = advance(session, { type: 'complete-wrapup', disposition:'case-created', summary:'Case created and assigned to the service team; the customer was told who owns the next update.' });
  assert.equal(session.step, 'complete');
  assert.ok(session.completedAt);
  assert.equal(session.events.at(-1).type, 'after-contact-work-completed');
});

test('training activity is explicitly separated from production calls and employee KPIs', () => {
  assert.match(runtime, /recordType: 'training-only'/);
  assert.match(runtime, /does not create a production customer case/i);
  assert.match(runtime, /affect agent KPIs/i);
  assert.match(runtime, /does not count as a live customer interaction/i);
  assert.doesNotMatch(runtime, /state\.callsHandled\s*\+\+|state\.totalQA\s*\+=|state\.totalCSAT\s*\+=/);
});

test('general service and specialist industry packs remain available', () => {
  for (const value of ['general-customer-experience','banking','telecoms','retail','utilities','logistics','travel','insurance','healthcare','technology','public']) {
    assert.ok(runtime.includes(value), `Missing industry pack ${value}`);
  }
  assert.match(runtime, /general-customer-experience/);
});

test('trainer sign-off remains locked until all four OJT modules pass', () => {
  assert.match(runtime, /const required=\['knowledge','logging','shadowing','supervised'\]/);
  assert.match(runtime, /Trainer sign-off is locked until every onboarding module is complete/);
  assert.match(runtime, /Your workstation is now eligible for allocation/);
});
