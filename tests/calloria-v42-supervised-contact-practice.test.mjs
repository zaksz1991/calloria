import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = readFileSync(resolve(root, 'build/calloria-ojt-runtime.js'), 'utf8');
const sandbox = { document: { addEventListener() {} } };
vm.runInNewContext(`${runtime}\nthis.__transition = calloriaSupervisedPracticeTransition; this.__ensure = calloriaEnsureSupervisedPracticeSession; this.__scenario = calloriaSupervisedPracticeScenario;`, sandbox, { filename: 'calloria-ojt-runtime.js' });
const transition = sandbox.__transition;
const scenario = sandbox.__scenario;
function send(session, event, industry='general-customer-experience') {
  const result = transition(session, event, industry);
  assert.equal(result.ok, true, result.message);
  assert.equal(result.advanced, true, result.message);
  return result.session;
}
function fresh(industry='general-customer-experience') {
  return { version:1, stage:'opening', transcript:[{speaker:'customer',text:scenario(industry).customer}], events:[], rubric:{}, attempts:{}, score:0 };
}
function passOpening(session) {
  return send(session,{type:'opening-response',response:'I understand how frustrating this has been. My name is Daniel and I will review the previous contact and check the service record before advising you.'});
}
function passInvestigation(session) {
  return send(session,{type:'investigation-review',customerRecord:true,priorContact:true,knowledgeBase:true,finding:'The service request remains open, the previous interaction is recorded and no completion event or owner update is present.'});
}
function passNextStep(session) {
  return send(session,{type:'explain-next-step',response:'I have recorded this as a follow-up case and assigned it to the responsible service team. The team owns the investigation and will contact you with the next update using the contact details on your profile.'});
}
function passWrap(session) {
  return send(session,{type:'complete-training-wrapup',contactReason:'Customer requested an update on a previously reported service request that remains open.',actionTaken:'Reviewed the customer record, prior interaction history and current approved procedure; no completion was confirmed.',owner:'Customer Experience Follow-up Team',nextStep:'Assigned team will investigate and contact the customer with the next verified update.'});
}

test('supervised practice is a multi-turn customer conversation, not a one-shot questionnaire',()=>{
  assert.match(runtime,/data-calloria-ojt-form="supervised"/);
  assert.match(runtime,/SUPERVISED CONTACT SIMULATION/);
  assert.match(runtime,/customer replies, the simulated records provide evidence/i);
  assert.doesNotMatch(runtime,/data.get\('outcome'\) !== 'investigate-case'/);
});

test('new practice session starts with an industry-appropriate synthetic customer and sequential stages',()=>{
  for (const industry of ['general-customer-experience','banking','telecoms','retail','utilities','logistics','travel','insurance','healthcare','technology','public']) {
    const s=fresh(industry);
    assert.equal(s.stage,'opening');
    assert.ok(s.transcript[0].text.length>20);
    assert.ok(scenario(industry).record.length>20);
  }
});

test('opening requires acknowledgement, ownership and an investigation promise',()=>{
  const s=fresh();
  const weak=transition(s,{type:'opening-response',response:'I will check this.'});
  assert.equal(weak.ok,true); assert.equal(weak.advanced,false); assert.equal(weak.session.stage,'opening');
  assert.match(weak.message,/acknowledgement|greeting|ownership/i);
  const strong=passOpening(s);
  assert.equal(strong.stage,'investigation'); assert.equal(strong.score,25);
});

test('credential solicitation is rejected and coached before any progression',()=>{
  const r=transition(fresh(),{type:'opening-response',response:'I understand your concern. Please tell me your OTP and password so I can check this.'});
  assert.equal(r.advanced,false); assert.equal(r.session.stage,'opening');
  assert.match(r.message,/Never request a PIN, password, OTP/i);
});

test('unsupported guarantees are rejected during greeting and next-step explanation',()=>{
  const first=transition(fresh(),{type:'opening-response',response:'I understand and I will investigate. I guarantee this will be fixed today.'});
  assert.equal(first.advanced,false);
  let s=passOpening(fresh()); s=passInvestigation(s);
  const second=transition(s,{type:'explain-next-step',response:'I guarantee the responsible team will resolve it today for sure.'});
  assert.equal(second.advanced,false); assert.equal(second.session.stage,'nextStep');
});

test('investigation requires customer record, previous contact and approved knowledge review',()=>{
  let s=passOpening(fresh());
  const weak=transition(s,{type:'investigation-review',customerRecord:true,priorContact:false,knowledgeBase:true,finding:'The request remains open and no completion event is present.'});
  assert.equal(weak.advanced,false); assert.equal(weak.session.stage,'investigation');
  s=passInvestigation(s); assert.equal(s.stage,'nextStep'); assert.equal(s.score,50);
});

test('next-step explanation requires accountable ownership and a customer update route',()=>{
  let s=passOpening(fresh()); s=passInvestigation(s);
  const weak=transition(s,{type:'explain-next-step',response:'Please wait while we look into this.'});
  assert.equal(weak.advanced,false); assert.equal(weak.session.stage,'nextStep');
  s=passNextStep(s); assert.equal(s.stage,'wrapup'); assert.equal(s.score,75);
});

test('case wrap-up requires a factual reason, action, owner and next step',()=>{
  let s=passNextStep(passInvestigation(passOpening(fresh())));
  const weak=transition(s,{type:'complete-training-wrapup',contactReason:'Too short',actionTaken:'Too short',owner:'x',nextStep:'later'});
  assert.equal(weak.advanced,false); assert.equal(weak.session.stage,'wrapup');
  s=passWrap(s); assert.equal(s.stage,'complete'); assert.equal(s.score,100);
  assert.equal(s.evidence.disposition,'case-created'); assert.equal(s.evidence.recordType,'training-only');
});

test('the complete training transcript and trainer rubric are preserved for sign-off evidence',()=>{
  let s=passWrap(passNextStep(passInvestigation(passOpening(fresh()))));
  assert.equal(s.stage,'complete'); assert.ok(s.completedAt); assert.equal(s.transcript.length,8);
  assert.deepEqual(Object.keys(s.rubric).sort(),['investigation','nextStep','opening','wrapup']);
  assert.equal(Object.values(s.rubric).reduce((n,x)=>n+x.points,0),100);
});

test('legacy completed onboarding profiles remain complete and are not forced to retrain',()=>{
  const o={progress:{supervised:true},evidence:{supervised:{completedAt:'2026-01-01T00:00:00Z'}}};
  const s=sandbox.__ensure(o);
  assert.equal(s.stage,'complete'); assert.equal(s.legacyCompleted,true);
});

test('training never updates production workload, QA, CSAT or salary counters',()=>{
  assert.match(runtime,/recordType: 'training-only'/);
  assert.match(runtime,/does not place a real call, create a production case or update live calls handled/i);
  assert.doesNotMatch(runtime,/state\.callsHandled\s*\+\+|state\.totalQA\s*\+=|state\.totalCSAT\s*\+=|state\.salary\s*\+=/);
});

test('existing recruitment gate, industry catalog and trainer sign-off remain intact',()=>{
  assert.match(runtime,/calloriaOJTRequired\(\)/);
  assert.match(runtime,/Trainer sign-off is locked until every onboarding module is complete/);
  assert.match(runtime,/Your workstation is now eligible for allocation/);
  for (const value of ['general-customer-experience','banking','telecoms','retail','utilities','logistics','travel','insurance','healthcare','technology','public']) assert.ok(runtime.includes(value));
});
