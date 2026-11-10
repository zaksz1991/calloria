import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = readFileSync(resolve(root, 'build/calloria-ojt-runtime.js'), 'utf8');
const sandbox = { document: { addEventListener() {} }, escapeHTML: value => String(value) };
vm.runInNewContext(`${runtime}\nthis.__readiness=calloriaOJTTrainingReadiness; this.__review=calloriaTrainerReviewTransition; this.__allocate=calloriaWorkstationAllocationTransition; this.__gate=calloriaOJTShiftGate; this.__departments=CALLORIA_OJT_DEPARTMENTS; this.__seats=CALLORIA_OJT_WORKSTATIONS; this.__panel=calloriaRenderTrainerAllocationPanel; this.__ensureProfile=calloriaEnsureOJTProfile;`, sandbox, { filename: 'calloria-ojt-runtime.js' });
const readiness = sandbox.__readiness;
const review = sandbox.__review;
const allocate = sandbox.__allocate;
const gate = sandbox.__gate;
const departments = sandbox.__departments;
const seats = sandbox.__seats;
const panel = sandbox.__panel;
const ensureProfile = sandbox.__ensureProfile;

function completedOnboarding() {
  return {
    version: 1,
    status: 'in_progress',
    progress: { knowledge: true, logging: true, shadowing: true, supervised: true },
    evidence: {
      knowledge: { score: 3 },
      logging: { contactReason: 'Customer cannot access the service and needs an update.', actionTaken: 'Reviewed the synthetic customer record and current approved service procedure.', nextStep: 'Service team owns the follow-up.', recordType: 'training-only' },
      shadowing: { observedStages: 5, recordType: 'training-only' },
      supervised: { trainerReview: 'passed', score: 100, recordType: 'training-only' }
    },
    shadowingSession: { step: 'complete' },
    supervisedSession: { stage: 'complete', score: 100 }
  };
}

const allTrainerAttestations = {
  evidenceReviewed: true,
  customerCareReady: true,
  safeConductConfirmed: true,
  systemUseConfirmed: true
};

test('trainer review is locked until all four OJT evidence modules are complete', () => {
  const trainee = completedOnboarding();
  trainee.progress.shadowing = false;
  const state = readiness(trainee);
  assert.equal(state.ready, false);
  assert.equal(state.checks.find(item => item.id === 'shadowing').passed, false);
  const request = review(trainee, { type: 'request-review' });
  assert.equal(request.ok, false);
  assert.match(request.message, /Experienced-agent shadowing/);
});

test('trainer review request creates a pending review without certifying the employee', () => {
  const request = review(completedOnboarding(), { type: 'request-review' });
  assert.equal(request.ok, true, request.message);
  assert.equal(request.onboarding.status, 'trainer_review_pending');
  assert.equal(request.onboarding.trainerReview.status, 'pending');
  assert.equal(request.onboarding.workstationAllocation, undefined);
  assert.equal(gate(request.onboarding, true).ok, false);
});

test('trainer cannot approve without all four competency and conduct attestations', () => {
  const pending = review(completedOnboarding(), { type: 'request-review' }).onboarding;
  const approval = review(pending, { type: 'approve-review', evidenceReviewed: true, customerCareReady: true });
  assert.equal(approval.ok, false);
  assert.match(approval.message, /four competency and conduct checks/);
  assert.equal(pending.status, 'trainer_review_pending');
});

test('approved trainer review still does not unlock independent shift before workstation allocation', () => {
  const pending = review(completedOnboarding(), { type: 'request-review' }).onboarding;
  const approved = review(pending, { type: 'approve-review', ...allTrainerAttestations });
  assert.equal(approved.ok, true, approved.message);
  assert.equal(approved.onboarding.status, 'trainer_approved');
  assert.equal(approved.onboarding.trainerReview.status, 'approved');
  const result = gate(approved.onboarding, true);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'training');
});

test('workstation allocation is rejected before trainer approval', () => {
  const pending = review(completedOnboarding(), { type: 'request-review' }).onboarding;
  const result = allocate(pending, { type: 'allocate-workstation', departmentId: 'cx', workstationId: 'FLOOR-A-01' });
  assert.equal(result.ok, false);
  assert.match(result.message, /locked until trainer sign-off/);
});

test('workstation allocation validates department and seat IDs', () => {
  const pending = review(completedOnboarding(), { type: 'request-review' }).onboarding;
  const approved = review(pending, { type: 'approve-review', ...allTrainerAttestations }).onboarding;
  assert.equal(allocate(approved, { type: 'allocate-workstation', departmentId: 'unknown', workstationId: 'FLOOR-A-01' }).ok, false);
  assert.equal(allocate(approved, { type: 'allocate-workstation', departmentId: 'cx', workstationId: 'NOT-A-DESK' }).ok, false);
});

