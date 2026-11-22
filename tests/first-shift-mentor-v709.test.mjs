import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFirstShiftMentorRecord,
  normalizeFirstShiftMentorRecord,
  recordMentorCallConnected,
  recordMentorCaseSaved,
  acknowledgeMentorCoaching,
  requestMentorReview,
  approveMentorReview,
  firstShiftMentorSnapshot
} from '../js/first-shift-mentor-engine-v709.js';
import { __firstShiftMentorPluginTest as plugin } from '../build/calloria-first-shift-mentor-v709-plugin.mjs';

const NOW = '2026-11-22T09:00:00.000Z';
const cleanCase = (reference, qa = 85) => ({ reference, disposition: 'resolved', qa, breach: false, resolved: true });

test('creates a first-shift mentor record without touching recruitment fields', () => {
  const record = createFirstShiftMentorRecord({ day: 3, workstationId: 'FLOOR-A-01', startedAt: NOW });
  assert.equal(record.status, 'supervised');
  assert.equal(record.day, 3);
  assert.equal(record.workstationId, 'FLOOR-A-01');
  assert.deepEqual(record.cases, []);
  assert.equal(firstShiftMentorSnapshot(record).requiredCleanCases, 2);
});

test('normalizes legacy started evidence but leaves completed state completed', () => {
  assert.equal(normalizeFirstShiftMentorRecord({ status: 'started', startedAt: NOW }).status, 'supervised');
  assert.equal(normalizeFirstShiftMentorRecord({ status: 'completed', completedAt: NOW }).status, 'completed');
  assert.equal(normalizeFirstShiftMentorRecord(null), null);
});

test('records unique connected calls and ignores duplicate ids', () => {
  const record = createFirstShiftMentorRecord({ startedAt: NOW });
  const first = recordMentorCallConnected(record, { contactId: 'CALL-1', priority: 'normal' }, NOW);
  const duplicate = recordMentorCallConnected(first.record, { contactId: 'CALL-1' }, NOW);
  assert.equal(first.record.connectedContacts.length, 1);
  assert.equal(duplicate.duplicate, true);
  assert.equal(recordMentorCallConnected(record, {}).ok, false);
});

test('counts qualifying resolved cases only when QA meets 70 and no breach exists', () => {
  let record = createFirstShiftMentorRecord({ startedAt: NOW });
  record = recordMentorCaseSaved(record, cleanCase('CASE-1', 70), NOW).record;
  record = recordMentorCaseSaved(record, cleanCase('CASE-2', 94), NOW).record;
  assert.equal(record.qualifiedSinceCoaching, 2);
  assert.equal(firstShiftMentorSnapshot(record).averageQa, 82);
});

test('low QA and missing QA trigger coaching and reset clean-case count', () => {
  let record = createFirstShiftMentorRecord({ startedAt: NOW });
  record = recordMentorCaseSaved(record, cleanCase('CASE-1'), NOW).record;
  record = recordMentorCaseSaved(record, cleanCase('CASE-2', 69), NOW).record;
  assert.equal(record.coachingPending, true);
  assert.equal(record.qualifiedSinceCoaching, 0);
  assert.match(record.coachingReason, /below/i);
  const missing = recordMentorCaseSaved(createFirstShiftMentorRecord({ startedAt: NOW }), { reference: 'CASE-X', disposition: 'resolved', resolved: true }, NOW);
  assert.equal(missing.record.coachingPending, true);
});

test('a compliance breach is retained and cannot count as a qualifying case', () => {
  const result = recordMentorCaseSaved(createFirstShiftMentorRecord({ startedAt: NOW }), { ...cleanCase('CASE-B'), breach: true }, NOW);
  assert.equal(result.record.cases[0].breach, true);
  assert.equal(result.record.cases[0].outcome, 'coaching-required');
  assert.equal(result.record.qualifiedSinceCoaching, 0);
});

test('case references are idempotent and missing references are rejected', () => {
  const first = recordMentorCaseSaved(createFirstShiftMentorRecord({ startedAt: NOW }), cleanCase('CASE-1'), NOW);
  const duplicate = recordMentorCaseSaved(first.record, cleanCase('CASE-1', 100), NOW);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.record.cases[0].qa, 85);
  assert.equal(recordMentorCaseSaved(first.record, { qa: 90 }, NOW).ok, false);
});

test('coaching requires a reflection and preserves prior case evidence', () => {
  let record = recordMentorCaseSaved(createFirstShiftMentorRecord({ startedAt: NOW }), cleanCase('CASE-1', 40), NOW).record;
  assert.equal(acknowledgeMentorCoaching(record, 'too short').ok, false);
  const result = acknowledgeMentorCoaching(record, 'I will verify the service record before giving the next update.', 'Miriam Okafor', NOW);
  assert.equal(result.ok, true);
  assert.equal(result.record.cases.length, 1);
  assert.equal(result.record.cases[0].qa, 40);
  assert.equal(result.record.coachingPending, false);
  assert.equal(result.record.qualifiedSinceCoaching, 0);
});

