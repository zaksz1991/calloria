import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assessmentDraftSummary,
  normaliseAssessmentDraftStatus,
  startAssessmentDraft,
  suspendAssessmentDraft,
  markAssessmentSubmitted,
  markAssessmentOutcome
} from '../js/assessment-draft-engine.js';

const root = resolve(new URL('..', import.meta.url).pathname);
const counts = {
  aptitudeCount: 7,
  practicalCount: 3,
  aptitudeOptionCounts: [3, 3, 3, 3, 3, 3, 3],
  practicalOptionCounts: [3, 3, 3]
};

function draftState() {
  return {
    stage: 'applicant',
    applicationSubmitted: true,
    assessmentStatus: 'not_started',
    assessmentPhase: 'aptitude',
    assessmentIndex: 0,
    assessmentAnswers: [],
    practicalIndex: 0,
    practicalAnswers: [],
    assessmentReturnToReview: false,
    assessmentSavedAt: null,
    assessmentStartedAt: null,
    assessmentSubmittedAt: null
  };
}

test('legacy assessment saves migrate to an in-progress draft when an attempt was already underway', () => {
  assert.equal(normaliseAssessmentDraftStatus(undefined, {
    stage: 'assessment', assessmentAnswers: [0], practicalAnswers: []
  }), 'in_progress');
  assert.equal(normaliseAssessmentDraftStatus(undefined, {
    stage: 'applicant', applicationSubmitted: true, assessmentAnswers: [0], practicalAnswers: [], assessmentSavedAt: '2026-11-18T10:00:00.000Z'
  }), 'in_progress');
  assert.equal(normaliseAssessmentDraftStatus('not_started', {
    stage: 'applicant', applicationSubmitted: true, assessmentAnswers: [0], practicalAnswers: []
  }), 'in_progress');
  assert.equal(normaliseAssessmentDraftStatus(undefined, { stage: 'failed' }), 'failed');
  assert.equal(normaliseAssessmentDraftStatus(undefined, { stage: 'offer' }), 'submitted');
});

test('draft summary counts valid aptitude and practical answers and rejects invalid option indexes', () => {
  const summary = assessmentDraftSummary({
    assessmentStatus: 'in_progress',
    assessmentAnswers: [0, 1, 9, undefined, 2, 0, 1],
    practicalAnswers: [2, -1, 1],
    assessmentSavedAt: '2026-11-19T02:00:00.000Z'
  }, counts);
  assert.equal(summary.aptitudeAnswered, 5);
  assert.equal(summary.practicalAnswered, 2);
  assert.equal(summary.answeredCount, 7);
  assert.equal(summary.totalCount, 10);
  assert.equal(summary.remainingCount, 3);
  assert.equal(summary.progressPercent, 70);
  assert.equal(summary.complete, false);
  assert.equal(summary.status, 'in_progress');
});

test('starting an assessment creates a clean draft with timestamps', () => {
  const state = draftState();
  const result = startAssessmentDraft(state, { ...counts, now: '2026-11-19T02:00:00.000Z' });
  assert.equal(result.resumed, false);
  assert.equal(state.stage, 'assessment');
  assert.equal(state.assessmentStatus, 'in_progress');
  assert.equal(state.assessmentStartedAt, '2026-11-19T02:00:00.000Z');
  assert.deepEqual(state.assessmentAnswers, []);
  assert.deepEqual(state.practicalAnswers, []);
});

test('resuming a suspended draft preserves answers, active section, question and review-edit state', () => {
  const state = draftState();
  startAssessmentDraft(state, { ...counts, now: '2026-11-19T02:00:00.000Z' });
  state.assessmentAnswers = [1, 0, 2, 1];
  state.practicalAnswers = [2];
  state.assessmentPhase = 'practical';
  state.practicalIndex = 1;
  state.assessmentReturnToReview = true;
  suspendAssessmentDraft(state, '2026-11-19T02:08:00.000Z');
  const resumed = startAssessmentDraft(state, { ...counts, now: '2026-11-19T02:12:00.000Z' });
  assert.equal(resumed.resumed, true);
  assert.equal(state.stage, 'assessment');
  assert.equal(state.assessmentPhase, 'practical');
  assert.equal(state.practicalIndex, 1);
  assert.equal(state.assessmentReturnToReview, true);
  assert.deepEqual(state.assessmentAnswers, [1, 0, 2, 1]);
  assert.deepEqual(state.practicalAnswers, [2]);
  assert.equal(state.assessmentSavedAt, '2026-11-19T02:08:00.000Z');
});

test('save and exit suspends without clearing answers; a clean retake explicitly resets them', () => {
  const state = draftState();
  startAssessmentDraft(state, { ...counts, now: '2026-11-19T02:00:00.000Z' });
  state.assessmentAnswers = [0, 2, 1];
  assert.equal(suspendAssessmentDraft(state, '2026-11-19T02:05:00.000Z'), true);
  assert.equal(state.stage, 'applicant');
  assert.equal(state.assessmentStatus, 'in_progress');
  assert.deepEqual(state.assessmentAnswers, [0, 2, 1]);
  const retake = startAssessmentDraft(state, { ...counts, reset: true, now: '2026-11-19T02:10:00.000Z' });
  assert.equal(retake.resumed, false);
  assert.equal(state.assessmentPhase, 'aptitude');
  assert.equal(state.assessmentIndex, 0);
  assert.deepEqual(state.assessmentAnswers, []);
  assert.deepEqual(state.practicalAnswers, []);
  assert.equal(state.assessmentSubmittedAt, null);
});

test('submission and recruitment outcome are recorded distinctly', () => {
  const state = draftState();
  markAssessmentSubmitted(state, '2026-11-19T03:00:00.000Z');
  assert.equal(state.assessmentStatus, 'submitted');
  assert.equal(state.assessmentSubmittedAt, '2026-11-19T03:00:00.000Z');
  markAssessmentOutcome(state, false);
  assert.equal(state.assessmentStatus, 'failed');
  markAssessmentOutcome(state, true);
  assert.equal(state.assessmentStatus, 'submitted');
});

test('application wires save-and-exit, resume-aware start, draft progress and the exact assessment stages', async () => {
  const [main, css] = await Promise.all([
    readFile(resolve(root, 'js/main.js'), 'utf8'),
    readFile(resolve(root, 'public/calloria-mobile-responsive-v6-10.css'), 'utf8')
  ]);
  assert.match(main, /assessment-draft-engine\.js/);
  assert.match(main, /function beginAssessment\(\)/);
  assert.match(main, /startAssessmentDraft\(state/);
  assert.match(main, /case 'assessment-save-exit':/);
  assert.match(main, /suspendAssessmentDraft\(state/);
  assert.match(main, /assessmentExitButton\(\)/);
  assert.equal((main.match(/assessmentExitButton\(\)/g) || []).length >= 4, true);
  assert.match(main, /Resume assessment →/);
  assert.match(main, /Saved assessment progress/);
  assert.match(main, /markAssessmentSubmitted\(state/);
  assert.match(main, /beginAssessment\(\{reset:true\}\)/);
  assert.match(css, /CALLORIA v6\.78 — save, exit and resume recruitment assessment drafts/);
  assert.match(css, /\.assessment-draft-resume/);
});