test('successful allocation stores department, workstation, universal customer-care rotation and channel coverage', () => {
  const pending = review(completedOnboarding(), { type: 'request-review' }).onboarding;
  const approved = review(pending, { type: 'approve-review', ...allTrainerAttestations }).onboarding;
  const result = allocate(approved, { type: 'allocate-workstation', departmentId: 'it', workstationId: 'FLOOR-B-02' });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.onboarding.status, 'certified');
  assert.equal(result.onboarding.workstationAllocation.status, 'allocated');
  assert.equal(result.onboarding.workstationAllocation.departmentName, 'IT Service Desk');
  assert.equal(result.onboarding.workstationAllocation.workstationId, 'FLOOR-B-02');
  assert.equal(result.onboarding.workstationAllocation.customerCareRotation, true);
  assert.deepEqual(Array.from(result.onboarding.workstationAllocation.enabledChannels), ['voice', 'email', 'live-chat']);
});

test('first shift remains locked until assigned workstation and briefing attendance are both present', () => {
  const pending = review(completedOnboarding(), { type: 'request-review' }).onboarding;
  const approved = review(pending, { type: 'approve-review', ...allTrainerAttestations }).onboarding;
  const allocated = allocate(approved, { type: 'allocate-workstation', departmentId: 'cx', workstationId: 'FLOOR-A-01' }).onboarding;
  assert.equal(gate(allocated, false).ok, false);
  assert.equal(gate(allocated, false).reason, 'briefing');
  assert.equal(gate(allocated, true).ok, true);
  assert.equal(gate(allocated, true).workstation, 'FLOOR-A-01');
});

test('legacy employees are grandfathered without being forced through new allocation', () => {
  assert.equal(gate({ status: 'certified', grandfathered: true }, false).ok, true);
});

test('all ten operating departments retain a mandatory customer-care foundation', () => {
  assert.equal(departments.length, 10);
  assert.ok(departments.every(item => typeof item.skill === 'string' && item.skill.length > 0));
  assert.equal(seats.length, 12);
  assert.equal(new Set(seats.map(item => item.id)).size, 12);
});

test('trainer and allocation panels are separate, sequential stages', () => {
  const complete = completedOnboarding();
  const pending = review(complete, { type: 'request-review' }).onboarding;
  assert.match(panel(pending, 4), /SIMULATED TRAINER REVIEW/);
  const approved = review(pending, { type: 'approve-review', ...allTrainerAttestations }).onboarding;
  assert.match(panel(approved, 4), /Allocate your first workstation/);
  const allocated = allocate(approved, { type: 'allocate-workstation', departmentId: 'cx', workstationId: 'FLOOR-A-01' }).onboarding;
  assert.match(panel(allocated, 4), /WORKSTATION ALLOCATED/);
});

test('new employees default to general customer experience rather than banking-only training', () => {
  assert.match(runtime, /industryPack: 'general-customer-experience'/);
  assert.match(runtime, /Banking & financial services/);
  assert.match(runtime, /General customer experience \/ multi-industry service/);
});

test('first independent shift is recorded only after the existing shift engine activates the shift', () => {
  assert.match(runtime, /if \(!state\.shiftActive \|\| !state\.onboarding \|\| state\.onboarding\.grandfathered \|\| state\.onboarding\.firstWorkingShift\) return/);
  assert.match(runtime, /source: 'first-independent-working-shift'/);
  assert.match(runtime, /calloriaOJTShiftGate\(state\.onboarding, calloriaCurrentBriefingAttended\(\)\)/);
});

test('a v4.2 newly trained employee with no production work is moved to workstation allocation, not grandfathered', () => {
  sandbox.state = {
    hired: true, callsHandled: 0, outboundCalls: 0, shiftHistory: [], shiftActive: false, shiftRecord: null,
    onboarding: { status: 'certified', completedAt: '2026-11-10T10:00:00.000Z', progress: { knowledge: true, logging: true, shadowing: true, supervised: true },
      evidence: { knowledge: {}, logging: {}, shadowing: {}, supervised: {} }, trainer: { name: 'Simulated Onboarding Trainer', decision: 'approved', at: '2026-11-10T10:00:00.000Z' } }
  };
  sandbox.saveState = () => {};
  ensureProfile();
  assert.equal(sandbox.state.onboarding.status, 'trainer_approved');
  assert.equal(sandbox.state.onboarding.grandfathered, undefined);
  assert.equal(sandbox.state.onboarding.trainerReview.status, 'approved');
  assert.equal(sandbox.state.onboarding.progress.supervised, true);
});

test('employees with prior production work retain grandfathered access without forced re-onboarding', () => {
  sandbox.state = { hired: true, callsHandled: 12, outboundCalls: 0, shiftHistory: [], shiftActive: false, shiftRecord: null,
    onboarding: { status: 'certified', progress: { knowledge: true, logging: true, shadowing: true, supervised: true } } };
  sandbox.saveState = () => {};
  ensureProfile();
  assert.equal(sandbox.state.onboarding.status, 'certified');
  assert.equal(sandbox.state.onboarding.grandfathered, true);
});