test('review cannot be requested until two clean resolved cases since coaching', () => {
  let record = createFirstShiftMentorRecord({ startedAt: NOW });
  record = recordMentorCaseSaved(record, cleanCase('CASE-1'), NOW).record;
  assert.equal(requestMentorReview(record, NOW).reason, 'insufficient-clean-cases');
  record = recordMentorCaseSaved(record, cleanCase('CASE-2'), NOW).record;
  assert.equal(requestMentorReview(record, NOW).ok, true);
});

test('a failed case after request reopens monitoring rather than hiding evidence', () => {
  let record = createFirstShiftMentorRecord({ startedAt: NOW });
  record = recordMentorCaseSaved(record, cleanCase('CASE-1'), NOW).record;
  record = recordMentorCaseSaved(record, cleanCase('CASE-2'), NOW).record;
  record = requestMentorReview(record, NOW).record;
  const reopened = recordMentorCaseSaved(record, cleanCase('CASE-3', 60), NOW);
  assert.equal(reopened.record.status, 'supervised');
  assert.equal(reopened.record.reviewRequest, null);
  assert.equal(reopened.record.cases.length, 3);
  assert.equal(reopened.record.coachingPending, true);
});

test('mentor sign-off requires all four attestations and cannot bypass coaching', () => {
  let record = createFirstShiftMentorRecord({ startedAt: NOW });
  record = recordMentorCaseSaved(record, cleanCase('CASE-1'), NOW).record;
  record = recordMentorCaseSaved(record, cleanCase('CASE-2'), NOW).record;
  record = requestMentorReview(record, NOW).record;
  assert.equal(approveMentorReview(record, { evidenceReviewed: true }, 'Miriam', NOW).reason, 'attestations-incomplete');
  const approved = approveMentorReview(record, { evidenceReviewed: true, customerCareReady: true, safeConductConfirmed: true, crmAccuracyConfirmed: true }, 'Miriam', NOW);
  assert.equal(approved.record.status, 'completed');
  assert.equal(approved.record.mentorReview.simulated, true);
  assert.equal(approved.record.cases.length, 2);
});

test('completed record cannot be reopened by another request', () => {
  let record = createFirstShiftMentorRecord({ startedAt: NOW });
  record = recordMentorCaseSaved(record, cleanCase('CASE-1'), NOW).record;
  record = recordMentorCaseSaved(record, cleanCase('CASE-2'), NOW).record;
  record = requestMentorReview(record, NOW).record;
  record = approveMentorReview(record, { evidenceReviewed: true, customerCareReady: true, safeConductConfirmed: true, crmAccuracyConfirmed: true }, 'Miriam', NOW).record;
  assert.equal(requestMentorReview(record, NOW).ok, false);
});

test('plugin inserts imports, runtime hook and render call only when upstream bridges exist', () => {
  const fixture = `/* ${plugin.REQUIRED_MARKERS[0]} */\n/* ${plugin.REQUIRED_MARKERS[1]} */\nimport { CONTACT_STATUS } from './operations-engine.js';\nfunction renderView() {\n  saveState();\n}\nfunction openModal(html) {}`;
  const output = plugin.transformMain({ warn() { throw new Error('unexpected warning'); } }, fixture, 'function calloriaRenderFirstShiftMentorPanel() {}');
  assert.ok(output.code.includes(plugin.MARKER));
  assert.ok(output.code.includes(plugin.ENGINE_IMPORT));
  assert.ok(output.code.includes(plugin.CSS_IMPORT));
  assert.ok(output.code.includes('calloriaRenderFirstShiftMentorPanel();'));
  assert.equal(plugin.transformMain({ warn() {} }, output.code, 'runtime'), null);
});

test('plugin skips transactionally when required render anchors or event bridges are missing', () => {
  const warnings = [];
  const context = { warn(message) { warnings.push(message); } };
  const missingBridge = plugin.transformMain(context, 'function renderView() {}', 'function calloriaRenderFirstShiftMentorPanel() {}');
  assert.equal(missingBridge, null);
  const fixture = `/* ${plugin.REQUIRED_MARKERS.join(' */\n/* ')} */\nimport { A } from './operations-engine.js';\nfunction renderView() {}\nfunction openModal(html) {}`;
  const missingRender = plugin.transformMain(context, fixture, 'function calloriaRenderFirstShiftMentorPanel() {}');
  assert.equal(missingRender, null);
  assert.equal(warnings.length, 2);
});
